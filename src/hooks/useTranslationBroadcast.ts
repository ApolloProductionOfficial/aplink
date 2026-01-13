import { useRef, useCallback, useEffect, useState } from 'react';

interface UseTranslationBroadcastReturn {
  isActive: boolean;
  isBroadcasting: boolean;
  startBroadcast: () => Promise<void>;
  stopBroadcast: () => void;
  playTranslatedAudio: (audioUrl: string) => Promise<void>;
  getMixedStream: () => MediaStream | null;
}

/**
 * Hook to create a WebRTC-compatible audio stream for broadcasting translated audio
 * This creates a separate audio track that can be injected into Jitsi
 */
export const useTranslationBroadcast = (jitsiApi: any): UseTranslationBroadcastReturn => {
  const [isActive, setIsActive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  // Audio context for mixing
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const originalTrackRef = useRef<MediaStreamTrack | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  
  // Audio queue for sequential playback
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  // Initialize audio context and mixing nodes
  const initializeAudioContext = useCallback(async () => {
    if (audioContextRef.current) return;
    
    try {
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      
      // Create destination for mixed audio (this creates a MediaStream)
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();
      
      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = 1.0;
      gainNodeRef.current.connect(destinationRef.current);
      
      mixedStreamRef.current = destinationRef.current.stream;
      
      console.log('Translation broadcast audio context initialized');
      setIsActive(true);
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }, []);

  // Start broadcasting - try to integrate with Jitsi audio
  const startBroadcast = useCallback(async () => {
    await initializeAudioContext();
    
    if (!mixedStreamRef.current) {
      console.error('No mixed stream available');
      return;
    }

    try {
      // Try to get Jitsi tracks if API is available
      if (jitsiApi) {
        const tracks = jitsiApi.getLocalTracks?.();
        const audioTrack = tracks?.find((t: any) => t.getType?.() === 'audio');
        
        if (audioTrack?.track) {
          originalTrackRef.current = audioTrack.track;
          
          // Connect original microphone to our mixer
          if (audioContextRef.current && gainNodeRef.current) {
            const micStream = new MediaStream([audioTrack.track]);
            const micSource = audioContextRef.current.createMediaStreamSource(micStream);
            micSource.connect(gainNodeRef.current);
            console.log('Connected Jitsi microphone to mixer');
          }
        }

        // Try to replace track (may not work with IFrame API)
        const mixedTrack = mixedStreamRef.current.getAudioTracks()[0];
        if (mixedTrack && typeof jitsiApi.replaceTrack === 'function') {
          try {
            await jitsiApi.replaceTrack(audioTrack, mixedTrack);
            console.log('Replaced Jitsi audio track with mixed stream');
          } catch (e) {
            console.log('replaceTrack not supported, using local playback only');
          }
        }
      }

      setIsBroadcasting(true);
      console.log('Translation broadcast started');
    } catch (error) {
      console.error('Failed to start broadcast:', error);
      // Still mark as broadcasting for local playback
      setIsBroadcasting(true);
    }
  }, [jitsiApi, initializeAudioContext]);

  // Stop broadcasting - restore original audio track
  const stopBroadcast = useCallback(() => {
    if (!jitsiApi) return;

    try {
      // Restore original track if we have it
      if (originalTrackRef.current) {
        const tracks = jitsiApi.getLocalTracks?.();
        const currentAudioTrack = tracks?.find((t: any) => t.getType?.() === 'audio');
        
        if (currentAudioTrack && jitsiApi.replaceTrack) {
          jitsiApi.replaceTrack(currentAudioTrack, originalTrackRef.current);
          console.log('Restored original audio track');
        }
      }

      setIsBroadcasting(false);
    } catch (error) {
      console.error('Failed to stop broadcast:', error);
    }
  }, [jitsiApi]);

  // Play translated audio through the broadcast channel
  const playAudioThroughMixer = useCallback(async (audioUrl: string) => {
    if (!audioContextRef.current || !gainNodeRef.current) {
      console.log('Audio context not ready, playing locally');
      const audio = new Audio(audioUrl);
      await audio.play();
      return;
    }

    try {
      // Fetch and decode the audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Create buffer source and connect to mixer
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      // Create a separate gain for translation audio (louder than mic)
      const translationGain = audioContextRef.current.createGain();
      translationGain.gain.value = 1.5; // Boost translation volume
      
      source.connect(translationGain);
      translationGain.connect(gainNodeRef.current);
      
      // Also play locally so user knows what's being sent
      const localGain = audioContextRef.current.createGain();
      localGain.gain.value = 0.3; // Quieter locally
      source.connect(localGain);
      localGain.connect(audioContextRef.current.destination);
      
      source.start(0);
      
      console.log('Playing translated audio through mixer');
      
      return new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch (error) {
      console.error('Failed to play audio through mixer:', error);
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
      await playAudioThroughMixer(audioUrl);
    } finally {
      isPlayingRef.current = false;
      processQueue();
    }
  }, [playAudioThroughMixer]);

  // Main method to play translated audio
  const playTranslatedAudio = useCallback(async (audioUrl: string) => {
    audioQueueRef.current.push(audioUrl);
    processQueue();
  }, [processQueue]);

  // Get the mixed stream for external use
  const getMixedStream = useCallback(() => {
    return mixedStreamRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isActive,
    isBroadcasting,
    startBroadcast,
    stopBroadcast,
    playTranslatedAudio,
    getMixedStream,
  };
};
