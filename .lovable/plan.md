
# План: Комплексное исправление рисования, субтитров и мобильной версии

## Проблема #1 (КРИТИЧЕСКАЯ): Рисунки пропадают при отпускании мыши

### Корневая причина

В `DrawingOverlay.tsx` (строки 733-777) есть **closure bug** в laser animation loop:

```typescript
const animate = () => {
  // BUG: 'tool' здесь — frozen значение из момента создания effect!
  if (tool !== 'laser') {
    baseImageDataRef.current = null;
    return;
  }
  // ...
  ctx.putImageData(baseImageDataRef.current, 0, 0); // ПЕРЕЗАПИСЫВАЕТ рисунки!
};
```

Проблема: `tool` в closure НЕ обновляется в реальном времени. Когда вы переключаетесь с laser на pen, анимационный цикл продолжает работать (он был запущен когда `tool === 'laser'`), и проверка `if (tool !== 'laser')` использует OLD значение `tool`.

**Дополнительно**: Даже когда effect должен перезапуститься, `requestAnimationFrame` внутри animate() создаёт "хвост" старых кадров, которые могут вызвать `putImageData` с устаревшим `baseImageDataRef`.

### Решение

1. Добавить `toolRef = useRef(tool)` и синхронизировать через effect
2. В animate() использовать `toolRef.current` вместо `tool`
3. Добавить дополнительный guard: останавливать animation frame сразу при выходе из laser mode

```typescript
// Добавить ref для отслеживания текущего tool
const toolRef = useRef<Tool>(tool);

// Синхронизировать при каждом изменении
useEffect(() => {
  toolRef.current = tool;
}, [tool]);

// В animate() использовать ref:
const animate = () => {
  // Проверка через ref - всегда актуальное значение
  if (toolRef.current !== 'laser') {
    baseImageDataRef.current = null;
    return; // СТОП - без следующего requestAnimationFrame!
  }
  // ... рисование laser
  laserAnimationRef.current = requestAnimationFrame(animate);
};
```

---

## Проблема #2: Субтитры работают с задержкой 3-5 секунд (НЕ в реальном времени)

### Текущий pipeline

```text
Говорит → VAD ждёт 0.8s тишины → Запись останавливается → Отправка на batch API
                                                        → ElevenLabs scribe_v2 (1-2s)
                                                        → AI translation (1-2s)
                                                        → Отображение
ИТОГО: 3-5 секунд задержки
```

### Причина

Используется **batch API** (`scribe_v2`) вместо **realtime WebSocket** (`scribe_v2_realtime`).

Batch API требует полного аудио файла → ждём пока человек замолчит → только потом отправляем.

### Решение: ElevenLabs Scribe Realtime

ElevenLabs предоставляет WebSocket API для streaming transcription с ultra-low latency:

```typescript
import { Scribe, AudioFormat, CommitStrategy } from "@elevenlabs/client";

const connection = Scribe.connect({
  token: "single-use-token", // Получаем с сервера
  modelId: "scribe_v2_realtime",
  audioFormat: AudioFormat.PCM_16000,
  commitStrategy: CommitStrategy.VAD,
  vadSilenceThresholdSecs: 0.5, // Быстрее чем batch
});

// Partial transcripts приходят ПОКА человек говорит
connection.on("partial_transcript", (text) => {
  setLiveCaption(text); // Мгновенное отображение
});

// Финальный transcript с timestamps
connection.on("committed_transcript", (data) => {
  // Отправить на перевод
});
```

### План изменений

1. **Создать edge function** `elevenlabs-scribe-token/index.ts`:
   - Получает single-use token для realtime scribe
   - Token живёт 15 минут

2. **Переписать `useRealtimeCaptions.ts`**:
   - Использовать WebSocket вместо MediaRecorder + batch API
   - Отправлять PCM audio chunks напрямую в WebSocket
   - Показывать partial transcripts мгновенно (предварительные субтитры)
   - Переводить только committed transcripts (экономия API)

3. **UI улучшения**:
   - Partial transcript показывать курсивом (предварительный)
   - Committed transcript — обычным шрифтом (финальный)

### Ожидаемый результат

```text
Говорит → WebSocket streaming → Partial каждые ~100ms → МГНОВЕННЫЕ субтитры
                              → Commit при паузе → Перевод → Финальный текст
ИТОГО: ~200-500ms задержка (вместо 3-5 секунд)
```

---

## Проблема #3: Мобильная версия — автозапись и отключения на iOS

### Текущее состояние

Код в `MeetingRoom.tsx` (строки 225-237):
```typescript
const autoRecordEnabled = profileData?.auto_record_enabled ?? false;

if (!autoRecordEnabled) {
  // Показывает промт только если hasShownManualPromptRef.current === false
  if (!hasShownManualPromptRef.current) {
    hasShownManualPromptRef.current = true;
    setShowManualRecordPrompt(true);
    setTimeout(() => setShowManualRecordPrompt(false), 15000);
  }
  return;
}
```

Это **правильно** — автозапись НЕ включается автоматически.

### Проблема iOS

Если пользователь видит "автозапись", возможны причины:
1. `profileData?.auto_record_enabled === true` (включено в профиле)
2. Reconnect вызывает повторный `autoStartRecording` БЕЗ проверки ref

