
# План: Исправление критической ошибки React Hooks и доработка UI

## Проблема #1 (КРИТИЧЕСКАЯ): Краш при закрытии DrawingOverlay

### Корневая причина

В `DrawingOverlay.tsx` есть структурная ошибка порядка хуков:

```tsx
// Строка 929
if (!isOpen) return null;

// После этой строки идут useCallback (строки 944, 966, 1005):
const handleTouchStart = useCallback((...) => {}, [...]);
const handleTouchMove = useCallback((...) => {}, [...]);
const handleTouchEnd = useCallback((...) => {}, [...]);
```

Когда `isOpen` меняется с `true` на `false`:
- React ожидает тот же порядок и количество хуков
- Но `return null` прерывает выполнение РАНЬШЕ, чем вызываются эти useCallback
- = **"Rendered more hooks than during the previous render"**

### Решение

Перенести ВСЕ useCallback (handleTouchStart, handleTouchMove, handleTouchEnd) ВЫШЕ строки `if (!isOpen) return null`.

Это критически важно для соблюдения правил React: "Хуки должны вызываться в одинаковом порядке при каждом рендере".

---

## Проблема #2: Иконки PiP/Доска/Рисовать слишком маленькие

### Текущее состояние

В меню "Ещё" (LiveKitRoom.tsx, строки 2273-2331) иконки используют:
- `w-4 h-4` (16px)
- Кнопки имеют `min-w-[56px]` и `p-2`

Это создаёт визуальный дисбаланс — маленькие иконки в больших кнопках.

### Решение

Увеличить иконки до `w-5 h-5` (20px) для:
- PiP (строка 2287)
- Доска (строка 2307)
- Рисовать (строка 2326)

---

## Проблема #3: Автозапись включается автоматически

### Текущее состояние (уже правильно)

Код в MeetingRoom.tsx (строки 223-231):
```tsx
const autoRecordEnabled = profileData?.auto_record_enabled ?? false;

if (!autoRecordEnabled) {
  // Показывает промт 15 секунд
  setShowManualRecordPrompt(true);
  setTimeout(() => setShowManualRecordPrompt(false), 15000);
  return;
}
```

Это уже соответствует запросу "Только вручную".

### Дополнительная мера

Убедиться, что на iOS промт не срабатывает автоматически при reconnect. Добавить флаг `hasShownManualPromptRef` чтобы промт показывался только один раз за сессию.

---

## Проблема #4: Desktop эффекты (glass-shine, border-primary/40)

### Проверка выполнена

Код в Index.tsx (строка 461-472):
```tsx
className="... border border-white/15 md:border-primary/40 ..."

<div className="... hidden md:block">
  <div className="... animate-glass-shine" ...>
```

Desktop-эффекты сохранены корректно:
- `md:border-primary/40` — яркая обводка только на ≥768px
- `hidden md:block` — анимация shine только на desktop

---

## Файлы для изменения

### 1. `src/components/DrawingOverlay.tsx`
- Перенести handleTouchStart, handleTouchMove, handleTouchEnd ВЫШЕ `if (!isOpen) return null`
- Это устранит краш "Rendered more hooks"

### 2. `src/components/LiveKitRoom.tsx`
- Увеличить иконки в инструментах (PiP, Доска, Рисовать) с `w-4 h-4` до `w-5 h-5`

### 3. `src/pages/MeetingRoom.tsx`
- Добавить флаг предотвращения повторного показа промта записи при reconnect

---

## Техническая схема

```text
ПРОБЛЕМА: Краш при закрытии DrawingOverlay
┌─────────────────────────────────────────────────────┐
│ DrawingOverlay.tsx                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ // Хуки 1-20: useState, useRef, useCallback...     │
│                                                     │
│ if (!isOpen) return null; // Строка 929            │
│                      ↑                              │
│                      │ РАННЕЕ ВОЗВРАЩЕНИЕ           │
│                      │                              │
│ handleTouchStart = useCallback(...) // Хук 21 ❌   │
│ handleTouchMove = useCallback(...) // Хук 22 ❌    │
│ handleTouchEnd = useCallback(...) // Хук 23 ❌     │
│                                                     │
│ ❌ При isOpen=false хуки 21-23 не вызываются!      │
│                                                     │
└─────────────────────────────────────────────────────┘

РЕШЕНИЕ:
┌─────────────────────────────────────────────────────┐
│ DrawingOverlay.tsx (после исправления)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ // ВСЕ хуки (1-23) объявлены ЗДЕСЬ                 │
│ handleTouchStart = useCallback(...)                │
│ handleTouchMove = useCallback(...)                 │
│ handleTouchEnd = useCallback(...)                  │
│                                                     │
│ // Проверка ПОСЛЕ всех хуков                       │
│ if (!isOpen) return null;                          │
│                                                     │
│ // JSX возвращается только когда isOpen=true       │
│ return createPortal(...)                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Ожидаемый результат

1. **Краш устранён**: Нажатие "Рисовать" → рисование → закрытие панели работает без ошибок
2. **Иконки нормального размера**: PiP, Доска, Рисовать выглядят пропорционально
3. **Запись только вручную**: Промт показывается 15 секунд, автозапись не включается
4. **Desktop эффекты сохранены**: glass-shine и border-primary/40 работают на ≥768px
