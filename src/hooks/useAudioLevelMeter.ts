import { useState, useEffect, useRef, useCallback } from 'react';
import { LocalParticipant, RemoteParticipant, Track, TrackPublication, ParticipantEvent } from 'livekit-client';

interface AudioLevelMeterOptions {
  /** How often to sample (ms) - default 50ms */
  sampleInterval?: number;
  /** Smoothing factor 0-1 (higher = smoother) - default 0.3 */
  smoothing?: number;
  /** FFT size for analyser - default 256 */
  fftSize?: number;
}

interface AudioLevelState {
  /** Normalized level 0-1 */
  level: number;
  /** Array of frequency bin levels (0-1) for equalizer visualization */
  frequencyBins: number[];
  /** Whether currently detecting voice activity */
  isActive: boolean;
}

/**
 * Hook to track real-time audio levels from a participant's microphone
 * Returns normalized level (0-1) and frequency bins for equalizer visualization
 */
export function useAudioLevelMeter(
  participant: LocalParticipant | RemoteParticipant | null,
  options: AudioLevelMeterOptions = {}
): AudioLevelState {
  const {
    sampleInterval = 50,
    smoothing = 0.3,
    fftSize = 256,
  } = options;

  const [state, setState] = useState<AudioLevelState>({
    level: 0,
    frequencyBins: new Array(24).fill(0), // 24 bins for full-height equalizer
    isActive: false,
  });

  // Track version to force re-setup when tracks change
  const [trackVersion, setTrackVersion] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLevelRef = useRef(0);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
  }, []);

  // Subscribe to track lifecycle events so we can re-init when mic appears/mutes/unmutes.
  // NOTE: Local tracks do NOT emit TrackPublished/TrackUnpublished; they emit LocalTrackPublished/LocalTrackUnpublished.
  useEffect(() => {
    if (!participant) return;

    const handleTrackChange = () => {
      console.log('[useAudioLevelMeter] Track changed, re-initializing...');
      setTrackVersion(v => v + 1);
    };

    participant.on(ParticipantEvent.TrackPublished, handleTrackChange);
    participant.on(ParticipantEvent.TrackSubscribed, handleTrackChange);
    participant.on(ParticipantEvent.TrackUnpublished, handleTrackChange);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackChange);
    participant.on(ParticipantEvent.LocalTrackPublished, handleTrackChange);
    participant.on(ParticipantEvent.LocalTrackUnpublished, handleTrackChange);
    participant.on(ParticipantEvent.TrackMuted, handleTrackChange);
    participant.on(ParticipantEvent.TrackUnmuted, handleTrackChange);

    return () => {
      participant.off(ParticipantEvent.TrackPublished, handleTrackChange);
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackChange);
      participant.off(ParticipantEvent.TrackUnpublished, handleTrackChange);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleTrackChange);
      participant.off(ParticipantEvent.LocalTrackPublished, handleTrackChange);
      participant.off(ParticipantEvent.LocalTrackUnpublished, handleTrackChange);
      participant.off(ParticipantEvent.TrackMuted, handleTrackChange);
      participant.off(ParticipantEvent.TrackUnmuted, handleTrackChange);
    };
  }, [participant]);

  useEffect(() => {
    if (!participant) {
      cleanup();
      setState({ level: 0, frequencyBins: new Array(24).fill(0), isActive: false });
      return;
    }

    const micPublication = participant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = micPublication?.track;

    console.log('[useAudioLevelMeter] Setup check:', {
      participantId: participant.identity,
      hasMicPublication: !!micPublication,
      hasAudioTrack: !!audioTrack,
      isMuted: micPublication?.isMuted,
      trackVersion,
    });

    if (!audioTrack || !micPublication || micPublication.isMuted) {
      cleanup();
      setState({ level: 0, frequencyBins: new Array(24).fill(0), isActive: false });
      return;
    }

    const mediaStreamTrack = audioTrack.mediaStreamTrack;
    if (!mediaStreamTrack) {
      console.warn('[useAudioLevelMeter] No mediaStreamTrack available');
      return;
    }

    console.log('[useAudioLevelMeter] Setting up audio analyser for:', participant.identity);

    // Setup audio analysis
    const setupAnalyser = async () => {
      try {
        // Cleanup previous setup first
        cleanup();

        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;
        
        // Resume if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
          console.log('[useAudioLevelMeter] Resuming suspended AudioContext');
          await audioContext.resume();
        }

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothing;

        const stream = new MediaStream([mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyserRef.current = analyser;
        sourceRef.current = source;

        console.log('[useAudioLevelMeter] Audio analyser setup complete');

        // Start monitoring
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const binCount = 24; // Number of equalizer bars (full height)
        const binsPerGroup = Math.floor(analyser.frequencyBinCount / binCount);

        let lastUpdateTime = 0;

        const analyze = (timestamp: number) => {
          if (!analyserRef.current) return;

          // Throttle updates
          if (timestamp - lastUpdateTime < sampleInterval) {
            animationFrameRef.current = requestAnimationFrame(analyze);
            return;
          }
          lastUpdateTime = timestamp;

          analyserRef.current.getByteFrequencyData(frequencyData);

          // Calculate overall level (RMS-like)
          let sum = 0;
          for (let i = 0; i < frequencyData.length; i++) {
            sum += frequencyData[i];
          }
          const rawLevel = sum / frequencyData.length / 255;

          // Smooth the level
          const smoothedLevel = lastLevelRef.current * smoothing + rawLevel * (1 - smoothing);
          lastLevelRef.current = smoothedLevel;

          // Calculate frequency bins for equalizer
          const bins: number[] = [];
          for (let i = 0; i < binCount; i++) {
            const start = i * binsPerGroup;
            const end = Math.min(start + binsPerGroup, frequencyData.length);
            let binSum = 0;
            for (let j = start; j < end; j++) {
              binSum += frequencyData[j];
            }
            // Normalize and apply boost for visual effect
            const binLevel = Math.min(1, (binSum / (end - start) / 255) * 2.0);
            bins.push(binLevel);
          }

          // Voice activity detection (simple threshold)
          const isActive = smoothedLevel > 0.015;

          setState({
            level: smoothedLevel,
            frequencyBins: bins,
            isActive,
          });

          animationFrameRef.current = requestAnimationFrame(analyze);
        };

        animationFrameRef.current = requestAnimationFrame(analyze);
      } catch (error) {
        console.error('[useAudioLevelMeter] Failed to setup analyser:', error);
      }
    };

    setupAnalyser();

    return cleanup;
  }, [participant, trackVersion, fftSize, sampleInterval, smoothing, cleanup]);

  return state;
}
