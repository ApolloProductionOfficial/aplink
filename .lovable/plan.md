
# План: Убрать "зеркальную тень" с формы и сделать нижнюю панель стеклянной

## Проблема
На форме "Создать комнату" есть эффект "зеркального отражения" (строка 465), который выглядит как непонятная чёрная полоса наверху плашки. Это `bg-gradient-to-b from-white/5 via-transparent to-transparent`.

Нижняя панель использует `bg-card`, а не glassmorphism стиль как header.

---

## Что сделаю

### 1. Убрать "зеркальную тень" с формы создания комнаты
**Файл:** `src/pages/Index.tsx`

**Удалить строку 465:**
```tsx
<div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none rounded-2xl" />
```

Это уберёт "чёрную хуйню" сверху формы.

---

### 2. Сделать нижнюю панель в glassmorphism стиле как header
**Файл:** `src/components/APLinkBottomNav.tsx`

**Было (строки 86-87):**
```tsx
<div className="absolute inset-0 bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-xl" />
<div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-primary/8 to-primary/3" />
```

**Станет:**
```tsx
<div className="absolute inset-0 bg-black/60 backdrop-blur-2xl" />
<div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
```

Это приведёт нижнюю панель к такому же "стеклянному" стилю как header (`bg-black/60 backdrop-blur-2xl`).

---

## Результат
- Форма "Создать комнату" будет без странной тени/полосы наверху
- Нижняя навигация будет выглядеть так же "стеклянно" как header
- Единый glassmorphism стиль по всему приложению
