import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Room, RoomEvent } from 'livekit-client';
import { Timer, Play, Pause, X, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MobileTooltip } from '@/components/ui/MobileTooltip';
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

const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 120;
const STORAGE_KEY = 'call-timer-position';

// Parse time string like "5:30" or "5" to seconds
const parseTimeInput = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  if (trimmed.includes(':')) {
    const [mins, secs] = trimmed.split(':').map(s => parseInt(s, 10));
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  }
  
  const mins = parseInt(trimmed, 10);
  if (isNaN(mins) || mins <= 0 || mins > 120) return null;
  return mins * 60;
};

// Format seconds to MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Get valid initial position - positioned under top panel
const getInitialPosition = (): { x: number; y: number } => {
  const defaultPos = {
    x: Math.max(0, (window.innerWidth - PANEL_WIDTH) / 2),
    y: 56  // Changed from 70 - now directly under top control panel (48px panel + 8px gap)
  };
  
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        parsed.x >= 0 &&
        parsed.x <= window.innerWidth - PANEL_WIDTH &&
        parsed.y >= 0 &&
        parsed.y <= window.innerHeight - PANEL_HEIGHT
      ) {
        return parsed;
      }
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  
  return defaultPos;
};

export function CallTimer({ room, isHost = true }: CallTimerProps) {
  // Timer state
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
  
  // Drag state - using refs for performance
  const panelRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(getInitialPosition());
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ offsetX: 0, offsetY: 0 });
  
  // Force re-render trigger for initial position
  const [, forceUpdate] = useState(0);
  
  // Apply initial position on mount
  useEffect(() => {
    if (panelRef.current) {
      const pos = positionRef.current;
      panelRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
  }, []);
  
  // Handle window resize - keep panel in bounds
  useEffect(() => {
    const handleResize = () => {
      const pos = positionRef.current;
      const newX = Math.max(0, Math.min(pos.x, window.innerWidth - PANEL_WIDTH));
      const newY = Math.max(0, Math.min(pos.y, window.innerHeight - PANEL_HEIGHT));
      
      if (newX !== pos.x || newY !== pos.y) {
        positionRef.current = { x: newX, y: newY };
        if (panelRef.current) {
          panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ x: newX, y: newY }));
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- DRAG HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current) return;
    
    // Calculate offset from pointer to panel top-left corner
    const rect = panelRef.current.getBoundingClientRect();
    dragStartRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };
    
    isDraggingRef.current = true;
    panelRef.current.setPointerCapture(e.pointerId);
    panelRef.current.style.cursor = 'grabbing';
    
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;
    
    // Calculate new position
    let newX = e.clientX - dragStartRef.current.offsetX;
    let newY = e.clientY - dragStartRef.current.offsetY;
    
    // Clamp to viewport bounds
    newX = Math.max(0, Math.min(newX, window.innerWidth - PANEL_WIDTH));
    newY = Math.max(0, Math.min(newY, window.innerHeight - PANEL_HEIGHT));
    
    // Update position ref
    positionRef.current = { x: newX, y: newY };
    
    // Update DOM directly for smooth movement
    panelRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;
    
    isDraggingRef.current = false;
    panelRef.current.releasePointerCapture(e.pointerId);
    panelRef.current.style.cursor = '';
    
    // Save position to storage
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positionRef.current));
  };

  // --- VOICE NOTIFICATION ---
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
            voiceId: 'JBFqnCBsd6RMkjVDRZzb',
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

  // --- LIVEKIT SYNC ---
  const broadcastTimerState = useCallback((state: TimerState & { type: string }) => {
    if (!room) return;
    const data = JSON.stringify(state);
    room.localParticipant.publishData(new TextEncoder().encode(data), { reliable: true });
  }, [room]);

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

  // --- TIMER CONTROLS ---
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
    hasPlayedVoiceRef.current = false;
    broadcastTimerState({ type: 'TIMER_START', ...newState });
    setIsOpen(false);
  }, [broadcastTimerState]);

  const togglePause = useCallback(() => {
    if (timerState.isPaused) {
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
      const newState: TimerState = {
        ...timerState,
        isPaused: true,
        pausedAt: remainingSeconds,
      };
      setTimerState(newState);
      broadcastTimerState({ type: 'TIMER_PAUSE', ...newState });
    }
  }, [timerState, remainingSeconds, broadcastTimerState]);

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

  const handleCustomTimeSubmit = useCallback(() => {
    const seconds = parseTimeInput(customTime);
    if (seconds && seconds > 0) {
      startTimer(seconds);
      setCustomTime('');
    }
  }, [customTime, startTimer]);

  // --- COUNTDOWN ---
  useEffect(() => {
    if (!timerState.endTime || timerState.isPaused) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerState.endTime! - Date.now()) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        playVoiceNotification();
        
        // Auto-hide after voice plays
        setTimeout(() => {
          if (panelRef.current) {
            panelRef.current.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            panelRef.current.style.opacity = '0';
          }
          
          setTimeout(() => {
            if (panelRef.current) {
              panelRef.current.style.transition = '';
              panelRef.current.style.opacity = '';
            }
            resetTimer();
            forceUpdate(n => n + 1);
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
      {/* Floating timer panel - DRAGGABLE */}
      {isActive && createPortal(
        <div 
          ref={panelRef}
          className={cn(
            "fixed top-0 left-0 z-[99980] rounded-2xl backdrop-blur-2xl border shadow-2xl select-none touch-none",
            isLow 
              ? "bg-red-500/30 border-red-500/50 shadow-red-500/50 animate-pulse" 
              : "bg-black/60 border-white/[0.08]"
          )}
          style={{ 
            transform: `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`,
            width: PANEL_WIDTH 
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Drag handle */}
          <div
            className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing border-b border-white/10"
            onPointerDown={handlePointerDown}
          >
            <GripHorizontal className="w-4 h-4 text-white/30" />
          </div>
          
          {/* Timer content */}
          <div className="flex items-center gap-4 px-6 py-3">
            <Timer className={cn("w-6 h-6 shrink-0", isLow ? "text-red-400" : "text-primary")} />
            <span className={cn(
              "text-3xl font-mono font-bold tabular-nums",
              isLow ? "text-red-400" : "text-white"
            )}>
              {formatTime(remainingSeconds)}
            </span>
            
            {isHost && (
              <div className="flex items-center gap-1 ml-auto">
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
        </div>,
        document.body
      )}

      {/* Timer control button (in toolbar) - with MobileTooltip */}
      <MobileTooltip content="Таймер звонка" side="bottom">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all",
                isActive 
                  ? "bg-primary/30 border border-primary/50" 
                  : "bg-white/10 hover:bg-white/20 border border-white/10"
              )}
            >
              <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
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
            <div className="pt-2 border-t border-white/10">
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
      </MobileTooltip>
    </>
  );
}
