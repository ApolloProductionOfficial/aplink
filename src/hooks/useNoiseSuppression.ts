import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalParticipant, Track } from 'livekit-client';

interface UseNoiseSuppressionReturn {
  isEnabled: boolean;
  toggle: () => Promise<void>;
  applyToTrack: (participant: LocalParticipant) => Promise<void>;
}

export const useNoiseSuppression = (): UseNoiseSuppressionReturn => {
  const [isEnabled, setIsEnabled] = useState(true); // Enabled by default
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const highPassFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const applyToTrack = useCallback(async (participant: LocalParticipant) => {
    if (!isEnabled) return;

    try {
      const audioTrack = participant.getTrackPublication(Track.Source.Microphone)?.track;
      if (!audioTrack?.mediaStream) {
        console.log('[NoiseSuppression] No audio track available');
        return;
      }

      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      }

      const ctx = audioContextRef.current;

      // Create processing nodes
      sourceNodeRef.current = ctx.createMediaStreamSource(audioTrack.mediaStream);
      destinationNodeRef.current = ctx.createMediaStreamDestination();

      // High-pass filter to remove low-frequency rumble (< 80Hz)
      highPassFilterRef.current = ctx.createBiquadFilter();
      highPassFilterRef.current.type = 'highpass';
      highPassFilterRef.current.frequency.value = 80;
      highPassFilterRef.current.Q.value = 0.7;

      // Dynamic compressor for consistent volume
      compressorRef.current = ctx.createDynamicsCompressor();
      compressorRef.current.threshold.value = -24;
      compressorRef.current.knee.value = 12;
      compressorRef.current.ratio.value = 4;
      compressorRef.current.attack.value = 0.003;
      compressorRef.current.release.value = 0.25;

      // Gain node for volume boost
      gainNodeRef.current = ctx.createGain();
      gainNodeRef.current.gain.value = 1.2;

      // Connect the chain: source -> highpass -> compressor -> gain -> destination
      sourceNodeRef.current.connect(highPassFilterRef.current);
      highPassFilterRef.current.connect(compressorRef.current);
      compressorRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(destinationNodeRef.current);

      console.log('[NoiseSuppression] Audio processing chain applied');
    } catch (err) {
      console.error('[NoiseSuppression] Failed to apply processing:', err);
    }
  }, [isEnabled]);

  const toggle = useCallback(async () => {
    setIsEnabled((prev) => {
      const newState = !prev;
      console.log('[NoiseSuppression] Toggled to:', newState);
      return newState;
    });
  }, []);

  return {
    isEnabled,
    toggle,
    applyToTrack,
  };
};
