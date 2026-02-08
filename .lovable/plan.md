
# План исправлений APLink: субтитры, экран, доска, таймер и мобильная стабильность

## Обзор проблем

Пользователь сообщил о нескольких критических проблемах:
1. **Субтитры** - не работают мгновенно при включении, требуют выбора языка
2. **Переводчик** - нужно убедиться, что собеседник слышит переведённое аудио
3. **Демонстрация экрана** - нет маленького окошка снизу; после завершения не возвращается в галерею
4. **Доска** - кнопки "расширить" и "закрыть" не работают; рисунок пропадает
5. **Рисование на экране** - рисунок исчезает даже без отпускания мыши
6. **Таймер** - окно появляется далеко от панели, должно быть рядом сверху
7. **Мобильная версия** - частые переподключения, создаётся несколько профилей

---

## Задача 1: Мгновенные субтитры без выбора языка

### Текущее поведение
- Субтитры начинают работать только после выбора языка перевода
- Используется ElevenLabs Scribe Realtime WebSocket

### Решение
- При включении субтитров автоматически запускать транскрипцию на сохранённом языке
- Показывать оригинальный текст сразу (partial transcript), перевод - после VAD commit
- Использовать Web Speech API как резервный вариант для браузеров без поддержки ElevenLabs

### Изменения
**src/hooks/useRealtimeCaptions.ts**:
- Убрать задержку старта - начинать сразу при `enabled = true`
- При ошибке ElevenLabs (401 payment_issue) автоматически переключаться на Web Speech API
- Web Speech API работает бесплатно, поддерживает ~40 языков

**src/components/CaptionsOverlay.tsx**:
- Показывать partial transcripts сразу (курсивом)
- Финальные (committed) - обычным шрифтом

---

## Задача 2: Переводчик - аудио для собеседника

### Текущее поведение
- Переводчик отправляет данные через LiveKit Data Channel
- GlobalActiveCall слушает `translation_audio` и воспроизводит

### Проверка
Код уже реализован корректно в:
- **src/components/RealtimeTranslator.tsx** (строки 255-285): слушает входящие сообщения
- **src/components/GlobalActiveCall.tsx** (строки 142-173): принимает и воспроизводит аудио
- **src/hooks/useLiveKitTranslationBroadcast.ts**: отправляет через Data Channel

### Возможные проблемы
- Если ElevenLabs TTS недоступен (payment issue), аудио не генерируется
- Нужно добавить резервный вариант через браузерный TTS

### Изменения
**supabase/functions/realtime-translate/index.ts**:
- При ошибке ElevenLabs использовать Lovable AI для генерации текста
- Текстовый fallback вместо аудио (показывать перевод текстом)

---

## Задача 3: Демонстрация экрана - layout и PiP

### Текущее поведение
- При старте демонстрации автоматически включается Focus Mode
- После завершения НЕ возвращается в Gallery Mode

### Решение
Добавить логику возврата в Gallery при завершении демонстрации.

### Изменения
**src/components/LiveKitRoom.tsx**:
```typescript
// Существующий код (строки 930-939):
useEffect(() => {
  if (isScreenShareEnabled && layoutMode === 'gallery') {
    setLayoutMode('focus');
    ...
  }
}, [isScreenShareEnabled, layoutMode]);

// ДОБАВИТЬ: возврат в gallery после завершения
useEffect(() => {
  // Отслеживаем предыдущее состояние
  const wasScreenSharing = prevScreenShareRef.current;
  prevScreenShareRef.current = isScreenShareEnabled;
  
  if (wasScreenSharing && !isScreenShareEnabled && layoutMode === 'focus') {
    setLayoutMode('gallery');
    toast.info('Галерея', {
      description: 'Демонстрация завершена',
      duration: 2000,
    });
  }
}, [isScreenShareEnabled, layoutMode]);
```

### PiP для локального видео при демонстрации
- Focus Mode уже показывает локальное видео в DraggablePiP
- Убедиться, что при screen share PiP видно снизу

---

## Задача 4: Доска - кнопки "расширить" и "закрыть"

### Текущее поведение
- Кнопки maximize/close не работают
- windowMode существует, но не активирован

### Решение
Исправить обработчики событий в CollaborativeWhiteboard.

### Изменения
**src/components/CollaborativeWhiteboard.tsx**:
- Добавить prop `windowMode={true}` по умолчанию для десктопа
- Исправить кнопку close - вызывать `onClose()`
- Исправить кнопку maximize - переключать `windowMaximized`

```typescript
// Исправить кнопки в header whiteboard
<Button onClick={onClose}> // Кнопка X
<Button onClick={() => setWindowMaximized(!windowMaximized)}> // Кнопка развернуть
```

---

## Задача 5: Рисование на экране - пропадание рисунков

