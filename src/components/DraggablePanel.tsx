import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GripHorizontal } from 'lucide-react';

interface DraggablePanelProps {
  children: ReactNode;
  className?: string;
  initialPosition?: { x: number; y: number };
  showHandle?: boolean;
  handleClassName?: string;
  storageKey?: string; // For persisting position
}

export function DraggablePanel({
  children,
  className,
  initialPosition,
  showHandle = true,
  handleClassName,
  storageKey,
}: DraggablePanelProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize position
  useEffect(() => {
    if (pos !== null) return;

    // Try to restore from storage
    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(`panel-pos-${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setPos(parsed);
          return;
        }
      } catch {}
    }

    // Use initial position or center
    if (initialPosition) {
      setPos(initialPosition);
    } else {
      // Default to center-top
      setPos({ 
        x: Math.max(0, (window.innerWidth - 300) / 2), 
        y: 100 
      });
    }
  }, [initialPosition, storageKey, pos]);

  // Persist position
  useEffect(() => {
    if (pos && storageKey) {
      try {
        sessionStorage.setItem(`panel-pos-${storageKey}`, JSON.stringify(pos));
      } catch {}
    }
  }, [pos, storageKey]);

  // Adjust on resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        if (!prev || !panelRef.current) return prev;
        const rect = panelRef.current.getBoundingClientRect();
        const margin = 12;
        return {
          x: Math.min(Math.max(margin, prev.x), window.innerWidth - rect.width - margin),
          y: Math.min(Math.max(margin, prev.y), window.innerHeight - rect.height - margin),
        };
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    draggingRef.current = true;
    startRef.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    const margin = 12;
    const nextX = Math.min(Math.max(margin, startRef.current.x + dx), window.innerWidth - rect.width - margin);
    const nextY = Math.min(Math.max(margin, startRef.current.y + dy), window.innerHeight - rect.height - margin);
    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    startRef.current = null;
  };

  if (!pos) return null;

  return (
    <div
      ref={panelRef}
      className={cn("fixed z-[99980]", className)}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle */}
      {showHandle && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1",
            "bg-white/10 hover:bg-white/20 rounded-full",
            "cursor-grab active:cursor-grabbing transition-colors",
            "flex items-center gap-1",
            handleClassName
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <GripHorizontal className="w-3 h-3 text-white/50" />
        </div>
      )}
      
      {/* Panel content with drag on header */}
      <div
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
