import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface KeyboardShortcutsConfig {
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onToggleLayoutMode?: () => void;
  onRaiseHand?: () => void;
  onToggleChat?: () => void;
  onLeaveCall?: () => void;
  onPinParticipant?: () => void;
  onTogglePiP?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for video calls
 * 
 * Shortcuts:
 * - M: Toggle microphone
 * - V: Toggle camera
 * - G: Toggle Grid/Focus/Webinar layout
 * - H: Raise/lower hand
 * - C: Toggle chat
 * - P: Pin/unpin focused participant
 * - I: Toggle Picture-in-Picture
 * - Escape (double): Leave call with confirmation
 * - ?: Show shortcuts help
 */
export function useKeyboardShortcuts({
  onToggleMic,
  onToggleCamera,
  onToggleLayoutMode,
  onRaiseHand,
  onToggleChat,
  onLeaveCall,
  onPinParticipant,
  onTogglePiP,
  enabled = true,
}: KeyboardShortcutsConfig) {
  // Track double-escape for leaving call
  const escapeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const escapeCountRef = useRef(0);
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement ||
      (e.target as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    // Don't trigger with modifier keys (except for specific combos)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'm':
        e.preventDefault();
        onToggleMic?.();
        break;
        
      case 'v':
        e.preventDefault();
        onToggleCamera?.();
        break;
        
      case 'g':
        e.preventDefault();
        onToggleLayoutMode?.();
        break;
        
      case 'h':
        e.preventDefault();
        onRaiseHand?.();
        break;
        
      case 'c':
        e.preventDefault();
        onToggleChat?.();
        break;

      case 'p':
        e.preventDefault();
        onPinParticipant?.();
        break;

      case 'i':
        e.preventDefault();
        onTogglePiP?.();
        break;
        
      case 'escape':
        e.preventDefault();
        if (onLeaveCall) {
          escapeCountRef.current += 1;
          
          if (escapeCountRef.current === 1) {
            // First escape - show warning
            toast('Нажмите Escape ещё раз для выхода', {
              id: 'leave-call-confirm',
              duration: 2000,
            });
            
            // Reset counter after 2 seconds
            escapeTimerRef.current = setTimeout(() => {
              escapeCountRef.current = 0;
            }, 2000);
          } else if (escapeCountRef.current >= 2) {
            // Second escape within timeout - leave call
            if (escapeTimerRef.current) {
              clearTimeout(escapeTimerRef.current);
            }
            escapeCountRef.current = 0;
            toast.dismiss('leave-call-confirm');
            onLeaveCall();
          }
        }
        break;
        
      case '?':
        // Show shortcuts help
        e.preventDefault();
        toast.info('Горячие клавиши', {
          description: 'M - микрофон, V - камера, G - режим, H - рука, C - чат, P - закрепить, I - PiP',
          duration: 4000,
        });
        break;
    }
  }, [onToggleMic, onToggleCamera, onToggleLayoutMode, onRaiseHand, onToggleChat, onLeaveCall, onPinParticipant, onTogglePiP]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (escapeTimerRef.current) {
        clearTimeout(escapeTimerRef.current);
      }
    };
  }, [enabled, handleKeyDown]);

  // Return a helper to show shortcuts tooltip
  return {
    showShortcutsHelp: () => {
      toast.info('Горячие клавиши', {
        description: 'M - микрофон | V - камера | G - режим | H - рука | C - чат | P - закрепить | I - PiP | ? - помощь',
        duration: 5000,
      });
    },
  };
}
