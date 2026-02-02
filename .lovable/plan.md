
## Анализ проблемы

Из логов ошибок видно две основные проблемы на iPhone iOS 18.7 Safari:

### 1. NegotiationError (code 13) при переключении камеры/микрофона и реконнекте
- `"failed to negotiate after removing track due to failed add track request"` — при переключении камеры
- `"error trying to re-publish tracks after reconnection"` — после переподключения
- Все ошибки происходят **внутри LiveKit SDK**, а не в нашем коде toggle-функций

### 2. VoiceNotifications Failed
- Ошибка при воспроизведении TTS на iOS — вероятно связано с autoplay policy (iOS требует user gesture для воспроизведения аудио)

---

## Причины проблем

**Проблема 1 (NegotiationError):**
Текущая реализация mute/unmute работает только когда **трек уже существует**. Но:
- При первом включении камеры/микрофона трек ещё не опубликован → используется `setCameraEnabled()` → это вызывает SDP renegotiation
- После реконнекта LiveKit SDK пытается **re-publish все треки** автоматически, что на iOS Safari приводит к NegotiationError
- Опция `stopLocalTrackOnUnpublish: true` (по умолчанию) останавливает треки при unpublish, что усложняет повторную публикацию

**Проблема 2 (VoiceNotifications):**
iOS Safari блокирует `audio.play()` без user gesture. Наш код пытается воспроизвести TTS автоматически при событиях (участник присоединился), что блокируется браузером.

---

## План исправления

### A) Улучшение iOS Safe Mode в roomOptions

**Файл:** `src/components/LiveKitRoom.tsx`

Добавить в roomOptions для iOS:
```typescript
if (isIOSSafeMode) {
  return {
    // Existing options...
    
    // KEY FIX: Don't stop tracks on unpublish — helps with reconnection
    stopLocalTrackOnUnpublish: false,
    
    // Custom reconnect policy with longer delays for iOS
    reconnectPolicy: {
      nextRetryDelayInMs: (context) => {
        // More conservative approach for iOS
        const baseDelay = 1500;
        const maxDelay = 15000;
        const delay = Math.min(baseDelay * Math.pow(1.5, context.retryCount), maxDelay);
        // Give up after 30 seconds
        if (context.elapsedMs > 30000) return null;
        return delay;
      }
    },
    
    // Lower video settings
    videoCaptureDefaults: {
      resolution: { width: 960, height: 540, frameRate: 20 }, // Even lower for stability
    },
    // ...
  };
}
```

### B) Защита от повторного toggle во время reconnection

**Файл:** `src/components/LiveKitRoom.tsx`

Сейчас есть проверка `isRoomReconnecting`, но нужно также:
1. Добавить `setTimeout` между операциями с треками (увеличить до 2000ms на iOS)
2. При NegotiationError НЕ делать retry сразу, а ждать завершения reconnection
3. Отключить автоматические retry при NegotiationError на iOS — вместо этого показывать пользователю сообщение "попробуйте ещё раз через несколько секунд"

```typescript
// В toggleCamera/toggleMicrophone:
const TOGGLE_LOCK_DURATION_MS = isIOSSafeModeLive ? 2000 : 1000;

// При NegotiationError на iOS:
if (isIOSSafeModeLive && (err?.code === 13 || err?.name === 'NegotiationError')) {
  console.warn('[LiveKitRoom] iOS NegotiationError - skipping retry, waiting for stable connection');
  toast.warning('Подождите несколько секунд и попробуйте снова', {
    description: 'Соединение стабилизируется',
    duration: 4000,
  });
  // Don't retry - let the connection stabilize
  return;
}
```

### C) Обработка ошибки re-publish after reconnection

**Файл:** `src/components/LiveKitRoom.tsx`

Добавить слушатель на `RoomEvent.LocalTrackUnpublished` и отложенную публикацию:

```typescript
useEffect(() => {
  if (!room || !isIOSSafeModeLive) return;
  
  const handleLocalTrackUnpublished = (pub: LocalTrackPublication) => {
    console.log('[LiveKitRoom] iOS: Track unpublished, will delay re-enable');
    // Mark that this track was unpublished during reconnection
  };
  
  room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
  
  return () => {
    room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
  };
}, [room, isIOSSafeModeLive]);
```

### D) Исправление VoiceNotifications для iOS

**Файл:** `src/hooks/useVoiceNotifications.ts`

Добавить проверку на iOS и использовать Web Audio API с user gesture activation:

```typescript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

const playNotification = useCallback(async (text: string) => {
  // Skip voice notifications on iOS due to autoplay restrictions
  if (isIOS) {
    console.log('[VoiceNotifications] Skipping on iOS - autoplay restricted');
    return;
  }
  
  // ... existing code
}, []);
```

Альтернативно: создать AudioContext при первом user interaction и переиспользовать его.

### E) Улучшение UI иконок (по желанию пользователя)

Пользователь упомянул про иконки — можно оставить как есть (он сам сказал "оставь, как было, пофиг").

---

## Файлы для изменения

1. **`src/components/LiveKitRoom.tsx`**
   - Добавить `stopLocalTrackOnUnpublish: false` для iOS
   - Добавить кастомный `reconnectPolicy` для iOS
   - Увеличить `TOGGLE_LOCK_DURATION_MS` до 2000ms на iOS
   - Убрать автоматический retry при NegotiationError на iOS
   - Снизить разрешение видео ещё больше (540p/20fps) для iOS

2. **`src/hooks/useVoiceNotifications.ts`**
   - Отключить голосовые уведомления на iOS (или сделать их opt-in с user gesture)

---

## Ожидаемый результат

После изменений на iPhone Safari:
- Переключение камеры/микрофона не будет вызывать каскадные NegotiationError
- После reconnection треки не будут пытаться re-publish автоматически (благодаря `stopLocalTrackOnUnpublish: false`)
- Увеличенные интервалы между операциями предотвратят гонку условий
- Голосовые уведомления не будут вызывать ошибок (будут отключены на iOS)

---

## Технические детали

**Почему `stopLocalTrackOnUnpublish: false` помогает:**
- По умолчанию LiveKit останавливает MediaStreamTrack при unpublish
- При reconnect SDK пытается создать новый трек, что требует renegotiation
- С `false` — трек остаётся живым, и при reconnect его можно переиспользовать без renegotiation

**Почему увеличенные задержки важны:**
- iOS Safari имеет более медленную обработку WebRTC
- SDP renegotiation занимает больше времени
- Параллельные операции с треками конфликтуют
