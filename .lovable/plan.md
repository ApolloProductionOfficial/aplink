
## Цель
Убрать/сильно сократить 3 группы ошибок в звонках LiveKit:
1) `invalid token … token is expired (exp)` (401 NotAllowed)  
2) `NegotiationError (code: 13)` (особенно “re-publish tracks after reconnection”)  
3) `[UnhandledRejection] removeTrack … sender was not created by this peer connection`

Сделаем так, чтобы приложение:
- автоматически обновляло токен до истечения,
- при 401/expired token делало “умный” ре-коннект с новым токеном,
- при NegotiationError запускало восстановление (с возможным fallback на более стабильные медиа-настройки),
- не спамило ошибками там, где это внутренние/ожидаемые гличи WebRTC.

---

## Что я уже вижу по коду (диагноз)
### A) “Token expired”
В `src/components/LiveKitRoom.tsx` токен запрашивается 1 раз и затем кэшируется (`tokenRef`, `hasInitializedRef`), без:
- контроля `exp`,
- планового refresh,
- стратегии обновления токена при 401.

Из твоих логов видно, что “проблемный” токен имел TTL ~10 минут (`exp - nbf = 600`). Даже если сейчас на бэкенде уже 24 часа, любой короткий TTL или долгий звонок + реконнект приведут к 401, если мы не умеем обновлять токен.

Дополнительно: если пользователь “гость” (без `participantIdentity`), сервер возвращает сгенерированный `identity`, но фронт его не сохраняет надёжно для повторных запросов токена (это важно для корректного восстановления с тем же identity).

### B) NegotiationError (13) после реконнекта / переключений
Сейчас нет обработки состояний `Reconnecting/Reconnected` — UI может разрешать переключать камеру/микрофон во время реконнекта, а LiveKit параллельно пытается “re-publish tracks”, что часто заканчивается NegotiationError.

Также у нас очень “тяжёлый” профиль публикации:
- VP9 + simulcast + 1080p
Это круто по качеству, но повышает шанс negotiation проблем на части устройств/сетей. Нужен fallback.

### C) removeTrack sender mismatch
Эта ошибка обычно “внутренняя” в WebRTC/SDK и часто возникает как следствие гонок при переподключении/перепубликации треков. Мы постараемся уменьшить вероятность (через правильную блокировку действий во время реконнекта), и дополнительно уберём её из “алертинга” (чтобы не засорять Telegram/лог-репорты).

---

## План работ (что именно поменяем)

### 1) Умное управление LiveKit токеном (refresh + reuse identity)
**Файлы:**  
- `src/components/LiveKitRoom.tsx`  
- `src/contexts/ActiveCallContext.tsx` (минимально, чтобы сохранять guest identity)  
- `src/components/GlobalActiveCall.tsx` (чтобы уметь “форсить” реконнект)

**Изменения:**
1. Добавить декодирование JWT payload (без библиотек):
   - извлекать `exp` из токена
   - хранить `exp` в `ref`
2. Добавить таймер refresh:
   - планировать обновление токена за N секунд до `exp` (например 90–180 секунд)
   - обновление должно быть “тихим” (не реконнектить комнату, просто держать свежий токен на случай будущего reconnect)
3. Если `participantIdentity` не передан (гость):
   - сохранять `identity` из ответа `livekit-token` в `ref`
   - опционально: записать его в ActiveCallContext (чтобы даже при принудительном remount мы не “переименовались” в нового участника)
4. При ошибках 401 / “token expired”:
   - принудительно запросить новый токен **и выполнить controlled reconnect** (см. пункт 2)

Ожидаемый эффект: “invalid token … expired” исчезает даже при долгих звонках/переподключениях.

---

### 2) Controlled reconnect при “фатальных” ошибках (401/expired/повторяющийся NegotiationError)
**Файлы:**  
- `src/components/LiveKitRoom.tsx`  
- `src/components/GlobalActiveCall.tsx`

**Изменения:**
1. В `LiveKitRoom.tsx` добавить `lkInstanceKey` (state counter), и использовать его как `key` на `<LKRoom …>`:
   - когда нужно выполнить “жёсткий” реконнект, мы увеличиваем `lkInstanceKey`, тем самым LiveKitRoom из `@livekit/components-react` пересоздаст `Room` и подключится с новым токеном.
2. Сделать в `LiveKitRoom.tsx` функцию `forceReconnect(reason)`:
   - защищённую от спама (cooldown 10–20 секунд, max попыток)
   - последовательность: refresh token → bump `lkInstanceKey`
3. В `GlobalActiveCall.handleError` распознавать типы:
   - если ошибка содержит `status: 401` / `NotAllowed` / `token is expired` / `invalid token` → вызвать `forceReconnect("token")`
   - если `NegotiationError` повторяется → вызвать `forceReconnect("negotiation")`

Ожидаемый эффект: вместо “развала” звонка — аккуратное восстановление.

---

### 3) Реальное управление состоянием реконнекта (чтобы не ловить гонки)
**Файлы:**  
- `src/components/LiveKitRoom.tsx` (внутри `LiveKitContent`)  
- `src/pages/MeetingRoom.tsx` (UI статус “reconnecting”)

