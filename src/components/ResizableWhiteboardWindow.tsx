import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { GripHorizontal, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResizableWhiteboardWindowProps {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  storageKey?: string;
  minWidth?: number;
  minHeight?: number;
}

/**
 * A draggable and resizable floating window for whiteboards.
 * On desktop: Can be moved and resized. 
 * On mobile: Takes full screen (no dragging/resizing).
 */
export function ResizableWhiteboardWindow({
  children,
  isOpen,
  onClose,
  title = 'Доска',
  storageKey = 'whiteboard-window',
  minWidth = 400,
  minHeight = 300,
}: ResizableWhiteboardWindowProps) {
  const isMobile = useIsMobile();
  
  // Window state
  const [isMaximized, setIsMaximized] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  
  // Refs for dragging
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const resizeStart = useRef<{ width: number; height: number; px: number; py: number } | null>(null);

  // Initialize position and size
  useEffect(() => {
    if (!isOpen || isMobile) return;
    
    // Try to restore from storage
    if (storageKey && !pos && !size) {
      try {
        const saved = sessionStorage.getItem(`window-state-${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setPos(parsed.pos);
          setSize(parsed.size);
          setIsMaximized(parsed.isMaximized || false);
          return;
        }
      } catch {}
    }
    
    // Default: centered, 60% of screen
    if (!pos) {
      const defaultWidth = Math.min(1000, window.innerWidth * 0.6);
      const defaultHeight = Math.min(600, window.innerHeight * 0.6);
      setPos({
        x: (window.innerWidth - defaultWidth) / 2,
        y: (window.innerHeight - defaultHeight) / 2,
      });
      setSize({ width: defaultWidth, height: defaultHeight });
    }
  }, [isOpen, isMobile, storageKey, pos, size]);

  // Persist state
  useEffect(() => {
    if (pos && size && storageKey && !isMobile) {
      try {
        sessionStorage.setItem(`window-state-${storageKey}`, JSON.stringify({ pos, size, isMaximized }));
      } catch {}
    }
  }, [pos, size, isMaximized, storageKey, isMobile]);

  // Handle drag
  const handleDragStart = (e: React.PointerEvent) => {
    if (isMaximized || isMobile || !pos) return;
    isDragging.current = true;
    dragStart.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !dragStart.current || !windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    const margin = 20;
    const nextX = Math.min(Math.max(margin, dragStart.current.x + dx), window.innerWidth - rect.width - margin);
    const nextY = Math.min(Math.max(margin, dragStart.current.y + dy), window.innerHeight - rect.height - margin);
    setPos({ x: nextX, y: nextY });
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    dragStart.current = null;
  };

  // Handle resize
  const handleResizeStart = (e: React.PointerEvent) => {
    if (isMaximized || isMobile || !size) return;
    isResizing.current = true;
    resizeStart.current = { width: size.width, height: size.height, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing.current || !resizeStart.current) return;
    const dx = e.clientX - resizeStart.current.px;
    const dy = e.clientY - resizeStart.current.py;
    const newWidth = Math.max(minWidth, resizeStart.current.width + dx);
    const newHeight = Math.max(minHeight, resizeStart.current.height + dy);
    setSize({ width: newWidth, height: newHeight });
  };

  const handleResizeEnd = () => {
    isResizing.current = false;
    resizeStart.current = null;
  };

  // Toggle maximize
  const toggleMaximize = () => {
    if (isMobile) return;
    setIsMaximized(prev => !prev);
  };

  if (!isOpen) return null;

  // Mobile: Full screen overlay (same as before)
  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-[99990] bg-black/90 backdrop-blur-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
          <span className="text-sm font-medium">{title}</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: Floating resizable window
  const windowStyle = isMaximized
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos?.x ?? 100, top: pos?.y ?? 100, width: size?.width ?? 800, height: size?.height ?? 500 };

  return createPortal(
    <div
      ref={windowRef}
      className={cn(
        "fixed z-[99990] flex flex-col bg-black/90 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden",
        isMaximized ? "rounded-none" : "rounded-2xl"
      )}
      style={windowStyle}
    >
      {/* Title bar - draggable */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white/90">{title}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMaximize}
            className="w-7 h-7 rounded-full hover:bg-white/10"
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4 text-white/70" />
            ) : (
              <Maximize2 className="w-4 h-4 text-white/70" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-red-500/20"
          >
            <X className="w-4 h-4 text-white/70" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Resize handle (bottom-right) - only when not maximized */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
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

export default ResizableWhiteboardWindow;
