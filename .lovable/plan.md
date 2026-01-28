
# APLink: Локальная запись экрана + рисунки и дополнительные улучшения

## Обзор

Данный план охватывает:
1. **Локальная запись экрана с рисунками** - запись видео всей комнаты с наложением рисунков из DrawingOverlay в формате .webm
2. **Дополнительные улучшения** - оптимизации и новые возможности для улучшения пользовательского опыта

---

## Задача 1: Локальная запись экрана с рисунками (.webm)

### Текущее состояние
В `DrawingOverlay.tsx` уже есть функция `startScreenRecording()` (строки 463-585), которая:
- Запрашивает `getDisplayMedia` для захвата экрана
- Создаёт скрытый canvas для объединения экрана + рисунков
- Записывает в формате `video/webm;codecs=vp9`
- Сохраняет файл `aplink-screen-recording-{timestamp}.webm`

### Проблема
Эта функция работает только когда открыт DrawingOverlay. Нужно добавить **глобальную запись комнаты**, которая:
1. Записывает все видео участников (без диалога выбора экрана)
2. Наносит слой рисунков DrawingOverlay поверх записи
3. Доступна из главной панели инструментов (не только из DrawingOverlay)

### Решение

#### 1.1 Расширить логику записи в LiveKitRoom

Добавить состояние для отслеживания активного DrawingOverlay canvas:

```typescript
// В LiveKitContent
const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);

// Передать ref в DrawingOverlay для получения его canvas
<DrawingOverlay 
  room={room}
  participantName={participantName}
  isOpen={showDrawingOverlay}
  onClose={() => setShowDrawingOverlay(false)}
  onCanvasReady={(canvas) => { drawingCanvasRef.current = canvas; }}
/>
```

#### 1.2 Изменить toggleCallRecording в LiveKitRoom

Обновить функцию записи (строки 926-1050) для наложения рисунков:

```typescript
const toggleCallRecording = useCallback(() => {
  if (isCallRecording) {
    // ... существующая логика остановки
    return;
  }
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;
    
    const drawFrame = () => {
      // ... рисуем все видео участников
      
      // НОВОЕ: Наложить слой рисунков если DrawingOverlay активен
      if (drawingCanvasRef.current && showDrawingOverlay) {
        ctx.drawImage(drawingCanvasRef.current, 0, 0, canvas.width, canvas.height);
      }
      
      callRecordingAnimationRef.current = requestAnimationFrame(drawFrame);
    };
    
    // ... остальная логика записи
  } catch (err) {
    // ...
  }
}, [isCallRecording, showDrawingOverlay]);
```

### Файлы для изменения
- `src/components/LiveKitRoom.tsx` - интеграция drawingCanvas в запись
- `src/components/DrawingOverlay.tsx` - добавить callback `onCanvasReady`

---

## Задача 2: Улучшить UI кнопки записи

### Текущее состояние
Кнопка "Запись" находится в Popover меню демонстрации экрана (строки 1576-1595).

### Улучшения
1. **Добавить отдельную кнопку записи** в основную панель (рядом с камерой/микрофоном) на мобильных устройствах
2. **Индикатор REC** должен быть более заметным на мобильных устройствах

### Реализация
```tsx
{/* Отдельная кнопка записи для мобильных */}
{isMobile && (
  <Button
    onClick={toggleCallRecording}
    variant={isCallRecording ? "destructive" : "outline"}
    size="icon"
    className="w-10 h-10 rounded-full relative"
  >
    {isCallRecording && (
      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
    )}
    <Video className="w-5 h-5" />
  </Button>
)}
```

---

## Задача 3: Дополнительные улучшения

### 3.1 Добавить запись звука в видео-запись комнаты

Текущая запись `toggleCallRecording` записывает только видео. Нужно добавить аудио:

```typescript
// В toggleCallRecording
const audioContext = new AudioContext();
const destination = audioContext.createMediaStreamDestination();

// Получить аудио всех участников
room?.remoteParticipants.forEach((participant) => {
  participant.audioTrackPublications.forEach((publication) => {
    if (publication.track?.mediaStream) {
      const source = audioContext.createMediaStreamSource(publication.track.mediaStream);
      source.connect(destination);
    }
  });
});

// Добавить локальный микрофон
const localMic = await navigator.mediaDevices.getUserMedia({ audio: true });
const localSource = audioContext.createMediaStreamSource(localMic);
localSource.connect(destination);

// Объединить видео + аудио
const combinedStream = new MediaStream([
  ...canvas.captureStream(30).getVideoTracks(),
  ...destination.stream.getAudioTracks(),
]);
```