### Текущее поведение
- Рисунок исчезает во время рисования
- Проблема связана с laser animation loop

### Причина
Laser animation loop вызывает `putImageData(baseImageDataRef)`, что стирает текущий рисунок.
Проблема: при переключении инструмента laser loop не останавливается мгновенно.

### Решение
**src/components/DrawingOverlay.tsx**:
1. При смене инструмента с laser немедленно сохранить текущий canvas state
2. Усилить проверку `toolRef.current` в animation loop
3. Добавить debounce для предотвращения race conditions

```typescript
// В useEffect для tool change (строки 410-428):
useEffect(() => {
  const prevTool = toolRef.current;
  toolRef.current = tool;
  
  // При переключении С laser - сохранить рисунок
  if (prevTool === 'laser' && tool !== 'laser') {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas && baseImageDataRef.current) {
      // НЕ восстанавливать старый baseImage - оставить текущий рисунок
      baseImageDataRef.current = null;
    }
    
    // Остановить animation loop
    if (laserAnimationRef.current) {
      cancelAnimationFrame(laserAnimationRef.current);
      laserAnimationRef.current = null;
    }
  }
  
  // Очистить laser state при переключении
  if (tool !== 'laser') {
    laserPointsRef.current = [];
  }
}, [tool]);
```

---

## Задача 6: Таймер - позиция окна

### Текущее поведение
- Таймер появляется в центре экрана (позиция по умолчанию: `y: 100`)
- Сохраняется в sessionStorage

### Решение
Изменить начальную позицию на "под верхней панелью".

### Изменения
**src/components/CallTimer.tsx**:
```typescript
// Строка 62-88, изменить getInitialPosition:
const getInitialPosition = (): { x: number; y: number } => {
  const defaultPos = {
    x: Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2),
    y: 70  // Было 100, теперь ближе к верху (под панелью)
  };
  ...
};
```

---

## Задача 7: Мобильная стабильность

### Текущие проблемы
- Частые переподключения
- Создаётся 2-3 профиля участника
- Камера/микрофон не работают с первого раза

### Уже реализованные исправления (в предыдущих коммитах)
1. Server-side token cache (3s) в `livekit-token`
2. `isStartingCallRef` lock в `ActiveCallContext`
3. `serialLockRef` для последовательных запросов токенов
4. `hasCalledStartRef` в `MeetingRoom`

### Дополнительные исправления

**src/components/LiveKitRoom.tsx**:
```typescript
// Увеличить FETCH_DEBOUNCE_MS
const FETCH_DEBOUNCE_MS = 3000; // Было 2000

// Добавить проверку на duplicate room state
const roomStateRef = useRef<string | null>(null);
useEffect(() => {
  if (room?.state === roomStateRef.current) {
    console.log('[LiveKitRoom] Duplicate state change, ignoring');
    return;
  }
  roomStateRef.current = room?.state || null;
  // ... existing logic
}, [room?.state]);
```

**src/contexts/ActiveCallContext.tsx**:
- Добавить `deviceId` в identity для уникальности
- Очищать старые сессии при подключении

### Мобильный ландшафт - доска
Уже реализовано:
- Плавающая кнопка X
- "Tap for menu" подсказка
- Persistent close button

---

## Порядок реализации

1. **Критично** - Мобильная стабильность (предотвращение дублей)
2. **Высокий** - Рисование не пропадает
3. **Высокий** - Субтитры работают мгновенно
4. **Средний** - Layout возврат в Gallery после screen share
5. **Средний** - Кнопки доски работают
6. **Низкий** - Позиция таймера

---

## Технические детали

### Файлы для изменения
| Файл | Изменения |
|------|-----------|
| `src/hooks/useRealtimeCaptions.ts` | Web Speech API fallback, instant start |
| `src/components/DrawingOverlay.tsx` | Fix laser/pen race condition |
| `src/components/LiveKitRoom.tsx` | Return to gallery on screen share end |
| `src/components/CollaborativeWhiteboard.tsx` | Fix close/maximize buttons |
| `src/components/CallTimer.tsx` | Adjust default Y position |
| `src/components/LiveKitRoom.tsx` | Mobile stability improvements |

### Новые зависимости
Нет - будет использоваться встроенный Web Speech API.

### Риски
- Web Speech API может не работать в некоторых браузерах (Firefox, Safari partial support)
- ElevenLabs payment issue требует решения на уровне аккаунта

---

## Ожидаемый результат

После реализации:
- Субтитры появляются мгновенно при включении
- Переводчик отправляет аудио собеседнику
- После демонстрации экран возвращается в галерею
- Рисунки не пропадают во время рисования
- Кнопки доски работают
- Таймер появляется под панелью
- Мобильное подключение стабильно с первого раза
