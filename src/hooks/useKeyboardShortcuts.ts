import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface KeyboardShortcutsConfig {
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onToggleLayoutMode?: () => void;
  onRaiseHand?: () => void;
  onToggleChat?: () => void;
  onLeaveCall?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for video calls
 * 
 * Shortcuts:
 * - M: Toggle microphone
 * - V: Toggle camera
 * - G: Toggle Grid/Focus layout
 * - H: Raise/lower hand
 * - C: Toggle chat
 * - Space (hold): Push-to-talk (not implemented in basic version)
 * - Escape: Leave call (with confirmation)
 */
export function useKeyboardShortcuts({
  onToggleMic,
  onToggleCamera,
  onToggleLayoutMode,
  onRaiseHand,
  onToggleChat,
  onLeaveCall,
  enabled = true,
}: KeyboardShortcutsConfig) {
  
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
        
      case 'escape':
        e.preventDefault();
        // Show confirmation before leaving
        if (onLeaveCall) {
          toast('Нажмите Escape ещё раз для выхода', {
            id: 'leave-call-confirm',
            duration: 2000,
          });
        }
        break;
        
      case '?':
        // Show shortcuts help
        e.preventDefault();
        toast.info('Горячие клавиши', {
          description: 'M - микрофон, V - камера, G - режим, H - рука, C - чат',
          duration: 4000,
        });
        break;
    }
  }, [onToggleMic, onToggleCamera, onToggleLayoutMode, onRaiseHand, onToggleChat, onLeaveCall]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Return a helper to show shortcuts tooltip
  return {
    showShortcutsHelp: () => {
      toast.info('Горячие клавиши', {
        description: 'M - микрофон | V - камера | G - режим | H - рука | C - чат | ? - помощь',
        duration: 5000,
      });
    },
  };
}
