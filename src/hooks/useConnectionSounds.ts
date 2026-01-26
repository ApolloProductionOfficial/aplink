import { useCallback, useRef } from 'react';

// Create audio context and oscillator for connection sounds
const createSound = (frequency: number, duration: number, type: 'success' | 'error' | 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different wave types for different sounds
    oscillator.type = type === 'success' ? 'sine' : type === 'error' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Volume envelope - reduced volume (was 0.3, now 0.08)
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    // Cleanup
    setTimeout(() => {
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {
          // Ignore errors when closing already closed context
        });
      }
    }, duration * 1000 + 100);
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
};

export const useConnectionSounds = () => {
  const lastSoundRef = useRef<number>(0);
  const minInterval = 1000; // Minimum 1 second between sounds

  const playConnectedSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    // Play two ascending tones for "connected"
    createSound(523.25, 0.15, 'success'); // C5
    setTimeout(() => createSound(659.25, 0.2, 'success'), 150); // E5
  }, []);

  const playDisconnectedSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    // Soft descending tone for "disconnected" - gentle sine wave
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Use sine wave for softer sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(220, audioContext.currentTime + 0.4); // Glide down to A3
      
      // Very gentle volume envelope
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
      
      setTimeout(() => {
        if (audioContext.state !== 'closed') {
          audioContext.close().catch(() => {});
        }
      }, 500);
    } catch (e) {
      console.warn('Could not play disconnect sound:', e);
    }
  }, []);

  const playReconnectingSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    // Play a single warning tone
    createSound(440, 0.3, 'warning'); // A4
  }, []);

  const playMessageSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < 500) return; // 500ms between chat sounds
    lastSoundRef.current = now;
    
    // Pleasant double ping for new message
    createSound(880, 0.08, 'success');  // A5
    setTimeout(() => createSound(1046.5, 0.1, 'success'), 80); // C6
  }, []);

  return {
    playConnectedSound,
    playDisconnectedSound,
    playReconnectingSound,
    playMessageSound,
  };
};

export default useConnectionSounds;