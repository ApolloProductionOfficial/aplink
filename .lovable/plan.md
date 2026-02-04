
# План: Комплексное исправление рисования, автозаписи и мобильной версии

## Обнаруженные проблемы

### 1. Рисунок пропадает через 1-2 секунды (а не на mouseup)

**Причина**: В `DrawingOverlay.tsx` laser animation loop (строки 745-796) запускается ТОЛЬКО когда `tool === 'laser'` (см. строку 749). Однако если пользователь ранее активировал laser и переключился на pen, старый animation frame может всё ещё выполняться в очереди requestAnimationFrame — проверка `toolRef.current !== 'laser'` в animate() (строка 758) должна остановить его, но есть race condition.

**Дополнительная проблема**: При входящих DRAWING_OVERLAY_LASER сообщениях от других участников (строки 733-734), laser points добавляются в массив. Если laser animation loop не активен (текущий инструмент — не laser), эти точки накапливаются. Когда пользователь в следующий раз включит laser, старые точки могут вызвать нежелательное поведение.

**Решение**:
1. Добавить явную остановку animation frame при смене tool в useEffect (строки 411-419)
2. В handleData (строки 720-738) игнорировать входящие laser points если локальный tool не laser
3. Добавить проверку что `laserAnimationRef.current` точно очищается перед новым запуском

Файл: `src/components/DrawingOverlay.tsx`
```diff
// Строки 411-419: добавить явную остановку animation frame
useEffect(() => {
  toolRef.current = tool;
  
  // Clear laser state when switching away from laser tool
  if (tool !== 'laser') {
    laserPointsRef.current = [];
    baseImageDataRef.current = null;
+   // CRITICAL: Stop any running laser animation immediately
+   if (laserAnimationRef.current) {
+     cancelAnimationFrame(laserAnimationRef.current);
+     laserAnimationRef.current = null;
+   }
  }
}, [tool]);
```

---

### 2. REC включается автоматически на телефоне

**Причина**: В базе данных у пользователей `auto_record_enabled: true`. Код проверяет это значение (строки 226-232 в MeetingRoom.tsx) и если true — запускает автозапись.

Для неавторизованных пользователей (гостей) функция `autoStartRecording` (строка 223) проверяет `if (user && ...)`, то есть если `user` равен null (гость), функция просто выходит без действий. Проблема в том, что гость не видит промпт, а если пользователь залогинен — включается автозапись.

**Но пользователь сказал что не знает, залогинен ли он**. Если он залогинен и у него в профиле `auto_record_enabled: true` — это ожидаемое поведение согласно настройкам.

**Решение**:
Если пользователь хочет полностью отключить автозапись для всех, нужно:
1. Добавить пояснение в UI что автозапись можно отключить в настройках профиля
2. ИЛИ изменить default value на `false` в коде

В коде на строке 232:
```typescript
const autoRecordEnabled = profileData?.auto_record_enabled ?? false;
```
Уже `?? false`, то есть если поля нет — по умолчанию выключено. Но у существующих пользователей значение явно `true`.

**Рекомендация**: Показать toast при автозаписи с кнопкой "Отключить навсегда" которая обновит профиль.

---

### 3. Два профиля видно при входе с телефона (дублирующиеся участники)

**Причина**: Возможные сценарии:
1. Мобильный браузер создаёт несколько WebSocket подключений при reconnect
2. `guestIdentity` не сохраняется между reconnect, и LiveKit создаёт нового участника
3. Предыдущий участник не удаляется с сервера до таймаута

**Решение**:
В `LiveKitRoom.tsx` (строки 227-258) identity генерируется и сохраняется в контексте через `setGuestIdentity`. Проверить:
1. Что `guestIdentity` правильно передаётся при reconnect
2. Добавить debounce для предотвращения множественных подключений
3. Увеличить таймаут перед reconnect на iOS

Файл: `src/components/LiveKitRoom.tsx`
```diff
// В roomOptions для iOS (строки 420-457):
// Уже есть stopLocalTrackOnUnpublish: false и увеличенные задержки reconnect
// Добавить более агрессивную защиту от дублей

// Добавить в начало fetchToken:
+ // Prevent multiple token fetches in quick succession (mobile reconnect storm)
+ const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);

// В fetchToken:
+ if (fetchDebounceRef.current) {
+   clearTimeout(fetchDebounceRef.current);
+ }
+ fetchDebounceRef.current = setTimeout(() => {
+   fetchDebounceRef.current = null;
+ }, 500);
```

---

### 4. Камера и микрофон не работают на мобильном + постоянные reconnect

**Текущее состояние**: Код уже содержит iOS Safe Mode (строки 412-458) с:
- `stopLocalTrackOnUnpublish: false` — не убивать треки при unpublish
- `simulcast: false` — отключить simulcast для стабильности
- `videoCodec: 'vp8'` — более совместимый кодек
- Увеличенные задержки reconnect (до 15 секунд)

**Проблема может быть в**:
1. Встроенный браузер приложения (но пользователь сказал "обычный браузер")
2. iOS требует user gesture для первого доступа к камере/микрофону
3. Разрешения не сохраняются между сессиями

