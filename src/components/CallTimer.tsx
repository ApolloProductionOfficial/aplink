import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { Timer, Play, Pause, RotateCcw, X } from 'lucide-react';
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

const TIMER_PRESETS = [
  { label: '1 мин', seconds: 60 },
  { label: '3 мин', seconds: 180 },
  { label: '5 мин', seconds: 300 },
  { label: '10 мин', seconds: 600 },
  { label: '15 мин', seconds: 900 },
  { label: '30 мин', seconds: 1800 },
];

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Countdown interval
  useEffect(() => {
    if (!timerState.endTime || timerState.isPaused) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerState.endTime! - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        // Play sound when timer ends
        try {
          audioRef.current = new Audio('/audio/timer-end.mp3');
          audioRef.current.volume = 0.5;
          audioRef.current.play().catch(() => {});
        } catch {}
        
        // Auto-reset after sound
        setTimeout(() => {
          resetTimer();
        }, 2000);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timerState.endTime, timerState.isPaused, resetTimer]);

  const isActive = timerState.endTime !== null || timerState.isPaused;
  const isLow = remainingSeconds > 0 && remainingSeconds <= 10;

  return (
    <>
      {/* Floating timer display when active */}
      {isActive && (
        <div 
          className={cn(
            "fixed top-24 left-1/2 -translate-x-1/2 z-[99980]",
            "px-6 py-3 rounded-2xl backdrop-blur-xl",
            "border border-white/20 shadow-2xl",
            "transition-all duration-300",
            isLow 
              ? "bg-red-500/30 border-red-500/50 animate-pulse" 
              : "bg-black/40"
          )}
        >
          <div className="flex items-center gap-4">
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
          className="w-64 p-4 bg-black/80 backdrop-blur-xl border-white/10"
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
