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
  
  // Auto-hide panel timer
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  // Initialize canvas - CRITICAL: Re-acquire context on every isOpen change
  // This fixes the issue where Clear/Undo buttons stop working after minimize/maximize
  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;
    
    const canvas = canvasRef.current;
    
    // ALWAYS re-acquire context when overlay opens (important after minimize/maximize)
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('[DrawingOverlay] Failed to get canvas context');
      return;
    }
    
    // Set canvas size to full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    contextRef.current = ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Clear any stale laser state
    laserPointsRef.current = [];
    baseImageDataRef.current = null;
    
    // Save initial empty state
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    
    console.log('[DrawingOverlay] Canvas initialized:', canvas.width, 'x', canvas.height);
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

  // Broadcast clear to other participants (MUST be before clearCanvas)
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

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    let ctx = contextRef.current;
    
    // Re-acquire context if lost (can happen after minimize/maximize)
    if (!ctx && canvas) {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        contextRef.current = ctx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    
    if (!canvas || !ctx) {
      console.error('[DrawingOverlay] clearCanvas: canvas or context not available');
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    
    // Clear laser state too
    laserPointsRef.current = [];
    baseImageDataRef.current = null;
    
    broadcastClear();
    console.log('[DrawingOverlay] Canvas cleared');
  }, [broadcastClear]);

  // Undo last action
  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    let ctx = contextRef.current;
    
    // Re-acquire context if lost
    if (!ctx && canvas) {
      ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        contextRef.current = ctx;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    
    if (!ctx || !canvas || historyRef.current.length <= 1) {
      console.log('[DrawingOverlay] undo: nothing to undo or context lost');
      return;
    }
    
    historyRef.current.pop();
    const lastState = historyRef.current[historyRef.current.length - 1];
    if (lastState) {
      ctx.putImageData(lastState, 0, 0);
      console.log('[DrawingOverlay] Undo applied, history length:', historyRef.current.length);
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

  // Clear laser points AND cached image when color changes to prevent old color trails
  const baseImageDataRef = useRef<ImageData | null>(null);
  
  // Clear laser state when switching away from laser tool
  useEffect(() => {
    if (tool !== 'laser') {
      laserPointsRef.current = [];
      baseImageDataRef.current = null;
    }
  }, [tool]);
  
  useEffect(() => {
    laserPointsRef.current = [];
    // CRITICAL: Clear cached baseImageData so old laser trails don't persist
    baseImageDataRef.current = null;
  }, [color]);

  // Laser pointer drawing - small glowing dot (no logo)
  const drawLaserPoints = useCallback(() => {
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    
    if (laserPointsRef.current.length === 0) return;
    
    // Always use the last point
    const lastPoint = laserPointsRef.current[laserPointsRef.current.length - 1];
    // Only keep last point to prevent memory buildup
    laserPointsRef.current = [lastPoint];
    
    ctx.save();
    
    // SMALL radius (8px)
    const radius = 8;
    
    // Create radial gradient for glow effect
    const gradient = ctx.createRadialGradient(
      lastPoint.x, lastPoint.y, 0, 
      lastPoint.x, lastPoint.y, radius + 3
    );
    gradient.addColorStop(0, hexToRgba(color, 0.95));
    gradient.addColorStop(0.5, hexToRgba(color, 0.5));
    gradient.addColorStop(1, hexToRgba(color, 0));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, radius + 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Small white center dot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = hexToRgba(color, 0.9);
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
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
    // Prevent double-start
    if (isScreenRecording) {
      console.log('[DrawingOverlay] Already recording, skipping');
      return;
    }

    try {
      // Set state BEFORE getDisplayMedia to prevent race conditions
      setIsScreenRecording(true);
      
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
      
      // Use ref to track recording state inside animation loop
      let isActive = true;
      
      // Animation loop to combine screen + drawing canvas
      const drawFrame = () => {
        if (!isActive || !videoElementRef.current || !combinedCanvasRef.current) return;
        
        ctx.drawImage(videoElementRef.current, 0, 0, combinedCanvas.width, combinedCanvas.height);
        
        // Overlay the drawing canvas
        if (canvasRef.current) {
          ctx.drawImage(canvasRef.current, 0, 0, combinedCanvas.width, combinedCanvas.height);
        }
        
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
      
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
        isActive = false;
        
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
      
    } catch (error: any) {
      console.error('Failed to start screen recording:', error);
      setIsScreenRecording(false);
      
      // Show user-friendly error
      if (error.name === 'NotAllowedError') {
        // User cancelled - this is fine, just reset state
        console.log('[DrawingOverlay] User cancelled screen share');
      } else {
        // Actual error - could show toast if imported
        console.error('[DrawingOverlay] Screen recording error:', error.message);
      }
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

  // Laser animation loop - uses ref to persist baseImageData across color changes
  useEffect(() => {
    if (!isOpen) return;
    
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    
    const animate = () => {
      // Only run animation if there are laser points
      if (laserPointsRef.current.length > 0) {
        // Save current state if we haven't yet (use ref so it's cleared on color change)
        if (!baseImageDataRef.current) {
          baseImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }
        
        // Restore base and draw laser
        ctx.putImageData(baseImageDataRef.current, 0, 0);
        drawLaserPoints();
        
        // Clear base if no more points
        if (laserPointsRef.current.length === 0) {
          baseImageDataRef.current = null;
        }
      } else {
        baseImageDataRef.current = null;
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

  // Auto-hide panel after 3 seconds of inactivity
  const resetHideTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowControls(true);
    
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Start hide timer when overlay opens
  useEffect(() => {
    if (isOpen) {
      resetHideTimer();
    }
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isOpen, resetHideTimer]);

  // Handle mouse move for auto-show/hide
  const handleMouseMoveWithPanel = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Check if mouse is near top of screen (within 100px)
    if (e.clientY < 100) {
      resetHideTimer();
    }
    handleMouseMove(e);
  }, [handleMouseMove, resetHideTimer]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99995] pointer-events-auto" data-preserve-cursor>
      {/* Transparent canvas overlay */}
      <canvas 
        ref={canvasRef}
        data-preserve-cursor
        className="absolute inset-0 cursor-crosshair"
        style={{ cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveWithPanel}
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

          {/* Tool buttons - toggle on repeated click */}
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <Button
                key={t.id}
                variant={isActive ? 'default' : 'ghost'}
                size="icon"
                onClick={() => {
                  // Toggle: if already selected, go back to pen; otherwise select
                  if (isActive && t.id !== 'pen') {
                    setTool('pen');
                  } else {
                    setTool(t.id);
                  }
                }}
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

      {/* Instructions hint - positioned above bottom panel, synced visibility */}
      <div className={cn(
        "absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-full transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        showControls 
          ? "bottom-24 opacity-100"
          : "bottom-4 opacity-0 pointer-events-none"
      )}>
        <span className="text-xs font-normal text-white/90">
          <kbd className="px-2.5 py-1 bg-white/15 rounded-full text-white font-normal">ESC</kbd> выйти 
          <span className="mx-3 text-white/30">•</span>
          <kbd className="px-2.5 py-1 bg-white/15 rounded-full text-white font-normal">Ctrl+Z</kbd> отменить
          <span className="mx-3 text-white/30">•</span>
          <span className="text-primary/90 font-normal">Рисунки видны всем</span>
        </span>
      </div>
    </div>,
    document.body
  );
}

export default DrawingOverlay;
