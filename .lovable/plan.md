
# План критических исправлений APLink v6

## Обзор проблем (с вашего скриншота)

| №   | Проблема                          | Статус            |
| --- | --------------------------------- | ----------------- |
| 1   | Субтитры "Ожидание речи" постоянно| 🔴 Критично       |
| 2   | Доска - крестик и расширение не работают | 🔴 Критично |
| 3   | Рисование исчезает мгновенно      | 🔴 Критично       |
| 4   | Позиция таймера слишком далеко    | 🟡 Среднее        |
| 5   | Мобильная версия - дубли участников| 🔴 Критично      |
| 6   | Крестик рисования выходит за рамки| 🟡 Косметическое  |

---

## Задача 1: Субтитры не работают ("Ожидание речи")

### Причина проблемы

Хук `useRealtimeCaptions` запрашивает **отдельный** поток микрофона (`navigator.mediaDevices.getUserMedia`), но:
- На iOS/Safari это может конфликтовать с LiveKit который уже захватил микрофон
- ElevenLabs API может быть недоступен или токен не получен

### Решение: Web Speech API как основной метод

Использовать **встроенный браузерный Web Speech API** для транскрипции:
- Работает бесплатно, не требует токена
- Поддерживается Chrome, Edge, Safari 14.1+
- Мгновенный старт при нажатии кнопки субтитров
- При ошибке - fallback на ElevenLabs

### Изменения в `src/hooks/useRealtimeCaptions.ts`

```typescript
// Новый подход: сначала Web Speech API (бесплатно)
// Если недоступен - ElevenLabs realtime WebSocket
// Если оба недоступны - batch API

const useWebSpeech = useCallback(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return false;
  
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'ru-RU'; // Auto-detect based on browser
  
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
      
    if (event.results[event.results.length - 1].isFinal) {
      // Финальный текст - переводим
      translateAndShow(transcript);
    } else {
      // Предварительный текст - показываем сразу
      addCaption(transcript, transcript + '...', true);
    }
  };
  
  recognition.onend = () => {
    if (enabled) recognition.start(); // Авто-рестарт
  };
  
  recognition.start();
  return true;
});
```

---

## Задача 2: Доска - кнопки не работают

### Причина проблемы

Кнопка `onClose` в fullscreen-режиме (не windowMode) правильно настроена (строки 888-892, 977-984), НО:
1. Event propagation может быть заблокирован
2. `data-preserve-cursor` attr может перехватывать клики

### Решение

1. Добавить `e.stopPropagation()` на кнопки
2. Убедиться что z-index достаточно высок
3. Исправить pointer-events

### Изменения в `src/components/CollaborativeWhiteboard.tsx`

```typescript
// Кнопка закрытия - добавить stopPropagation
<Button
  variant="ghost"
  size="icon"
  onClick={(e) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  }}
  className="fixed top-4 right-4 z-[99999] ..."
>
```

Также нужно убедиться что `windowMode={true}` передаётся по умолчанию для десктопа.

---

## Задача 3: Рисование исчезает (КРИТИЧНО - 5-й раз)

### Причина проблемы (найдена!)

В `DrawingOverlay.tsx` строки 819-870: laser animation loop проблема:

```typescript
// ПРОБЛЕМА: putImageData стирает ВСЕ что нарисовано после baseImageDataRef
if (!baseImageDataRef.current) {
  baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
}
ctx.putImageData(baseImageDataRef.current, 0, 0); // ЭТО СТИРАЕТ!
drawLaserPoints();
```

Когда пользователь переключается с laser на pen и рисует, animation loop **ВСЁ ЕЩЁ РАБОТАЕТ** и вызывает `putImageData`, которая восстанавливает старое состояние холста и стирает новые штрихи.

### Решение: полная остановка laser loop

1. При переключении инструмента ПОЛНОСТЬЮ остановить animation loop
2. НЕ восстанавливать baseImageData
3. Добавить флаг `isLaserActive` для жёсткого контроля

### Изменения в `src/components/DrawingOverlay.tsx`

