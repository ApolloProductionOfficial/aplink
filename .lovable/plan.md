
# План: Исправление интерфейса звонка и субтитров

## Обнаруженные проблемы

### 1. Субтитры не отображаются (хотя перевод работает)

**Анализ по логам:**
- ElevenLabs успешно транскрибирует речь ✅
- AI (correct-caption) успешно переводит текст ✅  
- В консоли видно `[Captions] ✅ Translated: ...` ✅
- **НО:** текст не появляется на экране — только "Голос обнаружен..."

**Причина:**
AI возвращает JSON обёрнутый в markdown code block:
```
```json
{"corrected":"...", "translated":"..."}
```
```

Текущий regex в `correct-caption` (`content.match(/\{[\s\S]*\}/)`) должен это обрабатывать, но проблема в **синхронизации состояния**:
- После `processAudioChunk` вызывается `setCaptions`, но к моменту рендера `captions` всё ещё пустой
- VAD останавливается и состояние сбрасывается до того, как успевает отобразиться

**Решение:**
1. В `useRealtimeCaptions.ts` — добавить защиту от сброса captions при остановке VAD
2. Убедиться, что `setIsProcessing(false)` вызывается только в `finally` блоке после успешного добавления caption
3. Увеличить время жизни captions с 30 до 60 секунд

---

### 2. Порядок кнопок снизу

**Текущий порядок:** [Camera] [Mic] [Screen] | [More] [Hand] [Emoji] [Chat] | [Exit]

**Требуемый порядок:** [Camera] [Mic] [Screen] | [Chat] [Emoji] [Hand] [More] | [Exit]

**Файл:** `src/components/LiveKitRoom.tsx` (строки ~2356-2410)

---

### 3. Tooltips в меню "Ещё" не показываются

**Проблема:** На скриншоте видно меню с кнопками Фокус, Галерея, Вебинар, PiP, Доска, Рисовать — но при наведении нет описания.

**Текущее состояние:** Используется `MobileTooltip`, который работает только на десктопе. На мобильных просто рендерит children.

**Проблема в том**, что на десктопе при открытом Popover фокус уходит на Popover и Tooltip не срабатывает внутри него.

**Решение:** Добавить `title` атрибут на каждую кнопку как fallback.

---

## Файлы для изменения

### 1. `supabase/functions/correct-caption/index.ts`
- Улучшить парсинг JSON для обработки markdown code blocks

### 2. `src/hooks/useRealtimeCaptions.ts`
- Добавить защиту состояния captions
- Увеличить TTL captions
- Добавить лог для отладки отображения

### 3. `src/components/LiveKitRoom.tsx`
- Изменить порядок кнопок: Chat → Emoji → Hand → More
- Добавить `title` атрибуты как fallback для tooltips в меню

### 4. `src/components/CaptionsOverlay.tsx`
- Добавить уточняющий текст в UI: "Переводить на:" вместо просто выбора языка

---

## Технические изменения

### correct-caption/index.ts
```typescript
// Улучшенный парсинг JSON
let result = { corrected: originalText, translated: originalText };
try {
  // Remove markdown code block wrapper if present
  let cleanContent = content.trim();
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    result = JSON.parse(jsonMatch[0]);
  }
} catch (parseError) {
  // fallback
}
```

### useRealtimeCaptions.ts
```typescript
// В onstop не сбрасывать captions
mediaRecorderRef.current.onstop = () => {
  // Не трогаем captions здесь - они управляются отдельно
  if (recordingChunksRef.current.length > 0) {
    const blob = new Blob(recordingChunksRef.current, { type: recordingMimeTypeRef.current });
    recordingChunksRef.current = [];
    if (blob.size >= 2000) {
      console.log('[Captions] Processing blob, captions count before:', captions.length);
      processAudioChunk(blob);
    }
  }
};
```

### LiveKitRoom.tsx (порядок кнопок)
```tsx
{/* Новый порядок: Chat → Emoji → Hand → More */}

{/* Chat toggle button - FIRST */}
<InCallChat ... />

{/* Emoji Reactions */}
<EmojiReactions ... />

{/* Raise Hand */}
<Tooltip>...</Tooltip>

{/* More menu - LAST before divider */}
<Popover>...</Popover>

{/* Divider */}
<div className="w-px h-8 bg-white/10 mx-0.5" />

{/* Leave button */}
```

### Добавить title атрибуты для fallback
```tsx
<button
  onClick={() => setLayoutMode('focus')}
  title="Один участник в фокусе, остальные мини"
  className={...}
>
```

---

## Ожидаемый результат

1. **Субтитры будут отображаться** — текст появится сразу после транскрипции
2. **Правильный порядок кнопок:** Chat (первый) → Emoji → Hand → More (последний перед выходом)
3. **Tooltips в меню** — описания будут показываться через нативный `title` атрибут
4. **Понятный UI субтитров** — пользователь увидит "Переводить на: RU" вместо просто "RU"
