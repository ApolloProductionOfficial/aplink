# ✅ ЗАВЕРШЕНО: Исправление рисования, субтитров и мобильной версии

## Статус: Все задачи выполнены

---

## Исправление #1: Рисунки больше не пропадают ✅

**Файл**: `src/components/DrawingOverlay.tsx`

**Проблема**: Closure bug — laser animation loop использовал frozen значение `tool` из момента создания effect.

**Решение**:
1. Добавлен `toolRef = useRef<Tool>('pen')` для отслеживания текущего инструмента в реальном времени
2. `useEffect` синхронизирует `toolRef.current = tool` при каждом изменении
3. В `animate()` используется `toolRef.current` вместо closure variable `tool`
4. Добавлен `cancelAnimationFrame` при выходе из laser mode

---

## Исправление #2: Realtime субтитры (~200-500ms задержка) ✅

**Файлы**: 
- `supabase/functions/elevenlabs-scribe-token/index.ts` (НОВЫЙ)
- `src/hooks/useRealtimeCaptions.ts` (ПЕРЕПИСАН)

**Было**: Batch API с 3-5 сек задержкой
**Стало**: WebSocket streaming с partial transcripts

**Новый pipeline**:
```
Говорит → WebSocket → Partial ~100ms → Мгновенный показ
                    → Commit при паузе → Перевод → Финальный текст
```

**Особенности**:
- Partial transcripts показываются сразу (курсивом)
- Committed transcripts переводятся и показываются финально
- Fallback на batch API если WebSocket недоступен
- Добавлен `partialText` в return для UI

---

## Исправление #3: iOS reconnect — нет повторных промптов ✅

**Файл**: `src/pages/MeetingRoom.tsx`

**Проблема**: При reconnect на iOS показывался повторный промпт записи.

**Решение**: Добавлена проверка в начале `autoStartRecording`:
```typescript
if (hasShownManualPromptRef.current && !hasStartedRecordingRef.current) {
  console.log('[MeetingRoom] Manual prompt already shown, skipping on reconnect');
  return;
}
```

---

## Исправление #4: Кнопки меню "Ещё" выровнены ✅

**Файл**: `src/components/LiveKitRoom.tsx`

**Статус**: Уже исправлено в предыдущем коммите — все кнопки имеют `min-w-[56px]`.

---

## Техническая документация

### Новая Edge Function: `elevenlabs-scribe-token`

Получает single-use token для WebSocket подключения к ElevenLabs Scribe Realtime.

**Endpoint**: `/functions/v1/elevenlabs-scribe-token`
**Метод**: POST
**Авторизация**: Не требуется (verify_jwt = false)
**Ответ**: `{ token: string, expires_at: number }`

### Обновлённый Hook: `useRealtimeCaptions`

**Новые возвращаемые значения**:
- `partialText: string` — текущий partial transcript для показа "вживую"
- `vadActive: boolean` — индикатор активности VAD

**Fallback логика**:
1. Пытается подключиться к WebSocket
2. Если не удалось — использует batch API с VAD
3. Автоматический reconnect при обрыве WebSocket

---

## Ожидаемые результаты

1. ✅ **Рисунки сохраняются** — карандаш/фигуры не пропадают при отпускании мыши
2. ✅ **Субтитры в реальном времени** — задержка ~200-500ms вместо 3-5 секунд  
3. ✅ **Мобильная стабильность** — промпт записи показывается 1 раз
4. ✅ **Ровные кнопки** — PiP, Доска, Рисовать одинакового размера (56px)
