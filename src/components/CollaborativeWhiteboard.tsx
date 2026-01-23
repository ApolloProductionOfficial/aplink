import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client';
import { Pencil, Eraser, Trash2, X, Circle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface Stroke {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
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

export function CollaborativeWhiteboard({ room, participantName, isOpen, onClose }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

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

  // Broadcast clear to other participants
  const broadcastClear = useCallback(() => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'WHITEBOARD_CLEAR', 
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
        if (message.type === 'WHITEBOARD_STROKE' && message.sender !== participantName) {
          drawStroke(message.stroke);
        } else if (message.type === 'WHITEBOARD_CLEAR') {
          clearCanvas();
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isOpen, drawStroke, clearCanvas, participantName]);

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
    lastPointRef.current = getPosition(e);
  }, [getPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;

    const currentPoint = getPosition(e);
    const stroke: Stroke = {
      from: lastPointRef.current,
      to: currentPoint,
      color,
      size: brushSize,
      tool,
    };

    drawStroke(stroke);
    broadcastStroke(stroke);
    lastPointRef.current = currentPoint;
  }, [isDrawing, color, brushSize, tool, getPosition, drawStroke, broadcastStroke]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  const handleClear = useCallback(() => {
    clearCanvas();
    broadcastClear();
  }, [clearCanvas, broadcastClear]);

  if (!isOpen) return null;

  return createPortal(
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

            {/* Pen tool */}
            <Button
              variant={tool === 'pen' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('pen')}
              className="w-10 h-10 rounded-full"
            >
              <Pencil className="w-4 h-4" />
            </Button>

            {/* Eraser tool */}
            <Button
              variant={tool === 'eraser' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setTool('eraser')}
              className="w-10 h-10 rounded-full"
            >
              <Eraser className="w-4 h-4" />
            </Button>

            {/* Clear button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleClear}
              className="w-10 h-10 rounded-full hover:bg-red-500/20 hover:border-red-500/50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>

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
    </div>,
    document.body
  );
}

export default CollaborativeWhiteboard;