### 3.2 Улучшить мобильную панель записи с индикатором времени

Добавить отображение длительности записи:

```tsx
// Состояние
const [recordingDuration, setRecordingDuration] = useState(0);
const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

// При старте записи
recordingIntervalRef.current = setInterval(() => {
  setRecordingDuration(prev => prev + 1);
}, 1000);

// UI индикатор
{isCallRecording && (
  <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/50 rounded-full">
    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
    <span className="text-sm font-medium text-red-400">REC</span>
    <span className="text-sm text-white/80">{formatDuration(recordingDuration)}</span>
  </div>
)}
```

### 3.3 Добавить кнопку быстрого скриншота в DrawingOverlay

Полезно для создания обучающих материалов:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `aplink-drawing-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Скриншот сохранён');
    }
  }}
  className="w-10 h-10 rounded-full"
>
  <Download className="w-5 h-5" />
</Button>
```

### 3.4 Предварительный просмотр перед сохранением записи

Показать превью записи с кнопками "Сохранить" / "Отменить":

```tsx
const [recordingPreview, setRecordingPreview] = useState<string | null>(null);

// В onstop recorder
recorder.onstop = () => {
  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  setRecordingPreview(url); // Показать превью вместо автосохранения
};

// UI превью
{recordingPreview && (
  <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
    <div className="bg-background rounded-2xl p-4 max-w-2xl w-full">
      <video src={recordingPreview} controls className="w-full rounded-xl" />
      <div className="flex gap-2 mt-4 justify-end">
        <Button variant="ghost" onClick={() => { 
          URL.revokeObjectURL(recordingPreview);
          setRecordingPreview(null);
        }}>
          Отменить
        </Button>
        <Button onClick={() => {
          const link = document.createElement('a');
          link.download = `aplink-recording-${Date.now()}.webm`;
          link.href = recordingPreview;
          link.click();
          setRecordingPreview(null);
          toast.success('Запись сохранена');
        }}>
          Сохранить
        </Button>
      </div>
    </div>
  </div>
)}
```

---

## Техническая архитектура

### Поток данных записи

```text
+-------------------+     +-------------------+     +-------------------+
|   Video Tracks    | --> |   Recording       | --> |   Combined        |
|   (participants)  |     |   Canvas (2D)     |     |   MediaStream     |
+-------------------+     +-------------------+     +-------------------+
                                  ^                         |
                                  |                         v
+-------------------+     +-------------------+     +-------------------+
|   DrawingOverlay  | --> |   Drawing Layer   |     |   MediaRecorder   |
|   Canvas          |     |   (overlay)       |     |   (.webm output)  |
+-------------------+     +-------------------+     +-------------------+
                                  ^
                                  |
+-------------------+     +-------------------+
|   Audio Tracks    | --> |   AudioContext    |
|   (all sources)   |     |   Destination     |
+-------------------+     +-------------------+
```

### Формат выходного файла
- Контейнер: WebM
- Видеокодек: VP9 (высокое качество, хорошее сжатие)
- Аудиокодек: Opus
- Разрешение: 1920x1080 @ 30fps
- Битрейт аудио: 128kbps

---

## Сводка изменений по файлам

| Файл | Изменения |
|------|-----------|
| `src/components/LiveKitRoom.tsx` | Интеграция drawingCanvas, добавление аудио в запись, индикатор времени, превью записи |
| `src/components/DrawingOverlay.tsx` | Добавить prop `onCanvasReady` для передачи ref, кнопка скриншота |

---

## Порядок реализации

1. **Шаг 1** - Добавить `onCanvasReady` callback в DrawingOverlay
2. **Шаг 2** - Обновить toggleCallRecording для наложения рисунков
3. **Шаг 3** - Добавить захват аудио в запись
4. **Шаг 4** - Добавить индикатор времени записи
5. **Шаг 5** - Добавить превью перед сохранением (опционально)

---

## Ожидаемый результат

После реализации пользователи смогут:
1. Нажать кнопку "Запись" в панели инструментов
2. Открыть DrawingOverlay и рисовать поверх видео
3. Все рисунки будут записаны вместе с видео и аудио участников
4. После остановки записи - получить файл `.webm` с полным обучающим видео
5. Использовать записи для создания туториалов, презентаций, вебинаров
