import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  source: string | null;
  severity: string;
  details?: Record<string, unknown> | null;
}

interface UseRealtimeErrorMonitorOptions {
  onNewError?: (error: ErrorLog) => void;
  playSound?: boolean;
  showToast?: boolean;
}

export const useRealtimeErrorMonitor = (options: UseRealtimeErrorMonitorOptions = {}) => {
  const { onNewError, playSound = true, showToast = true } = options;
  const { isAdmin } = useAuth();
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [newErrorCount, setNewErrorCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastErrorIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize error sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU9vT18=');
      // Create a simple alert beep using Web Audio API
      const createBeep = () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 880; // A5 note
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
          console.warn('Could not play error sound:', e);
        }
      };
      audioRef.current = { play: createBeep } as any;
    }
  }, []);

  // Play alert sound
  const playAlertSound = useCallback(() => {
    if (playSound && audioRef.current) {
      try {
        audioRef.current.play();
      } catch (e) {
        console.warn('Could not play error sound:', e);
      }
    }
  }, [playSound]);

  // Clear new error count
  const clearNewErrorCount = useCallback(() => {
    setNewErrorCount(0);
  }, []);

  // Subscribe to realtime error logs
  useEffect(() => {
    if (!isAdmin) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('realtime-error-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'error_logs',
        },
        (payload) => {
          const newError = payload.new as ErrorLog;

          // Avoid duplicate handling
          if (lastErrorIdRef.current === newError.id) return;
          lastErrorIdRef.current = newError.id;

          // Add to recent errors (keep last 10)
          setRecentErrors(prev => [newError, ...prev].slice(0, 10));
          setNewErrorCount(prev => prev + 1);

          // Only show notifications for error and critical severity
          if (newError.severity === 'error' || newError.severity === 'critical') {
            // Play sound for critical errors
            if (newError.severity === 'critical') {
              playAlertSound();
            }

            // Show toast notification
            if (showToast) {
              const icon = newError.severity === 'critical' ? '🚨' : '⚠️';
              toast.error(`${icon} ${newError.error_type}`, {
                description: newError.error_message.substring(0, 150) + (newError.error_message.length > 150 ? '...' : ''),
                duration: newError.severity === 'critical' ? 10000 : 5000,
                action: {
                  label: 'Подробнее',
                  onClick: () => {
                    console.log('Error details:', newError);
                  }
                }
              });
            }
          }

          // Call custom handler
          onNewError?.(newError);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('🔴 Realtime error monitoring connected');
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isAdmin, onNewError, playAlertSound, showToast]);

  return {
    recentErrors,
    isConnected,
    newErrorCount,
    clearNewErrorCount,
  };
};
