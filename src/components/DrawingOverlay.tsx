import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Pencil, Eraser, Trash2, X, Circle, Minus, MoveRight, Square, Undo2, Download, Crosshair, Video, Pause, Play, Square as StopIcon, MonitorUp } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

type Tool = 'pen' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'laser';

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
  { id: 'laser', icon: Crosshair, label: 'Указка' },
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
  
  // Laser pointer refs
  const laserPointsRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const laserAnimationRef = useRef<number | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isScreenRecording, setIsScreenRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);
  const screenChunksRef = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
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

    ctx.save();
    
    if (stroke.tool === 'eraser') {
      // Eraser uses destination-out with opaque color
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)'; // Must be opaque for destination-out
      ctx.lineWidth = stroke.size * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.from.x, stroke.from.y);
    ctx.lineTo(stroke.to.x, stroke.to.y);
    ctx.stroke();
    
    ctx.restore();
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

  // Export drawing as PNG
  const exportAsImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `aplink-screen-drawing-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  // Convert HEX to RGBA helper
  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Laser pointer drawing with smooth cosmic trail effect using current color
  const drawLaserPoints = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    
    const now = Date.now();
    const LASER_LIFETIME = 2000;
    
    // Filter old points
    laserPointsRef.current = laserPointsRef.current.filter(
      p => now - p.timestamp < LASER_LIFETIME
    );
    
    // Need at least 1 point to draw cursor glow
    if (laserPointsRef.current.length === 0) return;
    
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw smooth trail between consecutive points
    for (let i = 1; i < laserPointsRef.current.length; i++) {
      const prev = laserPointsRef.current[i - 1];
      const curr = laserPointsRef.current[i];
      const age = now - curr.timestamp;
      const alpha = 1 - (age / LASER_LIFETIME);
      
      // Outer glow
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = hexToRgba(color, alpha * 0.3);
      ctx.lineWidth = 20;
      ctx.stroke();
      
      // Middle glow
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = hexToRgba(color, alpha * 0.6);
      ctx.lineWidth = 10;
      ctx.stroke();
      
      // Core line
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // Always draw glowing cursor at the last point (visible even when stationary)
    const lastPoint = laserPointsRef.current[laserPointsRef.current.length - 1];
    const gradient = ctx.createRadialGradient(lastPoint.x, lastPoint.y, 0, lastPoint.x, lastPoint.y, 25);
    gradient.addColorStop(0, hexToRgba(color, 0.8));
    gradient.addColorStop(0.5, hexToRgba(color, 0.4));
    gradient.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // White core
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();
    
    ctx.restore();
  }, [color, hexToRgba]);

  // Broadcast laser point
  const broadcastLaserPoint = useCallback((point: { x: number; y: number; timestamp: number }) => {
    if (!room) return;
    const data = JSON.stringify({ 
      type: 'DRAWING_OVERLAY_LASER', 
      point,
      sender: participantName 
    });
    room.localParticipant.publishData(
      new TextEncoder().encode(data), 
      { reliable: false }
    );
  }, [room, participantName]);

  // Start canvas-only recording (existing)
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    try {
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      recordedChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `aplink-presentation-${Date.now()}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      };
      
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  // Start full screen + drawing overlay recording
  const startScreenRecording = useCallback(async () => {
    try {
      // Request screen capture - use type assertion for cursor option
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        } as MediaTrackConstraints,
        audio: true 
      });
      
      displayStreamRef.current = displayStream;
      
      // Create video element to capture screen
      const video = document.createElement('video');
      video.srcObject = displayStream;
      video.muted = true;
      await video.play();
      videoElementRef.current = video;
      
      // Create combined canvas
      const combinedCanvas = document.createElement('canvas');
      combinedCanvas.width = video.videoWidth || 1920;
      combinedCanvas.height = video.videoHeight || 1080;
      combinedCanvasRef.current = combinedCanvas;
      const ctx = combinedCanvas.getContext('2d')!;
      
      // Animation loop to combine screen + drawing canvas
      const drawFrame = () => {
        if (!videoElementRef.current || !combinedCanvasRef.current) return;
        
        ctx.drawImage(videoElementRef.current, 0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // Overlay the drawing canvas
        if (canvasRef.current) {
          ctx.drawImage(canvasRef.current, 0, 0, combinedCanvas.width, combinedCanvas.height);
        }
        
        if (isScreenRecording) {
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        }
      };
      
      drawFrame();
      setIsScreenRecording(true);
      
      // Start recording combined stream
      const combinedStream = combinedCanvas.captureStream(30);
      
      // Add audio from display stream if available
      displayStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
      
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      screenChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          screenChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `aplink-screen-recording-${Date.now()}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        // Cleanup
        if (displayStreamRef.current) {
          displayStreamRef.current.getTracks().forEach(track => track.stop());
          displayStreamRef.current = null;
        }
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = null;
          videoElementRef.current = null;
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        combinedCanvasRef.current = null;
      };
      
      recorder.start(100);
      screenRecorderRef.current = recorder;
      
      // Handle when user stops sharing
      displayStream.getVideoTracks()[0].onended = () => {
        stopScreenRecording();
      };
      
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      setIsScreenRecording(false);
    }
  }, [isScreenRecording]);

  // Stop screen recording
  const stopScreenRecording = useCallback(() => {
    if (screenRecorderRef.current) {
      screenRecorderRef.current.stop();
      screenRecorderRef.current = null;
    }
    setIsScreenRecording(false);
  }, []);

  // Toggle pause recording
  const togglePauseRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
    } else {
      mediaRecorderRef.current.pause();
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setIsPaused(false);
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
        } else if (message.type === 'DRAWING_OVERLAY_LASER' && message.sender !== participantName) {
          laserPointsRef.current.push(message.point);
        }
      } catch {
        // Ignore non-JSON data
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, isOpen, drawStroke, drawShape, participantName]);

  // Laser animation loop
  useEffect(() => {
    if (!isOpen) return;
    
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    let baseImageData: ImageData | null = null;
    
    const animate = () => {
      // Only run animation if there are laser points
      if (laserPointsRef.current.length > 0) {
        // Save current state if we haven't yet
        if (!baseImageData) {
          baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        
        // Restore base and draw laser
        ctx.putImageData(baseImageData, 0, 0);
        drawLaserPoints();
        
        // Clear base if no more points
        if (laserPointsRef.current.length === 0) {
          baseImageData = null;
        }
      } else {
        baseImageData = null;
      }
      
      laserAnimationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (laserAnimationRef.current) {
        cancelAnimationFrame(laserAnimationRef.current);
      }
    };
  }, [isOpen, drawLaserPoints]);

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
    const currentPoint = getPosition(e);

    // Laser tracks cursor movement even without mouse down (always visible)
    if (tool === 'laser') {
      const point = { x: currentPoint.x, y: currentPoint.y, timestamp: Date.now() };
      laserPointsRef.current.push(point);
      broadcastLaserPoint(point);
      return;
    }

    if (!isDrawing) return;

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
  }, [isDrawing, color, brushSize, tool, getPosition, drawStroke, drawShape, broadcastStroke, broadcastLaserPoint]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    // Laser doesn't need history save
    if (tool === 'laser') {
      setIsDrawing(false);
      return;
    }
    
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

      {/* Floating controls - positioned below main header panel, toggleable with slide animation */}
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)] transition-all duration-300",
          showControls 
            ? "top-20 opacity-100" 
            : "-top-20 opacity-0 pointer-events-none"
        )}
      >
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

          {/* Export */}
          <Button
            variant="ghost"
            size="icon"
            onClick={exportAsImage}
            className="w-8 h-8 rounded-full"
            title="Сохранить рисунок"
          >
            <Download className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-white/20" />

          {/* Recording controls - canvas only */}
          {!isRecording && !isScreenRecording ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={startRecording}
                className="w-8 h-8 rounded-full"
                title="Запись рисунков (canvas)"
              >
                <Video className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={startScreenRecording}
                className="w-8 h-8 rounded-full"
                title="Запись экрана + рисунки"
              >
                <MonitorUp className="w-4 h-4" />
              </Button>
            </>
          ) : isRecording ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePauseRecording}
                className="w-8 h-8 rounded-full"
                title={isPaused ? "Продолжить" : "Пауза"}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={stopRecording}
                className="w-8 h-8 rounded-full hover:bg-red-500/20"
                title="Остановить и сохранить"
              >
                <StopIcon className="w-4 h-4 text-red-400" />
              </Button>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400">REC</span>
              </div>
            </>
          ) : isScreenRecording ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={stopScreenRecording}
                className="w-8 h-8 rounded-full hover:bg-red-500/20"
                title="Остановить запись экрана"
              >
                <StopIcon className="w-4 h-4 text-red-400" />
              </Button>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                <MonitorUp className="w-3 h-3 text-green-400 animate-pulse" />
                <span className="text-xs text-green-400">ЭКРАН</span>
              </div>
            </>
          ) : null}

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
