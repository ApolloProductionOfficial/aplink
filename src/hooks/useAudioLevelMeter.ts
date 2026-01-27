import { useState, useEffect, useRef, useCallback } from 'react';
import { LocalParticipant, RemoteParticipant, Track } from 'livekit-client';

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
    frequencyBins: new Array(12).fill(0),
    isActive: false,
  });

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
    // Don't close audio context - might still be in use
  }, []);

  useEffect(() => {
    if (!participant) {
      cleanup();
      setState({ level: 0, frequencyBins: new Array(12).fill(0), isActive: false });
      return;
    }

    const micPublication = participant.getTrackPublication(Track.Source.Microphone);
    const audioTrack = micPublication?.track;

    if (!audioTrack || !micPublication || micPublication.isMuted) {
      cleanup();
      setState({ level: 0, frequencyBins: new Array(12).fill(0), isActive: false });
      return;
    }

    const mediaStreamTrack = audioTrack.mediaStreamTrack;
    if (!mediaStreamTrack) {
      return;
    }

    // Setup audio analysis
    const setupAnalyser = async () => {
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;
        
        // Resume if suspended (browser autoplay policy)
        if (audioContext.state === 'suspended') {
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

        // Start monitoring
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const binCount = 12; // Number of equalizer bars
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
            // Normalize and apply some boost for visual effect
            const binLevel = Math.min(1, (binSum / (end - start) / 255) * 1.5);
            bins.push(binLevel);
          }

          // Voice activity detection (simple threshold)
          const isActive = smoothedLevel > 0.02;

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
  }, [participant, fftSize, sampleInterval, smoothing, cleanup]);

  return state;
}
