import { useState, useEffect } from "react";
import { Video, Maximize2, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";
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
  const [audioLevel, setAudioLevel] = useState(0);

  // Simulate audio activity
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[200] rounded-2xl overflow-hidden",
        "bg-card/95 backdrop-blur-xl border-2 border-primary/50",
        "shadow-[0_0_30px_hsl(var(--primary)/0.3)]",
        "transition-all duration-300 ease-out cursor-pointer",
        isHovered ? "scale-105 shadow-[0_0_40px_hsl(var(--primary)/0.5)]" : ""
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main content */}
      <div className="relative w-72 h-20">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 animate-shimmer" />
        
        {/* Content */}
        <div className="relative flex items-center gap-3 p-3 h-full">
          {/* Video icon with pulsing effect */}
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            {/* Audio activity indicator */}
            <div 
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"
              style={{
                boxShadow: `0 0 ${audioLevel / 10}px ${audioLevel / 20}px hsl(142, 76%, 36%, ${audioLevel / 100})`
              }}
            >
              <Volume2 className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

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
            >
              <PhoneOff className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Click hint */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <span className="text-sm font-medium text-white">Нажмите для возврата</span>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-primary animate-pulse" />
    </div>
  );
}