**Изменения:**
1. Подписаться на события комнаты:
   - `RoomEvent.Reconnecting`
   - `RoomEvent.Reconnected`
   - `RoomEvent.Disconnected`
2. Держать флаг `isRoomReconnecting` в state/ref.
3. Пока `isRoomReconnecting === true`:
   - блокировать кнопки toggle camera/mic/screen (или делать “очередь” действий)
   - показывать пользователю мягкий статус (например “Переподключение…”)
4. На `Reconnected`:
   - по необходимости “мягко” пере-применить желаемые состояния треков (камера/микрофон), но строго последовательно (с задержкой 200–400ms), чтобы снизить NegotiationError.

Ожидаемый эффект: значительно меньше NegotiationError и removeTrack после реконнекта.

---

### 4) Улучшение логики переключения камеры/микрофона (устранение мелких гонок)
**Файлы:**  
- `src/components/LiveKitRoom.tsx`

**Изменения:**
1. В `toggleCamera/toggleMicrophone/toggleScreenShare`:
   - вычислять “следующее состояние” не из замкнутого `isCameraEnabled` из render, а из актуального `localParticipant?.isCameraEnabled` в момент клика
2. Увеличить/улучшить lock:
   - lock держать не “setTimeout 300ms”, а до завершения операции + небольшой debounce (например 600–800ms)
3. Если ловим `NegotiationError`:
   - делать retry (уже есть), но также:
   - не делать повторный retry если в этот момент `isRoomReconnecting === true`

Ожидаемый эффект: меньше NegotiationError при быстром клике/плохой сети.

---

### 5) Авто-fallback на “стабильный” профиль видео при повторяющихся NegotiationError
**Файлы:**  
- `src/components/LiveKitRoom.tsx`

**Идея:**
Если NegotiationError повторился, например, 2 раза за 60 секунд — переключаемся на более стабильные параметры публикации и делаем reconnect:
- `videoCodec: 'vp8'`
- возможно `simulcast: false`
- возможно `resolution: 1280x720` (или оставить 1080p, но чаще стабилизирует именно снижение)

Сделаем это адаптивно:
- по умолчанию остаётся текущий “HD/VP9/simulcast”
- fallback включается только при проблемах

Ожидаемый эффект: “самовосстановление” на проблемных устройствах/сетях без ручных действий.

---

### 6) Убрать мусорные ошибки из уведомлений (но не скрывать реальные)
**Файлы:**  
- `src/utils/globalErrorHandler.ts`  
- `src/components/LiveKitRoom.tsx`  
- `src/pages/MeetingRoom.tsx`

**Изменения:**
1. В `window.onunhandledrejection` добавить фильтр для:
   - `"Failed to execute 'removeTrack' on 'RTCPeerConnection': The sender was not created by this peer connection."`
   (Чтобы не отправлять это как критический инцидент.)
2. В местах, где мы сами пишем `console.error("[LiveKitRoom] Room error:", err)`:
   - для ожидаемых/обрабатываемых сценариев (Cancelled, временный reconnect, negotiation recoverable) писать `console.warn` или `console.info`, чтобы не триггерить наш перехват `console.error` → уведомления.
3. В `GlobalActiveCall`:
   - не считать `"Cancelled"` ошибкой для авто-reconnect, если это реально user-initiated/наша очистка.

Ожидаемый эффект: меньше спама и “ложных тревог”, при этом реальные проблемы останутся видимыми.

---

## Проверка (как протестируем, что стало лучше)
1. **Долгий звонок / токен**
   - зайти в комнату, оставить звонок активным > 15 минут
   - имитировать сеть: выключить/включить интернет (или сменить Wi‑Fi)
   - убедиться, что нет `token is expired`, звонок восстанавливается
2. **NegotiationError**
   - во время звонка: несколько раз переключить камеру/микрофон
   - во время реконнекта: убедиться, что кнопки корректно блокируются
3. **removeTrack**
   - повторить сценарии реконнекта/переключений
   - убедиться, что ошибка либо исчезла, либо хотя бы больше не улетает в репорты/алерты
4. **MP4 конвертация (не связано напрямую, но важно)**
   - записать короткий фрагмент
   - убедиться, что конвертация WebM→MP4 проходит успешно после записи

---

## Затрагиваемые файлы (итоговый список)
- `src/components/LiveKitRoom.tsx` (token refresh, reconnect key, reconnect events, toggle hardening, fallback profile)
- `src/components/GlobalActiveCall.tsx` (распознавание 401/NegotiationError и вызов controlled reconnect)
- `src/contexts/ActiveCallContext.tsx` (сохранение guest identity, если нужно)
- `src/pages/MeetingRoom.tsx` (UI статус reconnecting + более корректная обработка ошибок)
- `src/utils/globalErrorHandler.ts` (фильтр removeTrack sender mismatch + возможно ещё 1–2 “шумных” строк)

---

## Риски и как их снизим
- **Риск:** “жёсткий reconnect” может на секунду “моргнуть” видео.
  - **Снижение:** делать его только при 401/expired или повторяющемся NegotiationError; не трогать обычный happy-path.
- **Риск:** fallback на VP8/720p снизит качество.
  - **Снижение:** включать fallback только при реальных проблемах; добавить toast “включен стабильный режим видео” (прозрачность для пользователя).

---