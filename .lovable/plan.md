
## Статус: ✅ РЕАЛИЗОВАНО (02.02.2026)

## Что было сделано

### A) Стабилизация iOS — ГОТОВО ✅
**A1. Авто "Safe Mode" для iPhone/iOS Safari**
- Добавлена функция `detectIsIOSOrMobileSafari()` для определения iOS/Safari
- Для iOS автоматически включается стабильный профиль:
  - Кодек: **VP8** (вместо VP9)
  - Разрешение: **720p/24fps** (вместо 1080p/30fps)
  - Simulcast: **выключен** (уменьшает нагрузку)
  - Аудио: **mono (channelCount: 1)**

**A2. Mute/Unmute вместо Enable/Disable**
- На iOS микрофон/камера переключаются через `publication.mute()` / `publication.unmute()` 
- Это предотвращает renegotiation и NegotiationError (code 13)
- Обычные браузеры используют стандартный подход

**A3. Улучшенная диагностика в toggle-функциях**
- Каждое переключение камеры/микрофона логируется через `diagnostics.addEvent()`
- При ошибках фиксируется причина

---

### B) Диагностика прямо в звонке — ГОТОВО ✅
**B1. useCallDiagnostics hook** (`src/hooks/useCallDiagnostics.ts`)
- Собирает события: Reconnecting, Reconnected, TrackSubscribed, ParticipantJoined и др.
- Отслеживает сетевые метрики: rtt, downlink, effectiveType (через navigator.connection)
- Счётчик реконнектов
- Информация об устройстве: платформа, браузер, iOS/Safari

**B2. CallDiagnosticsPanel** (`src/components/CallDiagnosticsPanel.tsx`)
- Кнопка с иконкой Activity в header
- При клике открывается Popover с:
  - Статус соединения (connected/reconnecting)
  - Качество связи
  - Счётчик реконнектов (подсвечен оранжевым если > 0)
  - Сетевые метрики (RTT, Downlink, Effective Type)
  - Статус камеры/микрофона
  - Количество участников
  - Время сессии
  - Информация об устройстве
  - Лента последних событий (раскрывается)
  - Кнопка "Отправить отчёт" (с троттлингом 30 сек)

---

### C) Чистка интерфейса — ГОТОВО ✅
**C1. Убрана "вторая камера"**
- Кнопка записи теперь использует иконку `Circle` (красный кружок) вместо `Video`
- Подпись "REC" вместо "Запись"
- Визуально отличается от камеры

**C2. Упрощена нижняя панель на мобилке**
- Убрана отдельная кнопка записи на мобилке (была с иконкой Video)
- Запись доступна через меню "Демонстрация"

**C3. Glassmorphism**
- Header: `bg-black/40 backdrop-blur-2xl border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)]`
- Bottom bar: такой же стиль glassmorphism
- Единообразный вид на всех панелях

---

## Файлы изменены
- `src/components/LiveKitRoom.tsx` — iOS Safe Mode, mute/unmute, диагностика, UI
- `src/hooks/useCallDiagnostics.ts` — NEW: хук сбора диагностики
- `src/components/CallDiagnosticsPanel.tsx` — NEW: панель диагностики

---

## Как проверить
1. **iPhone Safari**: зайти в комнату, 5-10 раз переключить микрофон/камеру
   - Ожидание: нет вечных реконнектов, нет NegotiationError
2. **Диагностика**: нажать на иконку Activity в header
   - Ожидание: видно статус, счётчик реконнектов, сетевые метрики
3. **UI**: проверить, что нет "двух камер" — запись теперь красный кружок "REC"
4. **Desktop Chrome**: убедиться, что HD-режим сохранился (1080p, VP9, simulcast)
