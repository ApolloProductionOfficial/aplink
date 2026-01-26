import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DraggablePiPProps {
  children: ReactNode;
  className?: string;
  storageKey?: string;
  snapToCorners?: boolean;
  onDoubleClick?: () => void;
  /** Container bounds - defaults to viewport */
  containerRef?: React.RefObject<HTMLElement>;
  /** Initial corner position */
  initialCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Offset from bottom for control bar */
  bottomOffset?: number;
}

interface Position {
  x: number;
  y: number;
}

const SNAP_DISTANCE = 60;
const PIP_WIDTH = 176; // w-44 = 11rem = 176px
const PIP_HEIGHT = 128; // h-32 = 8rem = 128px
const EDGE_PADDING = 16;

/**
 * Draggable Picture-in-Picture component
 * - Drag & drop with mouse/touch
 * - Snaps to corners with magnetic effect
 * - Saves position to sessionStorage
 * - Bounce animation on "landing"
 */
export function DraggablePiP({
  children,
  className,
  storageKey = 'pip-position',
  snapToCorners = true,
  onDoubleClick,
  initialCorner = 'bottom-right',
  bottomOffset = 112, // Default offset for control bar
}: DraggablePiPProps) {
  const pipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  
  // Calculate corner positions dynamically
  const getCorners = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    return {
      'top-left': { x: EDGE_PADDING, y: EDGE_PADDING + 80 }, // Offset for header
      'top-right': { x: viewportWidth - PIP_WIDTH - EDGE_PADDING, y: EDGE_PADDING + 80 },
      'bottom-left': { x: EDGE_PADDING, y: viewportHeight - PIP_HEIGHT - bottomOffset },
      'bottom-right': { x: viewportWidth - PIP_WIDTH - EDGE_PADDING, y: viewportHeight - PIP_HEIGHT - bottomOffset },
    };
  }, [bottomOffset]);

  // Initialize position
  useEffect(() => {
    // Try to load from storage first
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate saved position is within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        if (parsed.x >= 0 && parsed.x <= viewportWidth - PIP_WIDTH &&
            parsed.y >= 0 && parsed.y <= viewportHeight - PIP_HEIGHT) {
          setPosition(parsed);
          return;
        }
      } catch (e) {
        // Invalid saved position, use default
      }
    }
    
    // Use initial corner
    const corners = getCorners();
    setPosition(corners[initialCorner]);
  }, [storageKey, initialCorner, getCorners]);

  // Save position to storage
  useEffect(() => {
    if (position && !isDragging) {
      sessionStorage.setItem(storageKey, JSON.stringify(position));
    }
  }, [position, isDragging, storageKey]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (position) {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Keep PiP within bounds
        const newX = Math.min(Math.max(0, position.x), viewportWidth - PIP_WIDTH);
        const newY = Math.min(Math.max(0, position.y), viewportHeight - PIP_HEIGHT);
        
        if (newX !== position.x || newY !== position.y) {
          setPosition({ x: newX, y: newY });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const findNearestCorner = useCallback((x: number, y: number): Position | null => {
    if (!snapToCorners) return null;

    const corners = getCorners();
    let nearest: { position: Position; distance: number } | null = null;

    Object.values(corners).forEach((corner) => {
      const distance = Math.sqrt(Math.pow(corner.x - x, 2) + Math.pow(corner.y - y, 2));
      if (distance < SNAP_DISTANCE && (!nearest || distance < nearest.distance)) {
        nearest = { position: corner, distance };
      }
    });

    return nearest?.position || null;
  }, [snapToCorners, getCorners]);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (!position) return;
    
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate new position with bounds
    let newX = Math.min(Math.max(0, dragStartRef.current.posX + deltaX), viewportWidth - PIP_WIDTH);
    let newY = Math.min(Math.max(0, dragStartRef.current.posY + deltaY), viewportHeight - PIP_HEIGHT);

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || !position) return;

    setIsDragging(false);
    dragStartRef.current = null;

    // Snap to nearest corner
    const nearestCorner = findNearestCorner(position.x, position.y);
    if (nearestCorner) {
      setIsSnapping(true);
      setPosition(nearestCorner);
      setTimeout(() => setIsSnapping(false), 300);
    }
  }, [isDragging, position, findNearestCorner]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleDragStart(touch.clientX, touch.clientY);
    }
  }, [handleDragStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleDragMove(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!position) return null;

  return (
    <div
      ref={pipRef}
      className={cn(
        "fixed z-50 select-none touch-none",
        isDragging && "cursor-grabbing scale-105",
        !isDragging && "cursor-grab",
        isSnapping && "transition-all duration-300 ease-out",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={onDoubleClick}
    >
      {/* Drag handle indicator */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Content */}
      <div className="w-full h-full rounded-xl overflow-hidden shadow-[0_0_25px_hsl(var(--primary)/0.35)] border-2 border-primary/50">
        {children}
      </div>
      
      {/* Bounce effect overlay */}
      {isSnapping && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary/50 animate-ping pointer-events-none" />
      )}
    </div>
  );
}