**Решение**:
1. Добавить явную проверку разрешений перед подключением
2. Показать UI-подсказку если разрешения не даны
3. Добавить кнопку "Повторить подключение камеры/микрофона"

Файл: `src/components/LiveKitRoom.tsx`
```diff
// Добавить в начало LiveKitContent (после всех хуков):
+ const [permissionsChecked, setPermissionsChecked] = useState(false);
+ const [hasMediaPermissions, setHasMediaPermissions] = useState(true);

+ useEffect(() => {
+   const checkPermissions = async () => {
+     try {
+       const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
+       stream.getTracks().forEach(t => t.stop());
+       setHasMediaPermissions(true);
+     } catch {
+       setHasMediaPermissions(false);
+     }
+     setPermissionsChecked(true);
+   };
+   if (!permissionsChecked) checkPermissions();
+ }, [permissionsChecked]);
```

---

### 5. Чат увеличивает экран (zoom) при печати

**Текущее состояние**: В `InCallChat.tsx` (строки 520-524) на мобильном используется:
```typescript
isMobile 
  ? "inset-x-0 bottom-0 h-[50vh] max-h-[400px] rounded-t-[1.5rem] animate-slide-up" 
  : ...
```

**Проблема**: iOS Safari автоматически зумит на input поля с font-size < 16px.

**Решение**: Установить `font-size: 16px` для input на мобильном.

Файл: `src/components/InCallChat.tsx`
```diff
// Строка 671:
- className="flex-1 h-10 bg-white/10 border-white/[0.08] rounded-full px-4 text-sm focus:border-primary/50"
+ className="flex-1 h-10 bg-white/10 border-white/[0.08] rounded-full px-4 text-sm sm:text-sm text-base focus:border-primary/50"
```
На мобильном будет `text-base` (16px), на десктопе `text-sm`.

---

### 6. Два окошка на главной странице (скриншот 2)

**Анализ**: На скриншоте видно форму "Создать комнату" с двумя секциями. Это дизайн страницы, не баг — верхняя секция с описанием фич, нижняя с формой ввода.

Если пользователь имеет в виду что контейнеры визуально дублируются — нужно проверить Index.tsx.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/DrawingOverlay.tsx` | Добавить cancelAnimationFrame при смене tool |
| `src/components/InCallChat.tsx` | Исправить размер шрифта input на мобильном (16px для предотвращения zoom) |
| `src/components/LiveKitRoom.tsx` | Добавить debounce для token fetch, проверку разрешений |
| `src/pages/MeetingRoom.tsx` | Добавить toast с кнопкой отключения автозаписи |

---

## Техническая схема

```text
ПРОБЛЕМА #1: Рисунок пропадает через 1-2 сек
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  tool = 'laser' → animation loop запущен                               │
│           ↓                                                             │
│  tool = 'pen' → useEffect очищает laserPointsRef и baseImageDataRef   │
│           ↓                                                             │
│  НО: animation frame в очереди всё ещё выполняется!                    │
│           ↓                                                             │
│  animate() вызывает ctx.putImageData(baseImageDataRef) = null          │
│           ↓                                                             │
│  Рисунок стирается!                                                    │
│                                                                         │
│  РЕШЕНИЕ: cancelAnimationFrame в useEffect при смене tool              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

ПРОБЛЕМА #2: Auto-record включается
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  profiles.auto_record_enabled = true (для большинства пользователей)   │
│           ↓                                                             │
│  autoStartRecording() проверяет profileData?.auto_record_enabled       │
│           ↓                                                             │
│  true → hasStartedRecordingRef = true → startRecording()               │
│           ↓                                                             │
│  REC таймер появляется = ожидаемое поведение!                          │
│                                                                         │
│  РЕШЕНИЕ: Добавить UI для быстрого отключения + пояснение              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

ПРОБЛЕМА #3: Два профиля при входе
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Мобильный браузер → reconnect storm → несколько token requests        │
│           ↓                                                             │
│  Каждый request создаёт нового участника (разные identity?)            │
│           ↓                                                             │
│  LiveKit показывает обоих до timeout                                   │
│                                                                         │
│  РЕШЕНИЕ: Debounce token fetch + проверить guestIdentity persistence   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

ПРОБЛЕМА #4: Zoom при вводе в чат (iOS)
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  input имеет font-size: 14px (text-sm)                                 │
│           ↓                                                             │
│  iOS Safari автоматически зумит input < 16px                           │
│           ↓                                                             │
│  Экран увеличивается                                                   │
│                                                                         │
│  РЕШЕНИЕ: text-base на мобильном (16px)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Порядок выполнения

1. **DrawingOverlay.tsx** — исправить пропадание рисунка (критический баг)
2. **InCallChat.tsx** — исправить zoom при вводе сообщений
3. **LiveKitRoom.tsx** — добавить debounce и проверку разрешений
4. **MeetingRoom.tsx** — улучшить UX автозаписи

---

## Ожидаемый результат

1. Рисунки карандашом/фигурами сохраняются и не пропадают
2. Чат не зумит экран при вводе сообщений на iOS
3. Меньше дублей участников при reconnect
4. Понятный UI для управления автозаписью
5. Лучшая обработка разрешений камеры/микрофона на мобильном
