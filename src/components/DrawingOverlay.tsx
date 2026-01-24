import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Pencil, Eraser, Trash2, X, Circle, Minus, MoveRight, Square, Undo2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

type Tool = 'pen' | 'eraser' | 'line' | 'arrow' | 'rectangle';

interface Stroke {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
}

interface Shape {
  type: 'line' | 'arrow' | 'rectangle';
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  size: number;
}

interface DrawingOverlayProps {
  room: Room | null;
  participantName: string;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#ff4444', // Red
  '#44ff44', // Green
  '#4488ff', // Blue
  '#ffff44', // Yellow
  '#ff44ff', // Magenta
  '#44ffff', // Cyan
  '#ff8844', // Orange
  '#ffffff', // White
  '#06b6e4', // Primary cyan
];

const TOOLS: { id: Tool; icon: React.ComponentType<any>; label: string }[] = [
  { id: 'pen', icon: Pencil, label: 'Карандаш' },
  { id: 'eraser', icon: Eraser, label: 'Ластик' },
  { id: 'line', icon: Minus, label: 'Линия' },
  { id: 'arrow', icon: MoveRight, label: 'Стрелка' },
  { id: 'rectangle', icon: Square, label: 'Прямоугольник' },
];

export function DrawingOverlay({ room, participantName, isOpen, onClose }: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ff4444');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>('pen');
  const [showControls, setShowControls] = useState(true);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const savedImageDataRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    contextRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Save initial empty state
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, [isOpen]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (!canvas || !ctx) return;
      
      // Save current drawing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Resize canvas
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Restore drawing
      ctx.putImageData(imageData, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Draw a stroke on canvas
  const drawStroke = useCallback((stroke: Stroke) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,0)' : stroke.color;
    ctx.lineWidth = stroke.tool === 'eraser' ? stroke.size * 3 : stroke.size;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

    ctx.beginPath();
    ctx.moveTo(stroke.from.x, stroke.from.y);
    ctx.lineTo(stroke.to.x, stroke.to.y);
    ctx.stroke();
    
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Draw a shape on canvas
  const drawShape = useCallback((shape: Shape, preview: boolean = false) => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    if (preview && savedImageDataRef.current) {
      ctx.putImageData(savedImageDataRef.current, 0, 0);
    }

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    
    switch (shape.type) {
      case 'line':
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        break;
        
      case 'arrow':
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        
        const angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
        const headLen = 15 + shape.size * 2;
        
        ctx.beginPath();
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(
          shape.end.x - headLen * Math.cos(angle - Math.PI / 6),
          shape.end.y - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(
          shape.end.x - headLen * Math.cos(angle + Math.PI / 6),
          shape.end.y - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
        
      case 'rectangle':
        const width = shape.end.x - shape.start.x;
        const height = shape.end.y - shape.start.y;
        ctx.strokeRect(shape.start.x, shape.start.y, width, height);
        break;
    }
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    broadcastClear();
  }, []);

  // Undo last action
  const undo = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas || historyRef.current.length <= 1) return;
    
    historyRef.current.pop();
    const lastState = historyRef.current[historyRef.current.length - 1];
    if (lastState) {
      ctx.putImageData(lastState, 0, 0);
    }
  }, []);

  // Save to history
  const saveToHistory = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    // Keep only last 20 states
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }
  }, []);

  // Broadcast stroke to other participants
  const broadcastStroke = useCallback((stroke: Stroke) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'DRAWING_OVERLAY_STROKE', 
      stroke,
      sender: participantName 
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
  }, [room, participantName]);

  // Broadcast shape to other participants
  const broadcastShape = useCallback((shape: Shape) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'DRAWING_OVERLAY_SHAPE', 
      shape,
      sender: participantName 
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
  }, [room, participantName]);

  // Broadcast clear to other participants
  const broadcastClear = useCallback(() => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'DRAWING_OVERLAY_CLEAR', 
      sender: participantName 
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
  }, [room, participantName]);

  // Listen for incoming data
  useEffect(() => {
    if (!room || !isOpen) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'DRAWING_OVERLAY_STROKE' && message.sender !== participantName) {
          drawStroke(message.stroke);
        } else if (message.type === 'DRAWING_OVERLAY_SHAPE' && message.sender !== participantName) {
          drawShape(message.shape);
        } else if (message.type === 'DRAWING_OVERLAY_CLEAR' && message.sender !== participantName) {
          const canvas = canvasRef.current;
          const ctx = contextRef.current;
          if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isOpen, drawStroke, drawShape, participantName]);

  // Get position relative to canvas
  const getPosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getPosition(e);
    
    if (tool === 'pen' || tool === 'eraser') {
      lastPointRef.current = pos;
    } else {
      shapeStartRef.current = pos;
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      if (canvas && ctx) {
        savedImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    }
  }, [getPosition, tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const currentPoint = getPosition(e);

    if (tool === 'pen' || tool === 'eraser') {
      if (!lastPointRef.current) return;
      
      const stroke: Stroke = {
        from: lastPointRef.current,
        to: currentPoint,
        color,
        size: brushSize,
        tool: tool as 'pen' | 'eraser',
      };

      drawStroke(stroke);
      broadcastStroke(stroke);
      lastPointRef.current = currentPoint;
    } else if (shapeStartRef.current) {
      const shape: Shape = {
        type: tool as 'line' | 'arrow' | 'rectangle',
        start: shapeStartRef.current,
        end: currentPoint,
        color,
        size: brushSize,
      };
      drawShape(shape, true);
    }
  }, [isDrawing, color, brushSize, tool, getPosition, drawStroke, drawShape, broadcastStroke]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    if ((tool === 'line' || tool === 'arrow' || tool === 'rectangle') && shapeStartRef.current) {
      const currentPoint = getPosition(e);
      const shape: Shape = {
        type: tool,
        start: shapeStartRef.current,
        end: currentPoint,
        color,
        size: brushSize,
      };
      
      if (savedImageDataRef.current) {
        const ctx = contextRef.current;
        if (ctx) {
          ctx.putImageData(savedImageDataRef.current, 0, 0);
        }
      }
      drawShape(shape);
      broadcastShape(shape);
    }
    
    saveToHistory();
    setIsDrawing(false);
    lastPointRef.current = null;
    shapeStartRef.current = null;
    savedImageDataRef.current = null;
  }, [isDrawing, tool, color, brushSize, getPosition, drawShape, broadcastShape, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, undo]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99995] pointer-events-auto">
      {/* Transparent canvas overlay */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Floating controls - toggleable */}
      {showControls && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          {/* Color picker */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-5 h-5 rounded-full transition-all hover:scale-110",
                  color === c && "ring-2 ring-white ring-offset-1 ring-offset-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* Brush size */}
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-muted-foreground" />
            <Slider
              value={[brushSize]}
              onValueChange={([v]) => setBrushSize(v)}
              min={1}
              max={15}
              step={1}
              className="w-16"
            />
            <Circle className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* Tool buttons */}
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.id}
                variant={tool === t.id ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setTool(t.id)}
                className="w-8 h-8 rounded-full"
                title={t.label}
              >
                <Icon className="w-4 h-4" />
              </Button>
            );
          })}

          <div className="w-px h-5 bg-white/20" />

          {/* Undo */}
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            className="w-8 h-8 rounded-full"
            title="Отменить (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>

          {/* Clear */}
          <Button
            variant="ghost"
            size="icon"
            onClick={clearCanvas}
            className="w-8 h-8 rounded-full hover:bg-red-500/20"
            title="Очистить"
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-white/20" />

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-8 h-8 rounded-full"
            title="Закрыть (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Toggle controls button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.12] text-xs text-muted-foreground hover:bg-white/[0.15] transition-all"
      >
        {showControls ? 'Скрыть панель' : 'Показать панель'}
      </button>

      {/* Instructions hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60">
        ESC - выйти • Ctrl+Z - отменить • Рисунки видны всем участникам
      </div>
    </div>,
    document.body
  );
}

export default DrawingOverlay;
