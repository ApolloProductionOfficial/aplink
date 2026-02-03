

# План: Исправление ошибки React Hooks

## Проблема

Ошибка "Rendered more hooks than during the previous render" всё ещё происходит.

### Корневая причина

Компонент `CallMenuHint` содержит хуки (useState, useRef, useCallback), но используется **условно** в нескольких местах:

```tsx
// ❌ ПРОБЛЕМА: CallMenuHint с хуками рендерится условно
{isPiPSupported && (
  <CallMenuHint hint="...">  // useState, useRef внутри!
    <button>...</button>
  </CallMenuHint>
)}
```

Когда `isPiPSupported` равен false, `CallMenuHint` не рендерится, и его хуки не вызываются. При следующем рендере, если `isPiPSupported` станет true (или другие условия изменятся), React увидит "больше хуков чем раньше" — это и есть ошибка.

### Затронутые места

1. `src/components/LiveKitRoom.tsx` (строки 2276-2291) — `CallMenuHint` внутри `{isPiPSupported && ...}`
2. `src/components/VirtualBackgroundSelector.tsx` (строки 245-265) — `CallMenuHint` оборачивает `PopoverTrigger`

---

## Решение

### Вариант: Переписать CallMenuHint без хуков

Заменим хуки на CSS-only решение через псевдоклассы `:hover` и `:focus`. Это гарантирует, что компонент можно безопасно рендерить условно.

**Новая реализация CallMenuHint:**

```tsx
export function CallMenuHint({ 
  children, 
  hint, 
  side = 'top',
  className 
}: CallMenuHintProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn("relative inline-flex group", className)}>
      {children}
      
      {/* CSS-only tooltip - uses group-hover */}
      <div 
        className={cn(
          "absolute z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md shadow-lg whitespace-nowrap pointer-events-none",
          "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150",
          "group-focus-within:opacity-100 group-focus-within:scale-100",
          positionClasses[side]
        )}
        role="tooltip"
      >
        {hint}
        {/* Arrow */}
        <div className={cn(
          "absolute w-2 h-2 bg-black/90 rotate-45",
          // Arrow position logic
        )} />
      </div>
    </div>
  );
}
```

**Преимущества:**
- Нет хуков = безопасно для условного рендеринга
- Работает через CSS (group-hover) = надёжнее в WebView
- Производительнее (без state-менеджмента)

---

## Файлы для изменения

### 1. `src/components/CallMenuHint.tsx`
- Полная переработка компонента без useState/useRef/useCallback
- Использовать Tailwind group-hover для показа подсказки

---

## Ожидаемый результат

- Ошибка "Rendered more hooks" исчезнет
- Подсказки в меню "Ещё" продолжат работать
- Компонент можно безопасно использовать условно

---

## Техническая схема

```text
До (с хуками):
┌────────────────────────────┐
│ CallMenuHint               │
│  ├── useState(isVisible)   │  ← Хук #1
│  ├── useRef(timeout)       │  ← Хук #2
│  ├── useCallback(show)     │  ← Хук #3
│  └── useCallback(hide)     │  ← Хук #4
│                            │
│  Условный рендер = 💥      │
└────────────────────────────┘

После (CSS-only):
┌────────────────────────────┐
│ CallMenuHint               │
│  └── (нет хуков)           │
│                            │
│  Условный рендер = ✅      │
└────────────────────────────┘
```