### Проверка в коде

В `onConnected` callback (строка 286):
```typescript
onConnected: () => {
  setConnectionStatus('connected');
  autoStartRecording(); // Вызывается при КАЖДОМ reconnect!
}
```

`autoStartRecording` проверяет `hasStartedRecordingRef`, но не проверяет `hasShownManualPromptRef` для не-авто режима.

### Решение

Добавить проверку в `autoStartRecording`:
```typescript
// В начале autoStartRecording:
if (hasShownManualPromptRef.current) {
  console.log('[MeetingRoom] Manual prompt already shown this session');
  return; // Не показывать промт повторно
}
```

### Проблема с камерой/микрофоном на iOS

iOS Safari имеет особенности:
1. MediaDevices требует user gesture для первого доступа
2. При reconnect MediaStream может "умирать"

Нужно проверить как LiveKit обрабатывает это и добавить retry logic.

---

## Проблема #4: Кнопки меню "Ещё" неровные

### Статус: ИСПРАВЛЕНО

В последнем diff добавлен `min-w-[56px]` ко всем трём кнопкам (PiP, Доска, Рисовать).

Текущий код (строки 2280, 2300, 2319):
```typescript
className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]"
```

Нужно проверить что изменения применились.

---

## Файлы для изменения

### 1. `src/components/DrawingOverlay.tsx`

**Строки 63** — добавить ref:
```typescript
const toolRef = useRef<Tool>('pen');
```

**После строки 63** — синхронизировать ref:
```typescript
useEffect(() => {
  toolRef.current = tool;
}, [tool]);
```

**Строки 742-748** — использовать ref в animate:
```typescript
const animate = () => {
  // CRITICAL: Use ref for real-time tool value, not closure
  if (toolRef.current !== 'laser') {
    baseImageDataRef.current = null;
    if (laserAnimationRef.current) {
      cancelAnimationFrame(laserAnimationRef.current);
      laserAnimationRef.current = null;
    }
    return;
  }
  // ...
};
```

### 2. Создать `supabase/functions/elevenlabs-scribe-token/index.ts`

Edge function для получения single-use token для realtime scribe:

```typescript
serve(async (req) => {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

  const response = await fetch(
    "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
    {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    }
  );

  const { token } = await response.json();
  return new Response(JSON.stringify({ token }));
});
```

### 3. `src/hooks/useRealtimeCaptions.ts`

**Полная переработка** для использования WebSocket streaming:

- Удалить VAD + MediaRecorder логику
- Добавить WebSocket к ElevenLabs Scribe Realtime
- Использовать AudioWorklet для отправки PCM chunks
- Показывать partial transcripts мгновенно

### 4. `src/pages/MeetingRoom.tsx`

**Строка 215-216** — добавить проверку в autoStartRecording:
```typescript
const autoStartRecording = useCallback(async () => {
  // Prevent duplicate prompt on iOS reconnect
  if (hasShownManualPromptRef.current && !hasStartedRecordingRef.current) {
    console.log('[MeetingRoom] Manual prompt already shown, skipping');
    return;
  }
  // ... rest of function
});
```

---

## Техническая схема

```text
ПРОБЛЕМА: Closure bug в laser animation
┌─────────────────────────────────────────────────────────────────────────┐
│ useEffect зависит от [isOpen, tool, drawLaserPoints]                   │
│                                                                         │
│ Когда tool меняется с 'laser' на 'pen':                                │
│ 1. React планирует новый effect                                         │
│ 2. НО старый animate() всё ещё в очереди requestAnimationFrame!        │
│ 3. Старый animate() выполняется с tool='laser' (frozen closure)        │
│ 4. putImageData(baseImageDataRef) → ПЕРЕЗАПИСЫВАЕТ новый рисунок!      │
│                                                                         │
│ РЕШЕНИЕ: Использовать toolRef.current для real-time проверки           │
│ + cancelAnimationFrame в return cleanup                                 │
└─────────────────────────────────────────────────────────────────────────┘

УЛУЧШЕНИЕ: Realtime субтитры
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│ БЫЛО (Batch):                                                           │
│ Говорит → 0.8s тишины → MediaRecorder.stop → Blob → Batch API → 3-5s  │
│                                                                         │
│ СТАНЕТ (Realtime):                                                      │
│ Говорит → WebSocket → Partial ~100ms → Отображение → ~200ms задержка  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Порядок выполнения

1. **Исправить drawing closure bug** — критическое, рисунки пропадают
2. **Проверить кнопки меню** — уже исправлено, нужна проверка
3. **Исправить iOS reconnect** — добавить проверку hasShownManualPromptRef
4. **Реализовать realtime субтитры** — создать edge function + переписать hook

---

## Ожидаемый результат

1. **Рисунки сохраняются**: Карандаш, фигуры не пропадают при отпускании мыши
2. **Субтитры в реальном времени**: Задержка ~200-500ms вместо 3-5 секунд
3. **Мобильная стабильность**: Промт записи показывается 1 раз, нет автозаписи
4. **Ровные кнопки**: PiP, Доска, Рисовать одинакового размера (56px)
