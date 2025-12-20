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
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    // Cleanup
    setTimeout(() => {
      audioContext.close();
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
    
    // Play two descending tones for "disconnected"
    createSound(392, 0.15, 'error'); // G4
    setTimeout(() => createSound(293.66, 0.25, 'error'), 150); // D4
  }, []);

  const playReconnectingSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    // Play a single warning tone
    createSound(440, 0.3, 'warning'); // A4
  }, []);

  return {
    playConnectedSound,
    playDisconnectedSound,
    playReconnectingSound,
  };
};

export default useConnectionSounds;