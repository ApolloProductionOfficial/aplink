import { useRef, useCallback, useEffect, useState } from 'react';
import { Room, LocalParticipant, DataPacket_Kind } from 'livekit-client';

interface UseLiveKitTranslationBroadcastReturn {
  isActive: boolean;
  isBroadcasting: boolean;
  startBroadcast: () => Promise<void>;
  stopBroadcast: () => void;
  playTranslatedAudio: (audioUrl: string) => Promise<void>;
  sendTranslationToParticipants: (audioBase64: string, text: string, originalText: string, sourceLang: string) => Promise<void>;
}

/**
 * Hook to broadcast translated audio to other LiveKit participants
 * Uses LiveKit's data channel for reliable delivery
 * FIX: Uses refs for room and broadcasting state to prevent stale closures
 */
export const useLiveKitTranslationBroadcast = (room: Room | null): UseLiveKitTranslationBroadcastReturn => {
  const [isActive, setIsActive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  // FIX: Use refs to prevent stale closure issues (same pattern as captions fix)
  const roomRef = useRef<Room | null>(null);
  const isBroadcastingRef = useRef(false);
  
  // Keep refs in sync
  roomRef.current = room;
  
  // Audio context for playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Audio queue for sequential playback
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Initialize audio context
  const initializeAudioContext = useCallback(async () => {
    if (audioContextRef.current) return;
    
    try {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      
      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 1.0;
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      console.log('[LiveKit Broadcast] Audio context initialized');
      setIsActive(true);
    } catch (error) {
      console.error('[LiveKit Broadcast] Failed to initialize audio context:', error);
    }
  }, []);

  // Start broadcasting
  const startBroadcast = useCallback(async () => {
    await initializeAudioContext();
    
    if (!roomRef.current) {
      console.warn('[LiveKit Broadcast] No room available');
      return;
    }

    isBroadcastingRef.current = true;
    setIsBroadcasting(true);
    console.log('[LiveKit Broadcast] Started');
  }, [initializeAudioContext]);

  // Stop broadcasting
  const stopBroadcast = useCallback(() => {
    isBroadcastingRef.current = false;
    setIsBroadcasting(false);
    console.log('[LiveKit Broadcast] Stopped');
  }, []);

  // Send translation to all participants via data channel
  // FIX: Auto-start broadcast if not yet started (lazy initialization)
  const sendTranslationToParticipants = useCallback(async (
    audioBase64: string,
    text: string,
    originalText: string,
    sourceLang: string
  ) => {
    const currentRoom = roomRef.current;
    
    if (!currentRoom) {
      console.warn('[LiveKit Broadcast] Cannot send - no room available');
      return;
    }
    
    // FIX: Auto-start broadcast if not active (lazy initialization)
    if (!isBroadcastingRef.current) {
      console.log('[LiveKit Broadcast] Auto-starting broadcast for translation send');
      await initializeAudioContext();
      isBroadcastingRef.current = true;
      setIsBroadcasting(true);
    }

    try {
      const payload = JSON.stringify({
        type: 'translation_audio',
        audioBase64,
        text,
        originalText,
        sourceLang,
        senderName: currentRoom.localParticipant.name || currentRoom.localParticipant.identity,
        timestamp: Date.now(),
      });

      const encoder = new TextEncoder();
      const data = encoder.encode(payload);

      await currentRoom.localParticipant.publishData(data, {
        reliable: true,
      });

      console.log('[LiveKit Broadcast] Translation sent to participants, text length:', text.length);
    } catch (error) {
      console.error('[LiveKit Broadcast] Failed to send translation:', error);
    }
  }, [initializeAudioContext]);

  // Play audio locally through mixer
  const playAudioLocally = useCallback(async (audioUrl: string) => {
    if (!audioContextRef.current || !gainNodeRef.current) {
      console.log('[LiveKit Broadcast] Audio context not ready, using fallback');
      const audio = new Audio(audioUrl);
      await audio.play();
      return;
    }

    try {
      // Fetch and decode the audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Create buffer source
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current);
      source.start(0);
      
      console.log('[LiveKit Broadcast] Playing audio locally');
      
      return new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('[LiveKit Broadcast] Failed to play audio:', error);
      // Fallback to regular audio
      const audio = new Audio(audioUrl);
      await audio.play();
    }
  }, []);

  // Process audio queue sequentially
  const processQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const audioUrl = audioQueueRef.current.shift()!;
    
    try {
      await playAudioLocally(audioUrl);
    } finally {
      isPlayingRef.current = false;
      processQueue();
    }
  }, [playAudioLocally]);

  // Main method to play translated audio
  const playTranslatedAudio = useCallback(async (audioUrl: string) => {
    audioQueueRef.current.push(audioUrl);
    processQueue();
  }, [processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {
          // Ignore errors when closing already closed context
        });
      }
    };
  }, []);

  return {
    isActive,
    isBroadcasting,
    startBroadcast,
    stopBroadcast,
    playTranslatedAudio,
    sendTranslationToParticipants,
  };
};
