
# План: Webinar Mode, Native PiP, Pin Participant + Bug Fixes

## Обзор

Добавляю три новых функции для видеозвонков:
1. **Webinar режим** - 1 большой спикер + лента зрителей снизу
2. **Native Browser PiP** - нативный Picture-in-Picture для просмотра при переключении вкладок
3. **Pin Participant** - закрепление участника на главном экране

Плюс исправление обнаруженных потенциальных проблем.

---

## 1. Webinar Layout (WebinarVideoLayout.tsx)

Новый компонент для вебинарного режима отображения:

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│           СПИКЕР (большой, на весь экран)           │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ [Зритель1] [Зритель2] [Зритель3] [...] [Вы]         │
│ ← Горизонтальная лента с прокруткой                 │
└─────────────────────────────────────────────────────┘
```

**Особенности:**
- Спикер занимает ~80% экрана
- Зрители отображаются в горизонтальной ленте внизу
- Scroll для просмотра всех зрителей
- Спикером становится: закрепленный участник → активный говорящий → первый удаленный
- Индикатор "СПИКЕР" над основным видео

**Файл:** `src/components/WebinarVideoLayout.tsx` (новый)

---

## 2. Native Browser Picture-in-Picture

Добавляю нативный PiP браузера для продолжения просмотра при переключении вкладок.

**Расположение кнопки:** В верхнем меню LiveKitRoom рядом с кнопкой минимизации

**Функционал:**
- Кнопка "PiP" в хедере
- При клике - активируется нативный PiP для удаленного участника
- Работает даже при переключении на другие вкладки/приложения
- Автоматический выход из PiP при возврате в комнату

**Изменения в файлах:**
- `src/components/LiveKitRoom.tsx` - добавление кнопки и логики
- `src/hooks/useNativePiP.ts` (новый) - хук для управления PiP

---

## 3. Pin Participant (Закрепление участника)

Позволяет закрепить конкретного участника на главном экране.

**Способы закрепления:**
- Правый клик на видео участника → контекстное меню "Закрепить"
- Кнопка 📌 в углу видео при наведении
- Клавиша "P" когда участник выделен

**Индикация:**
- Значок 📌 в углу закрепленного видео
- Закрепленный участник ВСЕГДА на главном экране в Focus/Webinar режимах
- В Gallery режиме - обводка и позиция первым в сетке

**Изменения в файлах:**
- `src/components/FocusVideoLayout.tsx` - добавление pinnedParticipant
- `src/components/GalleryVideoLayout.tsx` - приоритет для pinned
- `src/components/WebinarVideoLayout.tsx` - pinned как спикер
- `src/components/LiveKitRoom.tsx` - state и обработчики

---

## 4. Обновление переключателя режимов

Расширяю переключатель для 3 режимов: Focus / Gallery / Webinar

```text
┌───────────────────────────────────────┐
│  [👤 Фокус]  [📐 Галерея]  [🎤 Вебинар] │
└───────────────────────────────────────┘
```

**Изменения в файле:** `src/components/LiveKitRoom.tsx`
- Добавить тип `'webinar'` к layoutMode
- Popover вместо toggle button для выбора режима
- Иконки для каждого режима

---

## 5. Обнаруженные потенциальные проблемы и исправления

### A. DraggablePiP не рендерится когда нет mainRemoteParticipant
**Проблема:** В `FocusVideoLayout.tsx` (строка 244) PiP скрывается когда `!showChat && mainRemoteParticipant`, но если пользователь один в комнате, он не видит своё видео.
**Исправление:** Добавить self-view когда пользователь один

### B. GalleryVideoLayout - потенциальный crash при отсутствии publication
**Проблема:** В строке 95 используется `publication!` с assertion, но может быть undefined
**Исправление:** Добавить проверку `hasVideo && videoTrack?.publication` перед рендером

### C. MinimizedCallWidget - PiP ищет video с неверным атрибутом
**Проблема:** В строке 109-112 ищутся video с `data-lk-source="camera"`, но LiveKit не добавляет такой атрибут
**Исправление:** Искать по srcObject MediaStream или использовать LiveKit API напрямую

### D. useKeyboardShortcuts - Escape не завершает звонок
**Проблема:** Первое нажатие Escape показывает toast, но второе нажатие не отлавливается
**Исправление:** Добавить двойной Escape для выхода с таймером

### E. FocusVideoLayout - свапнутый view сбрасывается при изменении участников
**Проблема:** `swappedView` state сбрасывается когда mainRemoteParticipant меняется
**Исправление:** Сохранять swapped identity вместо boolean

---

## Технические детали реализации

### Новый файл: `src/components/WebinarVideoLayout.tsx`

```typescript
interface WebinarVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  speakingParticipant?: string;
  pinnedParticipant?: string; // identity закрепленного
  onPinParticipant?: (identity: string | null) => void;
}

