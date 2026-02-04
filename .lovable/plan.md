
# План: Исправление UI меню "Ещё", пропадания рисунков и ускорение субтитров

## Обнаруженные проблемы

### 1. Неровные кнопки в меню "Ещё" (PiP, Доска, Рисовать)

**Причина**: В `LiveKitRoom.tsx`:
- Кнопки Layout (Фокус, Галерея, Вебинар) имеют `min-w-[56px]` (строки 2227, 2244, 2261)
- Кнопки Tools (PiP, Доска, Рисовать) **НЕ ИМЕЮТ** `min-w-[56px]` — они используют только `p-2` и `flex flex-col`
- Результат: Tools кнопки разного размера, не выровнены с Layout

**Решение**: Добавить `min-w-[56px]` к кнопкам PiP, Доска, Рисовать для единообразия с верхним рядом.

---

### 2. Рисунок пропадает при использовании инструмента "Рисовать"

**Причина**: В `DrawingOverlay.tsx` laser animation loop (строки 733-771) работает ПОСТОЯННО когда `isOpen=true`:

```typescript
const animate = () => {
  if (laserPointsRef.current.length > 0) {
    if (!baseImageDataRef.current) {
      baseImageDataRef.current = ctx.getImageData(...); // Сохраняет
    }
    ctx.putImageData(baseImageDataRef.current, 0, 0); // Восстанавливает СТАРОЕ состояние
    drawLaserPoints();
  } else {
    baseImageDataRef.current = null; // ПРОБЛЕМА: сбрасывает без сохранения
  }
  requestAnimationFrame(animate);
};
```

Когда инструмент НЕ laser, но пользователь рисует, `laserPointsRef.current.length === 0` и `baseImageDataRef.current = null` каждый кадр. Это НЕ стирает холст напрямую, но если пользователь переключился с laser на pen и быстро нарисовал, предыдущее состояние могло восстановиться.

**Дополнительная проблема**: При наличии laser points система ВОССТАНАВЛИВАЕТ `baseImageDataRef` каждый кадр, перезаписывая новые рисунки.

**Решение**: 
1. Запускать laser animation loop ТОЛЬКО когда `tool === 'laser'`
2. При переключении с laser на другой инструмент — сохранить текущее состояние холста в historyRef
3. Не восстанавливать baseImageData если laser точка не активна

---

### 3. Синхронизация рисования/доски между участниками

**Текущее состояние**: Уже работает через LiveKit Data Channel:
- `DRAWING_OVERLAY_STROKE` — синхронизирует штрихи
- `DRAWING_OVERLAY_SHAPE` — синхронизирует фигуры
- `WHITEBOARD_OPEN` — открывает доску у всех участников

Нужно убедиться что broadcast работает стабильно.

---

### 4. Субтитры работают медленно (не одновременно с речью)

**Текущий pipeline**:
1. VAD определяет речь (threshold 0.01 RMS)
2. Ждёт 1.2 секунды тишины (строка 398)
3. Создаёт аудио blob
4. Отправляет на ElevenLabs Scribe (~1-2 сек)
5. Отправляет на correct-caption для перевода (~1-2 сек)
6. Отображает субтитры

**Итого**: 3-5 секунд задержки между речью и субтитрами.

**Решение для ускорения**:
1. **Streaming transcription** — отправлять аудио ПОКА человек говорит (каждые 2-3 секунды), а не ждать окончания фразы
2. Уменьшить silence timeout с 1200ms до 800ms
3. Параллельно запускать transcription и translation (если язык можно определить быстро)

---

### 5. Мобильная синхронизация ПК ↔ Телефон

Убедиться что Data Channel работает стабильно на мобильных:
- Используется `reliable: true` для важных данных
- Используется `reliable: false` для laser pointer (можно терять)

---

## Файлы для изменения

### 1. `src/components/LiveKitRoom.tsx`
**Строки 2276-2329** — добавить `min-w-[56px]` к кнопкам PiP, Доска, Рисовать:

```diff
<button
  onClick={togglePiP}
  className={cn(
-   "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
+   "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
    isPiPActive ...
  )}
>
```

### 2. `src/components/DrawingOverlay.tsx`
**Строки 733-771** — исправить laser animation loop:

