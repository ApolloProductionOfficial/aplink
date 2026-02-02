
# План улучшений: Меню "Ещё", Галерея по умолчанию, Анимация, Стили

## Что нужно сделать

### 1. Меню "Ещё" (More Menu) для неосновных функций — как в Jitsi
На скриншоте Jitsi видно меню с множеством функций. Сейчас в нижней панели LiveKitRoom слишком много кнопок. Нужно сгруппировать второстепенные функции в одно выпадающее меню "Ещё".

**Основные кнопки (оставляем на панели):**
- Камера
- Микрофон
- Демонстрация экрана / Запись (уже в popover)
- Чат
- Выйти

**Перенести в меню "Ещё" (MoreHorizontal):**
- Режим отображения (Focus/Gallery/Webinar)
- Picture-in-Picture
- Виртуальный фон
- Рисование/Доска
- Реакции
- Поднять руку

**Файл:** `src/components/LiveKitRoom.tsx` (нижняя панель ~2000-2470)

---

### 2. Gallery (плитка) как режим по умолчанию + индикатор качества связи

**2.1 Галерея по умолчанию**
Изменить `useState<'focus' | 'gallery' | 'webinar'>('focus')` на `'gallery'`.

**Файл:** `src/components/LiveKitRoom.tsx` (строка 703)

**2.2 Индикатор качества связи при наведении на участника**
В `GalleryVideoLayout.tsx` добавить:
- При наведении на плитку участника показывать tooltip/overlay с метриками связи
- Цветовая индикация качества:
  - Зелёный: отличная связь (latency < 100ms, packet loss < 1%)
  - Жёлтый: средняя связь (latency 100-300ms, packet loss 1-5%)
  - Красный: плохая связь (latency > 300ms или packet loss > 5%)
- Использовать `participant.connectionQuality` из LiveKit SDK

**Файл:** `src/components/GalleryVideoLayout.tsx`

---

### 3. Анимация появления нижней навигации при скролле

В `APLinkBottomNav.tsx` уже есть `useScrollVisibility`, но сейчас используется простой `transform/opacity`. Добавить более плавную анимацию с эффектом "выезда снизу" и небольшим bounce.

**Файл:** `src/components/APLinkBottomNav.tsx`

Улучшения:
- Добавить CSS transition с cubic-bezier для эффекта "пружины"
- Добавить небольшую задержку перед появлением
- Использовать `translateY` с более выраженным эффектом

---

### 4. Стеклянный стиль для верхнего хедера на главной странице

На скриншоте видно, что верхняя панель "Apollo Production" выглядит серой/плоской. Нужно привести её к glassmorphism стилю как нижняя панель.

**Текущий стиль (строка 287):**
```tsx
className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-primary/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
```

Это уже стеклянный стиль, но возможно нужно добавить:
- Gradient overlay как на нижней панели
- Более яркую рамку снизу

**Файл:** `src/pages/Index.tsx` (строки 287-313)

Добавить:
```tsx
<div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
```

---

## Технические детали реализации

### A) Меню "Ещё" в LiveKitRoom

Создам новый `Popover` с `MoreHorizontal` иконкой, который будет содержать все второстепенные функции в виде сетки/списка:

```tsx
{/* More menu - secondary functions */}
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" size="icon" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 hover:bg-white/25 border-white/20">
      <MoreHorizontal className="w-5 h-5" />
    </Button>
  </PopoverTrigger>
  <PopoverContent side="top" className="w-64 p-3 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl">
    <div className="grid grid-cols-4 gap-2">
      {/* Layout modes */}
      <button onClick={() => setLayoutMode('focus')} ...>
      <button onClick={() => setLayoutMode('gallery')} ...>
      <button onClick={() => setLayoutMode('webinar')} ...>
      {/* PiP */}
      <button onClick={togglePiP} ...>
      {/* Background */}
      ...
      {/* Drawing */}
      ...
      {/* Reactions */}
      ...
      {/* Raise hand */}
      ...
    </div>
  </PopoverContent>
</Popover>
```

### B) Индикатор качества связи в Gallery

Использую `participant.connectionQuality` который возвращает:
- `ConnectionQuality.Excellent` (3)
- `ConnectionQuality.Good` (2)
- `ConnectionQuality.Poor` (1)
- `ConnectionQuality.Unknown` (0)

При наведении покажу overlay с:
- Цветной точкой качества
- Текстом "Отличная / Хорошая / Плохая связь"

```tsx
// В GalleryVideoLayout.tsx
import { ConnectionQuality } from 'livekit-client';

const getConnectionColor = (quality: ConnectionQuality) => {
  switch (quality) {
    case ConnectionQuality.Excellent: return 'bg-green-500';
    case ConnectionQuality.Good: return 'bg-yellow-500';
    case ConnectionQuality.Poor: return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

// В плитке участника - добавить постоянный индикатор + hover tooltip
<div className="absolute top-2 left-2 flex items-center gap-1">
  <div className={cn("w-2 h-2 rounded-full", getConnectionColor(participant.connectionQuality))} />
</div>
```

### C) Анимация APLinkBottomNav

```tsx
style={{
  transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
  opacity: isVisible ? 1 : 0,
  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
  willChange: 'transform, opacity',
}}
```

Cubic-bezier `(0.34, 1.56, 0.64, 1)` даёт эффект "выскакивания" с небольшим bounce.

---

## Файлы для изменения

1. **`src/components/LiveKitRoom.tsx`**
   - Строка 703: изменить `'focus'` на `'gallery'`
   - Строки 2200-2450: реорганизовать нижнюю панель, добавить меню "Ещё"

2. **`src/components/GalleryVideoLayout.tsx`**
   - Добавить индикатор качества связи
   - Добавить hover-эффект с информацией о связи

3. **`src/components/APLinkBottomNav.tsx`**
   - Улучшить анимацию появления (transition timing)

4. **`src/pages/Index.tsx`**
   - Строки 287-313: улучшить glassmorphism header (добавить gradient overlay)

---

## Результат

После изменений:
- Нижняя панель в звонке станет компактнее (5-6 основных кнопок + "Ещё")
- По умолчанию будет плитка (Gallery) вместо Focus
- При наведении на участника видна цветная индикация качества связи
- Нижняя навигация на главной появляется с красивой "пружинящей" анимацией
- Верхний хедер на главной станет более "стеклянным" с gradient overlay