// Определение спикера
const getSpeaker = () => {
  if (pinnedParticipant) return findParticipant(pinnedParticipant);
  if (speakingParticipant) return findParticipant(speakingParticipant);
  return remoteParticipants[0];
};

// Layout:
// - Верхняя часть: Спикер на весь экран
// - Нижняя часть: ScrollArea с лентой зрителей
```

### Новый хук: `src/hooks/useNativePiP.ts`

```typescript
export function useNativePiP(room: Room | null) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const requestPiP = async () => {
    // Найти video element удаленного участника
    // Вызвать requestPictureInPicture()
  };

  const exitPiP = async () => {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }
  };

  // Слушать события pictureInPicture
  useEffect(() => {
    const handleEnter = () => setIsPiPActive(true);
    const handleLeave = () => setIsPiPActive(false);
    
    document.addEventListener('enterpictureinpicture', handleEnter);
    document.addEventListener('leavepictureinpicture', handleLeave);
    // ...cleanup
  }, []);

  return { isPiPActive, requestPiP, exitPiP };
}
```

### Изменения в LiveKitRoom.tsx

```typescript
// Новые состояния
const [layoutMode, setLayoutMode] = useState<'focus' | 'gallery' | 'webinar'>('focus');
const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);

// Native PiP
const { isPiPActive, requestPiP, exitPiP } = useNativePiP(room);

// Обработчик пина
const handlePinParticipant = useCallback((identity: string | null) => {
  setPinnedParticipant(prev => prev === identity ? null : identity);
  toast.success(identity ? 'Участник закреплен' : 'Закрепление снято');
}, []);

// В header добавить кнопку PiP
<Button onClick={requestPiP} title="Picture-in-Picture">
  <PictureInPicture2 />
</Button>

// В render:
{layoutMode === 'focus' ? (
  <FocusVideoLayout pinnedParticipant={pinnedParticipant} onPinParticipant={handlePinParticipant} />
) : layoutMode === 'gallery' ? (
  <GalleryVideoLayout pinnedParticipant={pinnedParticipant} onPinParticipant={handlePinParticipant} />
) : (
  <WebinarVideoLayout pinnedParticipant={pinnedParticipant} onPinParticipant={handlePinParticipant} />
)}
```

### Изменения в FocusVideoLayout.tsx и GalleryVideoLayout.tsx

```typescript
// Добавить пропсы
interface Props {
  // ...existing
  pinnedParticipant?: string;
  onPinParticipant?: (identity: string | null) => void;
}

// Контекстное меню для каждого участника
<ContextMenu>
  <ContextMenuTrigger>
    <div className="video-tile">...</div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => onPinParticipant?.(participant.identity)}>
      <Pin className="w-4 h-4 mr-2" />
      {pinnedParticipant === participant.identity ? 'Открепить' : 'Закрепить'}
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>

// Индикатор пина
{pinnedParticipant === participant.identity && (
  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center">
    <Pin className="w-3 h-3 text-white" />
  </div>
)}
```

---

## Порядок реализации

| Шаг | Описание | Файл(ы) |
|-----|----------|---------|
| 1 | Создать useNativePiP хук | `useNativePiP.ts` (новый) |
| 2 | Добавить pinnedParticipant state в LiveKitRoom | `LiveKitRoom.tsx` |
| 3 | Обновить FocusVideoLayout с pin и context menu | `FocusVideoLayout.tsx` |
| 4 | Обновить GalleryVideoLayout с pin | `GalleryVideoLayout.tsx` |
| 5 | Создать WebinarVideoLayout | `WebinarVideoLayout.tsx` (новый) |
| 6 | Добавить переключатель 3 режимов в LiveKitRoom | `LiveKitRoom.tsx` |
| 7 | Интегрировать Native PiP кнопку | `LiveKitRoom.tsx` |
| 8 | Исправить баги DraggablePiP, MinimizedCallWidget, useKeyboardShortcuts | Соответствующие файлы |

---

## Ожидаемый результат

После реализации:
- **3 режима отображения**: Focus (1-on-1), Gallery (сетка), Webinar (спикер + лента)
- **Native PiP**: Просмотр звонка в мини-окне браузера при переключении вкладок
- **Pin участника**: Закрепление любого участника на главном экране
- **Исправленные баги**: Более стабильная работа виджетов и хуков
