import { useState, useEffect, useMemo, useRef } from "react";
import { Video, Maximize2, PhoneOff, Mic, MicOff, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveCall } from "@/contexts/ActiveCallContext";
import { Track } from "livekit-client";

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
  const [isExpanded, setIsExpanded] = useState(true);
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const { liveKitRoom } = useActiveCall();
  const videoRef = useRef<HTMLVideoElement>(null);

  const size = useMemo(() => ({ 
    w: isExpanded ? 320 : 200, 
    h: isExpanded ? 200 : 56 
  }), [isExpanded]);

  // Get local video track and attach to video element
  useEffect(() => {
    if (!liveKitRoom || !videoRef.current || !isExpanded) return;

    const localParticipant = liveKitRoom.localParticipant;
    const cameraPub = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = cameraPub?.track;

    if (track) {
      track.attach(videoRef.current);
    }

    return () => {
      if (track && videoRef.current) {
        track.detach(videoRef.current);
      }
    };
  }, [liveKitRoom, isExpanded]);

  // Request Picture-in-Picture for remote participants when minimized
  useEffect(() => {
    if (!liveKitRoom || isExpanded) return;

    const requestPiP = async () => {
      try {
        // Find any remote participant's video
        const remoteParticipants = Array.from(liveKitRoom.remoteParticipants.values());
        for (const participant of remoteParticipants) {
          const cameraPub = participant.getTrackPublication(Track.Source.Camera);
          if (cameraPub?.track) {
            // Find video element for this track
            const videos = document.querySelectorAll('video[data-lk-source="camera"]');
            for (const video of videos) {
              const videoEl = video as HTMLVideoElement;
              if (!videoEl.hasAttribute('data-lk-local') && document.pictureInPictureEnabled) {
                try {
                  await videoEl.requestPictureInPicture();
                  return; // Success, exit
                } catch {
                  // Try next video
                }
              }
            }
          }
        }
      } catch (err) {
        console.log('[PiP] Could not request Picture-in-Picture:', err);
      }
    };

    // Delay to allow video elements to be ready
    const timeout = setTimeout(requestPiP, 500);
    return () => clearTimeout(timeout);
  }, [liveKitRoom, isExpanded]);

  // Initial position (bottom-right) once on client
  useEffect(() => {
    if (pos) return;
    const margin = 24;
    const x = Math.max(margin, window.innerWidth - size.w - margin);
    const y = Math.max(margin, window.innerHeight - size.h - margin);
    setPos({ x, y });
  }, [pos, size.w, size.h]);

  // Adjust position on resize or size change
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
    onResize(); // Also run on size change
    return () => window.removeEventListener('resize', onResize);
  }, [size.w, size.h]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!pos) return;
    draggingRef.current = true;
    startRef.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    const margin = 12;
    const nextX = Math.min(Math.max(margin, startRef.current.x + dx), window.innerWidth - size.w - margin);
    const nextY = Math.min(Math.max(margin, startRef.current.y + dy), window.innerHeight - size.h - margin);
    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    startRef.current = null;
  };

  return (
    <div
      data-minimized-widget
      className={cn(
        "fixed z-[9999] rounded-2xl overflow-hidden",
        "bg-card/95 backdrop-blur-xl border-2 border-primary/50",
        "shadow-[0_0_30px_hsl(var(--primary)/0.3)]",
        "transition-all duration-300 ease-out",
        isHovered ? "shadow-[0_0_40px_hsl(var(--primary)/0.5)]" : ""
      )}
      style={pos ? { 
        left: pos.x, 
        top: pos.y, 
        width: size.w, 
        height: size.h,
        transition: 'width 0.3s, height 0.3s',
        cursor: 'auto',
      } : { width: size.w, height: size.h, cursor: 'auto' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Force cursor visibility override for this widget */}
      <style>{`
        [data-minimized-widget],
        [data-minimized-widget] * {
          cursor: auto !important;
        }
        [data-minimized-widget] .cursor-grab,
        [data-minimized-widget] [data-draggable] {
          cursor: grab !important;
        }
        [data-minimized-widget] .cursor-grab:active,
        [data-minimized-widget] .active\\:cursor-grabbing:active,
        [data-minimized-widget] [data-draggable]:active {
          cursor: grabbing !important;
        }
        [data-minimized-widget] button {
          cursor: pointer !important;
        }
      `}</style>
      {/* Main content */}
      <div className="relative w-full h-full flex flex-col">
        {/* Video preview (expanded mode only) */}
        {isExpanded && (
          <div className="flex-1 relative bg-black/50 min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            
            {/* Top bar - draggable */}
            <div
              className="absolute top-0 left-0 right-0 flex items-center justify-between p-2 cursor-grab active:cursor-grabbing"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <span className="text-xs font-medium text-white/80 bg-black/40 px-2 py-1 rounded-full truncate max-w-[60%]">
                {roomName}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Свернуть"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Controls bar */}
        <div 
          className={cn(
            "flex items-center gap-2 p-2 bg-card/80",
            !isExpanded && "cursor-grab active:cursor-grabbing"
          )}
          onPointerDown={!isExpanded ? handlePointerDown : undefined}
          onPointerMove={!isExpanded ? handlePointerMove : undefined}
          onPointerUp={!isExpanded ? handlePointerUp : undefined}
        >
          {/* Collapsed mode: show expand button */}
          {!isExpanded && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center"
                title="Развернуть"
              >
                <Video className="w-4 h-4 text-primary" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-foreground">
                  🔊 {roomName}
                </p>
              </div>
            </>
          )}

          {/* Control buttons */}
          <div className={cn(
            "flex items-center gap-1.5",
            isExpanded && "flex-1 justify-center"
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

        {/* Bottom accent */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/50 to-primary animate-pulse" />
      </div>
    </div>
  );
}
