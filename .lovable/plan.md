# iOS Stability Fixes - IMPLEMENTED ✅

## Изменения выполнены (02.02.2026)

### A) Улучшение iOS Safe Mode в roomOptions ✅
**Файл:** `src/components/LiveKitRoom.tsx`

Добавлено для iOS:
- `stopLocalTrackOnUnpublish: false` — не останавливает MediaStreamTrack при unpublish, помогает при реконнекте
- Кастомный `reconnectPolicy` с baseDelay 1500ms и maxDelay 15000ms
- Снижено разрешение до **540p/20fps** для стабильности
- VP8 кодек, моно аудио, отключён simulcast

### B) Защита от повторного toggle при NegotiationError ✅
**Файл:** `src/components/LiveKitRoom.tsx`

- `TOGGLE_LOCK_DURATION_MS` увеличен до 2000ms на iOS (1000ms на остальных)
- На iOS при NegotiationError **НЕ делается автоматический retry** — вместо этого показывается toast "Подождите несколько секунд и попробуйте снова"
- На других платформах retry всё ещё работает

### C) Отключение VoiceNotifications на iOS ✅
**Файл:** `src/hooks/useVoiceNotifications.ts`

- Добавлена проверка `detectIsIOS()`
- На iOS TTS уведомления пропускаются с логом `[VoiceNotifications] Skipping on iOS - autoplay restricted`

---

## Ожидаемый результат

После изменений на iPhone Safari:
- Переключение камеры/микрофона не будет вызывать каскадные NegotiationError
- После reconnection треки не будут пытаться re-publish автоматически (благодаря `stopLocalTrackOnUnpublish: false`)
- Увеличенные интервалы между операциями предотвратят гонку условий
- Голосовые уведомления не будут вызывать ошибок (отключены на iOS)

---

## Как проверить

1. iPhone Safari: зайти в комнату, **5–10 раз** подряд:
   - включить/выключить микрофон
   - включить/выключить камеру
   Проверить: нет постоянных реконнектов, нет каскадных ошибок

2. Проверить логи консоли — должны видеть:
   - `[LiveKitRoom] Using iOS SAFE MODE (VP8, 540p, no simulcast, mono audio, stopLocalTrackOnUnpublish: false)`
   - `[VoiceNotifications] Skipping on iOS - autoplay restricted`
   - При NegotiationError: `[LiveKitRoom] iOS: Skipping camera/mic retry, waiting for stable connection`

3. Desktop Chrome: убедиться, что HD‑режим (1080p/VP9) сохранился