```typescript
// НОВЫЙ: Жёсткий флаг для контроля laser loop
const isLaserActiveRef = useRef(false);

// При смене инструмента (строки 410-441)
useEffect(() => {
  const prevTool = toolRef.current;
  toolRef.current = tool;
  
  if (tool === 'laser') {
    // Включаем laser режим
    isLaserActiveRef.current = true;
    // Сохраняем ТЕКУЩЕЕ состояние холста
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  } else {
    // ВЫКЛЮЧАЕМ laser режим ПОЛНОСТЬЮ
    isLaserActiveRef.current = false;
    baseImageDataRef.current = null; // Очищаем cache
    laserPointsRef.current = [];
    
    // Принудительно останавливаем animation
    if (laserAnimationRef.current) {
      cancelAnimationFrame(laserAnimationRef.current);
      laserAnimationRef.current = null;
    }
  }
}, [tool]);

// Animation loop - ЖЁСТКАЯ проверка (строки 821-870)
const animate = () => {
  // КРИТИЧНО: Проверяем флаг ПЕРЕД любой операцией
  if (!isLaserActiveRef.current || toolRef.current !== 'laser') {
    // НЕМЕДЛЕННО выходим, не планируем следующий frame
    laserAnimationRef.current = null;
    baseImageDataRef.current = null;
    return;
  }
  
  // Только если laser активен - рисуем
  if (laserPointsRef.current.length > 0 && baseImageDataRef.current) {
    ctx.putImageData(baseImageDataRef.current, 0, 0);
    drawLaserPoints();
  }
  
  laserAnimationRef.current = requestAnimationFrame(animate);
};
```

---

## Задача 4: Позиция таймера

### Текущее состояние
Таймер появляется на `y: 70` (строка 65), но пользователь хочет ещё ближе.

### Решение
Изменить на `y: 56` - прямо под верхней панелью (высота панели ~48px + отступ 8px).

### Изменения в `src/components/CallTimer.tsx`

```typescript
const defaultPos = {
  x: Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2),
  y: 56  // Было 70, теперь прямо под панелью
};
```

---

## Задача 5: Мобильная стабильность (дубли участников)

### Причина
На скриншоте видно 2+ участника "Вы" - это результат reconnect storm где:
1. Мобильный браузер теряет фокус
2. LiveKit пытается переподключиться
3. Старый участник ещё не отключился
4. Создаётся новый с тем же identity

### Решение: Серверный контроль + клиентская защита

#### Серверная сторона (уже реализовано)
Token cache 3 секунды в `livekit-token` edge function

#### Клиентская сторона - усилить защиту

В `src/components/LiveKitRoom.tsx`:

```typescript
// Увеличить debounce для мобильных
const FETCH_DEBOUNCE_MS = isMobile ? 5000 : 3000;

// Добавить проверку на duplicate room join
const lastJoinAttemptRef = useRef<{ room: string; time: number } | null>(null);

// В fetchToken:
const now = Date.now();
const lastAttempt = lastJoinAttemptRef.current;
if (lastAttempt && 
    lastAttempt.room === roomName && 
    now - lastAttempt.time < 5000) {
  console.log('[LiveKitRoom] Duplicate join attempt blocked');
  return;
}
lastJoinAttemptRef.current = { room: roomName, time: now };
```

В `src/contexts/ActiveCallContext.tsx`:

```typescript
// Добавить deviceId к identity для уникальности
const getDeviceId = () => {
  let id = localStorage.getItem('aplink_device_id');
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    localStorage.setItem('aplink_device_id', id);
  }
  return id;
};

// При startCall - добавить deviceId если нет identity
const identity = params.participantIdentity || 
  `guest-${getDeviceId()}-${Date.now().toString(36)}`;
```

---

## Задача 6: Крестик рисования выходит за рамки

Уменьшить размер кнопки закрытия в DrawingOverlay.

```typescript
// Было: w-12 h-12
// Станет: w-10 h-10
<Button
  ...
  className="fixed top-4 right-4 z-[99999] w-10 h-10 rounded-full..."
>
  <X className="w-5 h-5 text-white" />
</Button>
```

---

## Порядок реализации

1. **Рисование не исчезает** - Критично, исправление laser loop
2. **Доска работает** - Критично, event propagation fix
3. **Субтитры мгновенные** - Критично, Web Speech API
4. **Мобильная стабильность** - Критично, debounce + deviceId
5. **Позиция таймера** - Среднее
6. **Размер крестика** - Косметическое

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/hooks/useRealtimeCaptions.ts` | Web Speech API как первичный метод |
| `src/components/DrawingOverlay.tsx` | Fix laser loop, уменьшить крестик |
| `src/components/CollaborativeWhiteboard.tsx` | stopPropagation на кнопках |
| `src/components/CallTimer.tsx` | y: 56 |
| `src/components/LiveKitRoom.tsx` | Увеличить debounce для мобильных |
| `src/contexts/ActiveCallContext.tsx` | DeviceId для уникальности |

---

## Ожидаемый результат

После реализации:
- ✅ Субтитры появляются МГНОВЕННО при включении (Web Speech API)
- ✅ Рисунки НЕ исчезают - laser loop полностью изолирован
- ✅ Кнопки доски работают надёжно
- ✅ Таймер появляется прямо под панелью
- ✅ Мобильная версия не создаёт дубликатов
- ✅ Крестик рисования не выходит за рамки
