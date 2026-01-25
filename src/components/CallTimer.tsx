import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Timer, Play, Pause, RotateCcw, X, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CallTimerProps {
  room: Room | null;
  isHost?: boolean;
}

interface TimerState {
  endTime: number | null;
  duration: number;
  isPaused: boolean;
  pausedAt: number | null;
}

interface Position {
  x: number;
  y: number;
}

const TIMER_PRESETS = [
  { label: '1 мин', seconds: 60 },
  { label: '3 мин', seconds: 180 },
  { label: '5 мин', seconds: 300 },
  { label: '10 мин', seconds: 600 },
  { label: '15 мин', seconds: 900 },
  { label: '30 мин', seconds: 1800 },
];

const EDGE_THRESHOLD = 50; // pixels from edge to show highlight

// Parse time string like "5:30" or "5" to seconds
const parseTimeInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Format: "MM:SS" or just "MM"
  if (trimmed.includes(':')) {
    const [mins, secs] = trimmed.split(':').map(s => parseInt(s, 10));
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  }
  
  // Just minutes
  const mins = parseInt(trimmed, 10);
  if (isNaN(mins) || mins <= 0 || mins > 120) return null;
  return mins * 60;
};

export function CallTimer({ room, isHost = true }: CallTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    endTime: null,
    duration: 0,
    isPaused: false,
    pausedAt: null,
  });
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const hasPlayedVoiceRef = useRef(false);

  // Dragging state
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize position from storage or default
  useEffect(() => {
    if (position !== null) return;
    
    try {
      const saved = sessionStorage.getItem('call-timer-position');
      if (saved) {
        setPosition(JSON.parse(saved));
        return;
      }
    } catch {}
    
    // Default: center-top
    setPosition({ 
      x: Math.max(0, (window.innerWidth - 300) / 2), 
      y: 100 
    });
  }, [position]);

  // Save position to storage
  useEffect(() => {
    if (position) {
      try {
        sessionStorage.setItem('call-timer-position', JSON.stringify(position));
      } catch {}
    }
  }, [position]);

  // Calculate edge proximity for visual feedback
  const edgeProximity = useMemo(() => {
    if (!position || !panelRef.current) return { left: false, right: false, top: false, bottom: false };
    
    const rect = panelRef.current.getBoundingClientRect();
    return {
      left: position.x < EDGE_THRESHOLD,
      right: position.x + rect.width > window.innerWidth - EDGE_THRESHOLD,
      top: position.y < EDGE_THRESHOLD,
      bottom: position.y + rect.height > window.innerHeight - EDGE_THRESHOLD,
    };
  }, [position]);

  // Global move handler
  const handleMove = useCallback((e: PointerEvent) => {
    if (!panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    
    let newX = e.clientX - dragOffsetRef.current.x;
    let newY = e.clientY - dragOffsetRef.current.y;
    
    // Constrain to screen bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
    newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));
    
    setPosition({ x: newX, y: newY });
  }, []);

  // Global up handler
  const handleUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('pointermove', handleMove);
    document.removeEventListener('pointerup', handleUp);
  }, [handleMove]);

  // Start dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    
    setIsDragging(true);
    
    // Attach global listeners
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    
    e.preventDefault();
    e.stopPropagation();
  }, [handleMove, handleUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [handleMove, handleUp]);
  
  // Play voice notification when timer ends
  const playVoiceNotification = useCallback(async () => {
    if (hasPlayedVoiceRef.current) return;
    hasPlayedVoiceRef.current = true;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: 'Время вышло!',
            voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George voice
          }),
        }
      );

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.volume = 0.7;
        await audio.play();
      }
    } catch (err) {
      console.log('[CallTimer] Voice notification failed:', err);
    }
  }, []);

  // Handle custom time input
  const handleCustomTimeSubmit = useCallback(() => {
    const seconds = parseTimeInput(customTime);
    if (seconds && seconds > 0) {
      startTimer(seconds);
      setCustomTime('');
    }
  }, [customTime]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Broadcast timer state to all participants
  const broadcastTimerState = useCallback((state: TimerState & { type: string }) => {
    if (!room) return;
    const data = JSON.stringify(state);
    room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: true });
  }, [room]);

  // Start timer
  const startTimer = useCallback((seconds: number) => {
    const endTime = Date.now() + seconds * 1000;
    const newState: TimerState = {
      endTime,
      duration: seconds,
      isPaused: false,
      pausedAt: null,
    };
    setTimerState(newState);
    setRemainingSeconds(seconds);
    broadcastTimerState({ type: 'TIMER_START', ...newState });
    setIsOpen(false);
  }, [broadcastTimerState]);

  // Pause/resume timer
  const togglePause = useCallback(() => {
    if (timerState.isPaused) {
      // Resume
      const newEndTime = Date.now() + remainingSeconds * 1000;
      const newState: TimerState = {
        ...timerState,
        endTime: newEndTime,
        isPaused: false,
        pausedAt: null,
      };
      setTimerState(newState);
      broadcastTimerState({ type: 'TIMER_RESUME', ...newState });
    } else {
      // Pause
      const newState: TimerState = {
        ...timerState,
        isPaused: true,
        pausedAt: remainingSeconds,
      };
      setTimerState(newState);
      broadcastTimerState({ type: 'TIMER_PAUSE', ...newState });
    }
  }, [timerState, remainingSeconds, broadcastTimerState]);

  // Reset timer
  const resetTimer = useCallback(() => {
    const newState: TimerState = {
      endTime: null,
      duration: 0,
      isPaused: false,
      pausedAt: null,
    };
    setTimerState(newState);
    setRemainingSeconds(0);
    broadcastTimerState({ type: 'TIMER_RESET', ...newState });
  }, [broadcastTimerState]);

  // Listen for timer events from other participants
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type?.startsWith('TIMER_')) {
          setTimerState({
            endTime: message.endTime,
            duration: message.duration,
            isPaused: message.isPaused,
            pausedAt: message.pausedAt,
          });
          
          if (message.type === 'TIMER_START' || message.type === 'TIMER_RESUME') {
            const remaining = Math.max(0, Math.ceil((message.endTime - Date.now()) / 1000));
            setRemainingSeconds(remaining);
          } else if (message.type === 'TIMER_PAUSE') {
            setRemainingSeconds(message.pausedAt || 0);
          } else if (message.type === 'TIMER_RESET') {
            setRemainingSeconds(0);
          }
        }
      } catch {}
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  // Reset voice played flag when timer starts
  useEffect(() => {
    if (timerState.endTime && !timerState.isPaused) {
      hasPlayedVoiceRef.current = false;
    }
  }, [timerState.endTime, timerState.isPaused]);

  // Countdown interval
  useEffect(() => {
    if (!timerState.endTime || timerState.isPaused) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerState.endTime! - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        // Play voice notification
        playVoiceNotification();
        
        // Auto-hide with animation after sound
        setTimeout(() => {
          // Fade out animation
          if (panelRef.current) {
            panelRef.current.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            panelRef.current.style.opacity = '0';
            panelRef.current.style.transform = 'scale(0.9)';
          }
          
          // Reset timer after animation completes
          setTimeout(() => {
            if (panelRef.current) {
              panelRef.current.style.transition = '';
              panelRef.current.style.opacity = '';
              panelRef.current.style.transform = '';
            }
            resetTimer();
          }, 500);
        }, 2500);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timerState.endTime, timerState.isPaused, resetTimer, playVoiceNotification]);

  const isActive = timerState.endTime !== null || timerState.isPaused;
  const isLow = remainingSeconds > 0 && remainingSeconds <= 10;

  return (
    <>
      {/* Floating timer display when active - DRAGGABLE */}
      {isActive && position && (
        <div 
          ref={panelRef}
          className={cn(
            "fixed z-[99980] rounded-2xl backdrop-blur-2xl border shadow-2xl",
            "transition-all duration-300",
            isLow 
              ? "bg-red-500/30 border-red-500/50 shadow-red-500/50 animate-pulse" 
              : "bg-black/60 border-white/[0.08]",
            isDragging && "shadow-primary/30 scale-105"
          )}
          style={{ left: position.x, top: position.y }}
        >
          {/* Edge proximity indicators */}
          {isDragging && (
            <>
              {edgeProximity.left && (
                <div className="fixed left-0 top-0 h-full w-1 bg-gradient-to-r from-primary/50 to-transparent pointer-events-none" />
              )}
              {edgeProximity.right && (
                <div className="fixed right-0 top-0 h-full w-1 bg-gradient-to-l from-primary/50 to-transparent pointer-events-none" />
              )}
              {edgeProximity.top && (
                <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-b from-primary/50 to-transparent pointer-events-none" />
              )}
              {edgeProximity.bottom && (
                <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-t from-primary/50 to-transparent pointer-events-none" />
              )}
            </>
          )}
          
          {/* Drag handle */}
          <div
            className="flex items-center justify-center py-1 cursor-grab active:cursor-grabbing border-b border-white/10"
            onPointerDown={handlePointerDown}
          >
            <GripHorizontal className="w-4 h-4 text-white/30" />
          </div>
          
          <div className="flex items-center gap-4 px-6 py-3">
            <Timer className={cn("w-6 h-6", isLow ? "text-red-400" : "text-primary")} />
            <span className={cn(
              "text-3xl font-mono font-bold tabular-nums",
              isLow ? "text-red-400" : "text-white"
            )}>
              {formatTime(remainingSeconds)}
            </span>
            
            {isHost && (
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={togglePause}
                >
                  {timerState.isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={resetTimer}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timer control button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "w-10 h-10 rounded-full transition-all",
              isActive 
                ? "bg-primary/30 border border-primary/50" 
                : "bg-white/10 hover:bg-white/20 border border-white/10"
            )}
            title="Таймер"
          >
            <Timer className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-64 p-4 bg-black/60 backdrop-blur-2xl border-white/[0.08] rounded-2xl"
          side="top"
          align="center"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Установить таймер</span>
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-red-400 hover:text-red-300"
                  onClick={resetTimer}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Сброс
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {TIMER_PRESETS.map((preset) => (
                <Button
                  key={preset.seconds}
                  variant="outline"
                  size="sm"
                  className="h-9 text-xs bg-white/5 border-white/10 hover:bg-white/15"
                  onClick={() => startTimer(preset.seconds)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Custom time input */}
            <div className="pt-2 border-t border-white/10 mt-2">
              <span className="text-xs text-muted-foreground">Своё значение (мин или мин:сек)</span>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="5:30"
                  className="flex-1 h-9 px-3 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomTimeSubmit();
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 bg-primary/20 border-primary/30 hover:bg-primary/30"
                  onClick={handleCustomTimeSubmit}
                  disabled={!parseTimeInput(customTime)}
                >
                  <Play className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
