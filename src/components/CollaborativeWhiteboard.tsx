import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Pencil, Eraser, Trash2, X, Circle, Download, FileText, Minus, MoveRight, Square, Film, Loader2, RotateCcw, GripHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import jsPDF from 'jspdf';

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
  /** If true, renders in a resizable floating window (desktop only) */
  windowMode?: boolean;
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

export function CollaborativeWhiteboard({ room, participantName, isOpen, onClose, windowMode = false }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>('pen');
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
  // Track if we broadcasted open state
  const hasAnnounceOpenRef = useRef(false);
  
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Window mode state (for desktop draggable/resizable)
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [windowPos, setWindowPos] = useState<{ x: number; y: number } | null>(null);
  const [windowSize, setWindowSize] = useState<{ width: number; height: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const isDraggingWindow = useRef(false);
  const isResizingWindow = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const resizeStartRef = useRef<{ width: number; height: number; px: number; py: number } | null>(null);
  
  // Orientation detection for mobile landscape hint
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  
  useEffect(() => {
    const handleOrientationChange = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Initialize window position and size for windowMode
  useEffect(() => {
    if (!isOpen || isMobile || !windowMode) return;
    
    // Try to restore from storage
    if (!windowPos && !windowSize) {
      try {
        const saved = sessionStorage.getItem('whiteboard-window-state');
        if (saved) {
          const parsed = JSON.parse(saved);
          setWindowPos(parsed.pos);
          setWindowSize(parsed.size);
          setWindowMaximized(parsed.maximized || false);
          return;
        }
      } catch {}
    }
    
    // Default: centered, 70% of screen
    if (!windowPos) {
      const defaultWidth = Math.min(1000, window.innerWidth * 0.7);
      const defaultHeight = Math.min(650, window.innerHeight * 0.7);
      setWindowPos({
        x: (window.innerWidth - defaultWidth) / 2,
        y: Math.max(80, (window.innerHeight - defaultHeight) / 2 - 50),
      });
      setWindowSize({ width: defaultWidth, height: defaultHeight });
    }
  }, [isOpen, isMobile, windowMode, windowPos, windowSize]);

  // Persist window state
  useEffect(() => {
    if (windowPos && windowSize && windowMode && !isMobile) {
      try {
        sessionStorage.setItem('whiteboard-window-state', JSON.stringify({ 
          pos: windowPos, 
          size: windowSize, 
          maximized: windowMaximized 
        }));
      } catch {}
    }
  }, [windowPos, windowSize, windowMaximized, windowMode, isMobile]);

  // Window dragging handlers
  const handleWindowDragStart = useCallback((e: React.PointerEvent) => {
    if (windowMaximized || isMobile || !windowPos) return;
    isDraggingWindow.current = true;
    dragStartRef.current = { x: windowPos.x, y: windowPos.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [windowMaximized, isMobile, windowPos]);

  const handleWindowDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingWindow.current || !dragStartRef.current || !windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStartRef.current.px;
    const dy = e.clientY - dragStartRef.current.py;
    const margin = 20;
    const nextX = Math.min(Math.max(margin, dragStartRef.current.x + dx), window.innerWidth - rect.width - margin);
    const nextY = Math.min(Math.max(margin, dragStartRef.current.y + dy), window.innerHeight - rect.height - margin);
    setWindowPos({ x: nextX, y: nextY });
  }, []);

  const handleWindowDragEnd = useCallback(() => {
    isDraggingWindow.current = false;
    dragStartRef.current = null;
  }, []);

  // Window resizing handlers
  const handleWindowResizeStart = useCallback((e: React.PointerEvent) => {
    if (windowMaximized || isMobile || !windowSize) return;
    isResizingWindow.current = true;
    resizeStartRef.current = { width: windowSize.width, height: windowSize.height, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }, [windowMaximized, isMobile, windowSize]);

  const handleWindowResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizingWindow.current || !resizeStartRef.current) return;
    const dx = e.clientX - resizeStartRef.current.px;
    const dy = e.clientY - resizeStartRef.current.py;
    const newWidth = Math.max(400, resizeStartRef.current.width + dx);
    const newHeight = Math.max(300, resizeStartRef.current.height + dy);
    setWindowSize({ width: newWidth, height: newHeight });
  }, []);

  const handleWindowResizeEnd = useCallback(() => {
    isResizingWindow.current = false;
    resizeStartRef.current = null;
  }, []);

  // Broadcast whiteboard open/close state to other participants
  const broadcastOpenState = useCallback((opened: boolean) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: opened ? 'WHITEBOARD_OPEN' : 'WHITEBOARD_CLOSE', 
      sender: participantName,
      timestamp: Date.now()
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: true }
    );
    console.log('[Whiteboard] Broadcast open state:', opened);
  }, [room, participantName]);

  // Broadcast when whiteboard opens
  useEffect(() => {
    if (isOpen && !hasAnnounceOpenRef.current) {
      hasAnnounceOpenRef.current = true;
      broadcastOpenState(true);
    } else if (!isOpen && hasAnnounceOpenRef.current) {
      hasAnnounceOpenRef.current = false;
      broadcastOpenState(false);
    }
  }, [isOpen, broadcastOpenState]);

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

  // Export as animated GIF (single frame - for future multi-frame support)
  const [isExportingGif, setIsExportingGif] = useState(false);
  
  const exportAsGif = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isExportingGif) return;
    
    setIsExportingGif(true);
    
    try {
      // Create a temporary canvas with background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      
      // Fill with dark background
      tempCtx.fillStyle = '#1a1a2e';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
      
      // Convert canvas to blob and download as animated GIF
      // Using built-in canvas.toBlob for now - for full GIF animation support,
      // would need gif.js library
      tempCanvas.toBlob((blob) => {
        if (!blob) {
          setIsExportingGif(false);
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `aplink-whiteboard-${Date.now()}.gif`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        setIsExportingGif(false);
      }, 'image/gif');
    } catch (error) {
      console.error('Failed to export GIF:', error);
      setIsExportingGif(false);
    }
  }, [isExportingGif]);

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
          
          // Clear canvas using queueMicrotask to avoid blocking React render cycle
          queueMicrotask(() => {
            const canvas = canvasRef.current;
            const ctx = contextRef.current;
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              console.log('[Whiteboard] Canvas cleared by remote:', sender);
            }
          });
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

  // Direct clear without confirmation dialog to prevent freezing
  const handleClear = useCallback(() => {
    // Prevent multiple clears
    if (isClearing || clearDebounceRef.current) {
      console.log('[Whiteboard] Clear already in progress, skipping');
      return;
    }
    
    // Block UI immediately
    setIsClearing(true);
    clearDebounceRef.current = true;
    
    // Generate unique clearId
    const clearId = `clear-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    
    // Add to processed BEFORE any other operation
    processedClearsRef.current.add(clearId);
    
    // Clear canvas synchronously
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      console.log('[Whiteboard] Local clear complete');
    }
    
    // Broadcast using requestIdleCallback to avoid blocking
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        broadcastClear(clearId);
        console.log('[Whiteboard] Broadcast clear via idle:', clearId);
      }, { timeout: 200 });
    } else {
      setTimeout(() => {
        broadcastClear(clearId);
        console.log('[Whiteboard] Broadcast clear via timeout:', clearId);
      }, 50);
    }
    
    // Unlock UI after 300ms
    setTimeout(() => {
      setIsClearing(false);
      clearDebounceRef.current = false;
    }, 300);
  }, [broadcastClear, isClearing]);

  // Keep confirmClear for backward compatibility but redirect to handleClear
  const confirmClear = handleClear;

  if (!isOpen) return null;

  // Essential tools for mobile (subset)
  const essentialTools = TOOLS.filter(t => ['pen', 'eraser'].includes(t.id));
  const mobileToolsToShow = isMobile ? essentialTools : TOOLS;

  // Window mode styling for desktop
  const windowStyle = windowMode && !isMobile && !windowMaximized && windowPos && windowSize
    ? { left: windowPos.x, top: windowPos.y, width: windowSize.width, height: windowSize.height }
    : undefined;

  const isWindowedDesktop = windowMode && !isMobile;

  // If windowMode on desktop, render floating window
  if (isWindowedDesktop) {
    return createPortal(
      <div
        ref={windowRef}
        className={cn(
          "fixed z-[99990] flex flex-col bg-black/95 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden",
          windowMaximized ? "inset-0 rounded-none" : "rounded-2xl"
        )}
        style={windowMaximized ? undefined : windowStyle}
      >
        {/* Title bar - draggable */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 cursor-grab active:cursor-grabbing select-none shrink-0"
          onPointerDown={handleWindowDragStart}
          onPointerMove={handleWindowDragMove}
          onPointerUp={handleWindowDragEnd}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-white/40" />
            <Pencil className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-white/90">Доска</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWindowMaximized(prev => !prev)}
              className="w-7 h-7 rounded-full hover:bg-white/10"
            >
              {windowMaximized ? (
                <Minimize2 className="w-4 h-4 text-white/70" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white/70" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-destructive/20"
            >
              <X className="w-4 h-4 text-white/70" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 border-b border-white/5 bg-black/40 shrink-0">
          {/* Color picker */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-5 h-5 rounded-full transition-all hover:scale-110",
                  color === c && "ring-2 ring-white ring-offset-1 ring-offset-black"
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
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  variant={tool === t.id ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setTool(t.id)}
                  className="w-8 h-8 rounded-full"
                  title={t.label}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleClear}
              disabled={isClearing}
              className="w-8 h-8 rounded-full hover:bg-destructive/20 hover:border-destructive/50"
              title="Очистить всё"
            >
              {isClearing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={exportAsImage}
              className="w-8 h-8 rounded-full"
              title="Скачать PNG"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={exportAsPDF}
              className="w-8 h-8 rounded-full"
              title="Скачать PDF"
            >
              <FileText className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Canvas - fills remaining space */}
        <div className="flex-1 p-2 overflow-hidden">
          <canvas 
            ref={canvasRef} 
            width={1280} 
            height={720}
            data-preserve-cursor
            className="w-full h-full rounded-xl border border-white/10 cursor-crosshair touch-none"
            style={{ 
              background: 'rgba(26, 26, 26, 0.8)',
              cursor: 'crosshair',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<HTMLCanvasElement>;
              handleMouseDown(mouseEvent);
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<HTMLCanvasElement>;
              handleMouseMove(mouseEvent);
            }}
            onTouchEnd={() => {
              handleMouseUp({} as React.MouseEvent<HTMLCanvasElement>);
            }}
          />
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/5 bg-black/20 shrink-0">
          <p className="text-xs text-muted-foreground text-center">
            Рисуйте вместе с другими участниками • Изменения видны всем в реальном времени
          </p>
        </div>

        {/* Resize handle (bottom-right) - only when not maximized */}
        {!windowMaximized && (
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
            onPointerDown={handleWindowResizeStart}
            onPointerMove={handleWindowResizeMove}
            onPointerUp={handleWindowResizeEnd}
          >
            <svg viewBox="0 0 20 20" className="w-full h-full text-white/20">
              <path d="M14 20L20 14M10 20L20 10M6 20L20 6" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
        )}
      </div>,
      document.body
    );
  }

  // Original fullscreen modal for mobile or non-window mode
  return createPortal(
    <>
      <div 
        className="fixed inset-0 z-[99990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-8" 
        data-preserve-cursor
        onClick={(e) => {
          // Click outside whiteboard panel to close (for mobile convenience)
          if (e.target === e.currentTarget) {
            // Don't auto-close on background tap - just let user use X button
          }
        }}
      >
        {/* ALWAYS VISIBLE floating close button - visible even in landscape */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="fixed top-4 right-4 z-[99999] w-12 h-12 rounded-full bg-destructive/40 hover:bg-destructive/60 border-2 border-destructive/60 shadow-lg"
        >
          <X className="w-6 h-6 text-white" />
        </Button>

        {/* Mobile landscape hint */}
        {isMobile && isPortrait && (
          <div className="absolute inset-0 z-[99998] bg-black/90 flex flex-col items-center justify-center gap-4 p-6">
            <RotateCcw className="w-16 h-16 text-primary animate-spin" style={{ animationDuration: '3s' }} />
            <h3 className="text-lg font-semibold text-white text-center">Поверните телефон</h3>
            <p className="text-sm text-muted-foreground text-center max-w-[280px]">
              Для лучшей работы с доской переверните устройство в альбомную ориентацию
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPortrait(false)} // Dismiss hint
              className="mt-4"
            >
              Продолжить в портретном режиме
            </Button>
          </div>
        )}
        
        <div className="bg-black/70 rounded-2xl sm:rounded-3xl border border-white/10 p-2 sm:p-4 w-full max-w-5xl flex flex-col gap-2 sm:gap-4" data-preserve-cursor>
          {/* Header - Mobile: simplified, Desktop: full toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <h3 className="text-sm sm:text-lg font-medium">Доска</h3>
            </div>
            
            {/* Mobile: Compact toolbar */}
            {isMobile ? (
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {/* Color picker popover */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="w-8 h-8 rounded-full border-2 border-white/30"
                      style={{ backgroundColor: color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="p-2 w-auto bg-black/80 border-white/10">
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setColor(c)}
                          className={cn(
                            "w-7 h-7 rounded-full transition-all",
                            color === c && "ring-2 ring-white ring-offset-1 ring-offset-black"
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                
                {/* Essential tools */}
                {mobileToolsToShow.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Button
                      key={t.id}
                      variant={tool === t.id ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setTool(t.id)}
                      className="w-9 h-9 rounded-full"
                    >
                      <Icon className="w-4 h-4" />
                    </Button>
                  );
                })}
                
                {/* Clear */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleClear}
                  disabled={isClearing}
                  className="w-9 h-9 rounded-full hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                
                {/* Close - always visible */}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-red-500/20 hover:bg-red-500/30"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              /* Desktop: Full toolbar */
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

                {/* Export GIF */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={exportAsGif}
                  disabled={isExportingGif}
                  className="w-10 h-10 rounded-full hover:bg-purple-500/20 hover:border-purple-500/50"
                  title="Скачать GIF"
                >
                  {isExportingGif ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  ) : (
                    <Film className="w-4 h-4 text-purple-400" />
                  )}
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
            )}
          </div>

          {/* Canvas */}
          <canvas 
            ref={canvasRef} 
            width={1280} 
            height={720}
            data-preserve-cursor
            className="w-full rounded-xl sm:rounded-2xl border border-white/10 cursor-crosshair touch-none"
            style={{ 
              aspectRatio: '16/9', 
              background: 'rgba(26, 26, 26, 0.8)',
              cursor: 'crosshair',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<HTMLCanvasElement>;
              handleMouseDown(mouseEvent);
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const mouseEvent = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent<HTMLCanvasElement>;
              handleMouseMove(mouseEvent);
            }}
            onTouchEnd={() => {
              handleMouseUp({} as React.MouseEvent<HTMLCanvasElement>);
            }}
          />

          {/* Instructions - hidden on mobile */}
          {!isMobile && (
            <p className="text-xs text-muted-foreground text-center">
              Рисуйте вместе с другими участниками • Изменения видны всем в реальном времени
            </p>
          )}
        </div>
      </div>

    </>,
    document.body
  );
}

export default CollaborativeWhiteboard;