```diff
// Laser animation loop - ONLY run when tool is 'laser'
useEffect(() => {
- if (!isOpen) return;
+ if (!isOpen || tool !== 'laser') return;
  
  const canvas = canvasRef.current;
  const ctx = contextRef.current;
  if (!canvas || !ctx) return;
  
  const animate = () => {
+   // Exit early if tool changed
+   if (tool !== 'laser') {
+     // Save current state before stopping
+     if (baseImageDataRef.current) {
+       // Don't lose drawings - keep the canvas as-is
+       baseImageDataRef.current = null;
+     }
+     return;
+   }
+   
    if (laserPointsRef.current.length > 0) {
      if (!baseImageDataRef.current) {
        baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      ctx.putImageData(baseImageDataRef.current, 0, 0);
      drawLaserPoints();
-     if (laserPointsRef.current.length === 0) {
-       baseImageDataRef.current = null;
-     }
    } else {
-     baseImageDataRef.current = null;
+     // When laser stops, save final state including any new drawings
+     if (baseImageDataRef.current) {
+       // Canvas already has the correct state, just clear the cache
+       baseImageDataRef.current = null;
+     }
    }
    
    laserAnimationRef.current = requestAnimationFrame(animate);
  };
  
  animate();
  
  return () => {
    if (laserAnimationRef.current) {
      cancelAnimationFrame(laserAnimationRef.current);
    }
  };
- }, [isOpen, drawLaserPoints]);
+ }, [isOpen, tool, drawLaserPoints]);
```

### 3. `src/hooks/useRealtimeCaptions.ts`
**Строка 398** — ускорить распознавание:

```diff
- }, 1200); // Longer pause (1.2s) to capture complete phrases
+ }, 800); // Faster response (0.8s) - still captures phrases but more responsive
```

Добавить streaming режим для параллельной обработки (опционально, более сложное изменение):
- Отправлять chunks каждые 2-3 секунды пока говорит
- Объединять результаты на клиенте

---

## Техническая схема

```text
ПРОБЛЕМА: Кнопки разного размера
┌──────────────────────────────────────────────────────────────┐
│ Меню "Ещё"                                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Фокус]   [Галерея]  [Вебинар]   <- min-w-[56px] ✓         │
│   56px       56px       56px                                │
│                                                              │
│  [PiP]     [Доска]   [Рисовать]   <- НЕТ min-w ✗            │
│   42px       48px       52px      <- РАЗНЫЕ размеры         │
│                                                              │
│ ПОСЛЕ ИСПРАВЛЕНИЯ:                                          │
│  [PiP]     [Доска]   [Рисовать]   <- min-w-[56px] ✓         │
│   56px       56px       56px      <- ОДИНАКОВЫЕ             │
│                                                              │
└──────────────────────────────────────────────────────────────┘

ПРОБЛЕМА: Рисунок пропадает
┌──────────────────────────────────────────────────────────────┐
│ Laser Animation Loop (60 FPS)                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ СЕЙЧАС (всегда работает):                                   │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ animate() {                                             │  │
│ │   if (laserPoints > 0) {                               │  │
│ │     ctx.putImageData(OLD_STATE) // Перезаписывает!     │  │
│ │   } else {                                             │  │
│ │     baseImageData = null        // Сбрасывает каждый кадр │ │
│ │   }                                                    │  │
│ │   requestAnimationFrame(animate)                       │  │
│ │ }                                                      │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ПОСЛЕ (только для laser):                                   │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ useEffect(() => {                                      │  │
│ │   if (!isOpen || tool !== 'laser') return; // ⬅ GUARD │  │
│ │   animate()...                                         │  │
│ │ }, [isOpen, tool, drawLaserPoints]);                   │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘

ПРОБЛЕМА: Субтитры медленные
┌──────────────────────────────────────────────────────────────┐
│ Pipeline (текущий)                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Говорит → 1.2s тишины → ElevenLabs → AI Translation → Display│
│           ↑                 ↑             ↑                  │
│        1.2 sec          1-2 sec        1-2 sec               │
│                                                              │
│ ИТОГО: 3-5 секунд задержки                                  │
│                                                              │
│ ПОСЛЕ (0.8s silence):                                       │
│ Говорит → 0.8s тишины → ElevenLabs → AI Translation → Display│
│           ↑                                                  │
│        0.8 sec                                               │
│                                                              │
│ ИТОГО: ~2-4 секунды (улучшение ~1 секунда)                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Ожидаемый результат

1. **Ровные кнопки**: PiP, Доска, Рисовать будут одинакового размера (56px) как верхний ряд
2. **Рисунок не пропадает**: Laser animation loop не перезаписывает рисунки других инструментов
3. **Быстрее субтитры**: Задержка уменьшена с 3-5 до 2-4 секунд
4. **Синхронизация**: Рисование и доска видны всем участникам через Data Channel
5. **Мобильная стабильность**: Правильный reliable/unreliable для разных типов данных
