import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Pencil, Eraser, Trash2, X, Circle, Download, FileText, Minus, MoveRight, Square, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

interface WhiteboardProps {
  room: Room | null;
  participantName: string;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#ffffff', // White
  '#ff4444', // Red
  '#44ff44', // Green
  '#4488ff', // Blue
  '#ffff44', // Yellow
  '#ff44ff', // Magenta
  '#44ffff', // Cyan
  '#ff8844', // Orange
  '#06b6e4', // Primary cyan
];

const TOOLS: { id: Tool; icon: React.ComponentType<any>; label: string }[] = [
  { id: 'pen', icon: Pencil, label: 'Карандаш' },
  { id: 'eraser', icon: Eraser, label: 'Ластик' },
  { id: 'line', icon: Minus, label: 'Линия' },
  { id: 'arrow', icon: MoveRight, label: 'Стрелка' },
  { id: 'rectangle', icon: Square, label: 'Прямоугольник' },
];

export function CollaborativeWhiteboard({ room, participantName, isOpen, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>('pen');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false); // UI blocking during clear
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  // Store canvas state for shape preview
  const savedImageDataRef = useRef<ImageData | null>(null);
  // Track processed clear IDs to prevent loops
  const processedClearsRef = useRef<Set<string>>(new Set());
  // Debounce ref to prevent multiple clears
  const clearDebounceRef = useRef<boolean>(false);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    contextRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [isOpen]);

  // Draw a stroke on canvas
  const drawStroke = useCallback((stroke: Stroke) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.strokeStyle = stroke.tool === 'eraser' ? '#1a1a1a' : stroke.color;
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
        // Draw line
        ctx.moveTo(shape.start.x, shape.start.y);
        ctx.lineTo(shape.end.x, shape.end.y);
        ctx.stroke();
        
        // Draw arrowhead
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
  }, []);

  // Broadcast stroke to other participants
  const broadcastStroke = useCallback((stroke: Stroke) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'WHITEBOARD_STROKE', 
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
      type: 'WHITEBOARD_SHAPE', 
      shape,
      sender: participantName 
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
  }, [room, participantName]);

  // Broadcast clear to other participants
  const broadcastClear = useCallback((clearId: string) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'WHITEBOARD_CLEAR', 
      clearId,
      sender: participantName,
      timestamp: Date.now()
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
  }, [room, participantName]);

  // Export as PNG
  const exportAsImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary canvas with dark background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Fill with dark background
    tempCtx.fillStyle = '#1a1a2e';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw the whiteboard content
    tempCtx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = `aplink-whiteboard-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }, []);

  // Export as PDF
  const exportAsPDF = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary canvas with background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Fill with dark background
    tempCtx.fillStyle = '#1a1a2e';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    
    const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape A4
    const imgData = tempCanvas.toDataURL('image/png');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Add some padding
    const padding = 10;
    pdf.addImage(imgData, 'PNG', padding, padding, pdfWidth - padding * 2, pdfHeight - padding * 2);
    pdf.save(`aplink-whiteboard-${Date.now()}.pdf`);
  }, []);

  // Listen for incoming data
  useEffect(() => {
    if (!room || !isOpen) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'WHITEBOARD_STROKE' && message.sender !== participantName) {
          drawStroke(message.stroke);
        } else if (message.type === 'WHITEBOARD_SHAPE' && message.sender !== participantName) {
          drawShape(message.shape);
        } else if (message.type === 'WHITEBOARD_CLEAR') {
          const clearId = message.clearId;
          const sender = message.sender;
          
          // Multiple checks to prevent infinite loop
          if (!clearId) {
            console.warn('[Whiteboard] Clear without clearId, ignoring');
            return;
          }
          
          // Check if already processed FIRST
          if (processedClearsRef.current.has(clearId)) {
            console.log('[Whiteboard] Already processed clear:', clearId);
            return;
          }
          
          // Check if it's our own message
          if (sender === participantName) {
            console.log('[Whiteboard] Ignoring own clear message');
            return;
          }
          
          // Add clearId to processed IMMEDIATELY
          processedClearsRef.current.add(clearId);
          
          // Limit Set size
          if (processedClearsRef.current.size > 50) {
            const arr = Array.from(processedClearsRef.current);
            processedClearsRef.current = new Set(arr.slice(-30));
          }
          
          // Clear canvas with setTimeout to avoid blocking
          setTimeout(() => {
            const canvas = canvasRef.current;
            const ctx = contextRef.current;
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              console.log('[Whiteboard] Canvas cleared by remote:', sender);
            }
          }, 0);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getPosition(e);
    
    if (tool === 'pen' || tool === 'eraser') {
      lastPointRef.current = pos;
    } else {
      // Shape tools: save current canvas state for preview
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
      // Preview shape
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
      
      // Restore and draw final shape
      if (savedImageDataRef.current) {
        const ctx = contextRef.current;
        if (ctx) {
          ctx.putImageData(savedImageDataRef.current, 0, 0);
        }
      }
      drawShape(shape);
      broadcastShape(shape);
    }
    
    setIsDrawing(false);
    lastPointRef.current = null;
    shapeStartRef.current = null;
    savedImageDataRef.current = null;
  }, [isDrawing, tool, color, brushSize, getPosition, drawShape, broadcastShape]);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    // Close dialog immediately
    setShowClearConfirm(false);
    
    // Prevent multiple clears
    if (isClearing || clearDebounceRef.current) {
      console.log('[Whiteboard] Clear already in progress, skipping');
      return;
    }
    
    // Block UI
    setIsClearing(true);
    clearDebounceRef.current = true;
    
    // Generate unique clearId
    const clearId = `clear-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Add to processed BEFORE any other operation
    processedClearsRef.current.add(clearId);
    
    // Clear canvas locally with setTimeout
    setTimeout(() => {
      try {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        if (canvas && ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          console.log('[Whiteboard] Local clear complete');
        }
      } catch (error) {
        console.error('[Whiteboard] Error clearing canvas:', error);
      }
    }, 0);
    
    // Broadcast after a short delay
    setTimeout(() => {
      try {
        broadcastClear(clearId);
        console.log('[Whiteboard] Broadcast clear:', clearId);
      } catch (error) {
        console.error('[Whiteboard] Error broadcasting clear:', error);
      }
    }, 100);
    
    // Unlock UI after 500ms
    setTimeout(() => {
      setIsClearing(false);
      clearDebounceRef.current = false;
    }, 500);
  }, [broadcastClear, isClearing]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
        <div className="bg-black/70 rounded-3xl border border-white/10 p-4 w-full max-w-5xl flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pencil className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-medium">Доска для рисования</h3>
            </div>
            
            {/* Tools */}
            <div className="flex items-center gap-2">
              {/* Color picker */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all hover:scale-110",
                      color === c && "ring-2 ring-white ring-offset-2 ring-offset-black"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Brush size */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Circle className="w-3 h-3" />
                <Slider
                  value={[brushSize]}
                  onValueChange={([v]) => setBrushSize(v)}
                  min={1}
                  max={20}
                  step={1}
                  className="w-20"
                />
                <Circle className="w-5 h-5" />
              </div>

              {/* Tool buttons */}
              {TOOLS.map((t) => {
                const Icon = t.icon;
                return (
                  <Button
                    key={t.id}
                    variant={tool === t.id ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setTool(t.id)}
                    className="w-10 h-10 rounded-full"
                    title={t.label}
                  >
                    <Icon className="w-4 h-4" />
                  </Button>
                );
              })}

              {/* Clear button */}
              <Button
                variant="outline"
                size="icon"
                onClick={handleClear}
                disabled={isClearing}
                className="w-10 h-10 rounded-full hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50"
                title="Очистить всё"
              >
                {isClearing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>

              {/* Divider */}
              <div className="w-px h-6 bg-white/20" />

              {/* Export PNG */}
              <Button
                variant="outline"
                size="icon"
                onClick={exportAsImage}
                className="w-10 h-10 rounded-full hover:bg-green-500/20 hover:border-green-500/50"
                title="Скачать PNG"
              >
                <Download className="w-4 h-4 text-green-400" />
              </Button>

              {/* Export PDF */}
              <Button
                variant="outline"
                size="icon"
                onClick={exportAsPDF}
                className="w-10 h-10 rounded-full hover:bg-blue-500/20 hover:border-blue-500/50"
                title="Скачать PDF"
              >
                <FileText className="w-4 h-4 text-blue-400" />
              </Button>

              {/* Divider */}
              <div className="w-px h-6 bg-white/20" />

              {/* Close button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="w-10 h-10 rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <canvas 
            ref={canvasRef} 
            width={1280} 
            height={720}
            className="w-full rounded-2xl border border-white/10 cursor-crosshair"
            style={{ 
              aspectRatio: '16/9', 
              background: 'rgba(26, 26, 26, 0.8)',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* Instructions */}
          <p className="text-xs text-muted-foreground text-center">
            Рисуйте вместе с другими участниками • Изменения видны всем в реальном времени
          </p>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="bg-black/90 backdrop-blur-2xl border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Очистить доску?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Все рисунки будут удалены для всех участников. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/10 hover:bg-white/20">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClear}
              className="bg-red-500/80 hover:bg-red-500 border-red-500/50"
            >
              Очистить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>,
    document.body
  );
}

export default CollaborativeWhiteboard;
