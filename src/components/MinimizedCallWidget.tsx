import { useState, useEffect, useMemo, useRef } from "react";
import { Video, Maximize2, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MinimizedCallWidgetProps {
  roomName: string;
  isMuted?: boolean;
  onMaximize: () => void;
  onEndCall: () => void;
  onToggleMute?: () => void;
}

export function MinimizedCallWidget({
  roomName,
  isMuted = false,
  onMaximize,
  onEndCall,
  onToggleMute,
}: MinimizedCallWidgetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const size = useMemo(() => ({ w: 288, h: 88 }), []);

  // Initial position (bottom-right) once on client
  useEffect(() => {
    if (pos) return;
    const margin = 24;
    const x = Math.max(margin, window.innerWidth - size.w - margin);
    const y = Math.max(margin, window.innerHeight - size.h - margin);
    setPos({ x, y });
  }, [pos, size.w, size.h]);

  useEffect(() => {
    const onResize = () => {
      setPos((prev) => {
        if (!prev) return prev;
        const margin = 12;
        return {
          x: Math.min(Math.max(margin, prev.x), window.innerWidth - size.w - margin),
          y: Math.min(Math.max(margin, prev.y), window.innerHeight - size.h - margin),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size.w, size.h]);

  return (
    <div
      className={cn(
        "fixed z-[200] rounded-2xl overflow-hidden",
        "bg-card/95 backdrop-blur-xl border-2 border-primary/50",
        "shadow-[0_0_30px_hsl(var(--primary)/0.3)]",
        "transition-shadow duration-300 ease-out",
        isHovered ? "scale-105 shadow-[0_0_40px_hsl(var(--primary)/0.5)]" : ""
      )}
      style={pos ? { left: pos.x, top: pos.y, width: size.w, height: size.h } : { width: size.w, height: size.h }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main content */}
      <div className="relative w-full h-full">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 animate-shimmer" />
        
        {/* Content */}
        <div className="relative flex items-center gap-3 p-3 h-full">
          {/* Video icon with pulsing effect */}
          <button
            type="button"
            className="relative w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing"
            aria-label="Переместить окно звонка"
            onPointerDown={(e) => {
              if (!pos) return;
              draggingRef.current = true;
              startRef.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current || !startRef.current) return;
              const dx = e.clientX - startRef.current.px;
              const dy = e.clientY - startRef.current.py;
              const margin = 12;
              const nextX = Math.min(Math.max(margin, startRef.current.x + dx), window.innerWidth - size.w - margin);
              const nextY = Math.min(Math.max(margin, startRef.current.y + dy), window.innerHeight - size.h - margin);
              setPos({ x: nextX, y: nextY });
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              startRef.current = null;
            }}
          >
            <Video className="w-6 h-6 text-primary" />
          </button>

          {/* Room info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">
              🔊 Звонок активен
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {roomName}
            </p>
          </div>

          {/* Controls */}
          <div className={cn(
            "flex items-center gap-1.5 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-60"
          )}>
            {/* Mute toggle */}
            {onToggleMute && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-lg hover:bg-primary/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
              >
                {isMuted ? (
                  <MicOff className="w-4 h-4 text-destructive" />
                ) : (
                  <Mic className="w-4 h-4 text-primary" />
                )}
              </Button>
            )}

            {/* Maximize */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg hover:bg-primary/20"
              onClick={(e) => {
                e.stopPropagation();
                onMaximize();
              }}
              aria-label="Вернуться в комнату"
            >
              <Maximize2 className="w-4 h-4 text-primary" />
            </Button>

            {/* End call */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg hover:bg-destructive/20"
              onClick={(e) => {
                e.stopPropagation();
                onEndCall();
              }}
              aria-label="Сбросить вызов"
            >
              <PhoneOff className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-primary animate-pulse" />
    </div>
  );
}
