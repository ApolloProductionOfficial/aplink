import { useState, useEffect, useCallback, useRef } from "react";
import { Room } from "livekit-client";

interface UseNoiseSuggestionProps {
  room: Room | null;
  isNoiseSuppressionEnabled: boolean;
}

export const useNoiseSuggestion = ({
  room,
  isNoiseSuppressionEnabled,
}: UseNoiseSuggestionProps) => {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const noiseDetectionCountRef = useRef(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const dismissSuggestion = useCallback(() => {
    setShowSuggestion(false);
    setDismissed(true);
    
    // Store dismissal in session
    try {
      sessionStorage.setItem('noise_suggestion_dismissed', 'true');
    } catch { /* ignore */ }
  }, []);

  // Check if already dismissed
  useEffect(() => {
    try {
      if (sessionStorage.getItem('noise_suggestion_dismissed') === 'true') {
        setDismissed(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Don't show if already using noise suppression or dismissed
    if (isNoiseSuppressionEnabled || dismissed || !room) {
      setShowSuggestion(false);
      return;
    }

    const startNoiseDetection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          }
        });

        streamRef.current = stream;
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 1024;
        analyserRef.current.smoothingTimeConstant = 0.8;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        // Track noise levels over time
        const noiseSamples: number[] = [];
        const voiceSamples: number[] = [];

        checkIntervalRef.current = setInterval(() => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate energy in different frequency bands
          // Low frequencies (noise, rumble): 0-300Hz
          // Voice frequencies: 300-3000Hz
          let lowFreqSum = 0;
          let voiceFreqSum = 0;

          const sampleRate = audioContextRef.current?.sampleRate || 44100;
          const binSize = sampleRate / analyserRef.current.fftSize;

          for (let i = 0; i < dataArray.length; i++) {
            const freq = i * binSize;
            const value = dataArray[i] / 255;

            if (freq < 300) {
              lowFreqSum += value * value;
            } else if (freq >= 300 && freq <= 3000) {
              voiceFreqSum += value * value;
            }
          }

          const lowFreqEnergy = Math.sqrt(lowFreqSum / 50);
          const voiceEnergy = Math.sqrt(voiceFreqSum / 100);

          // Calculate overall RMS
          let totalSum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            totalSum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(totalSum / dataArray.length) / 255;

          // Track samples
          noiseSamples.push(lowFreqEnergy);
          voiceSamples.push(voiceEnergy);

          // Keep last 30 samples (about 3 seconds at 100ms interval)
          if (noiseSamples.length > 30) noiseSamples.shift();
          if (voiceSamples.length > 30) voiceSamples.shift();

          // Detect consistent background noise:
          // - Low frequency energy is present
          // - Not during active speech (voice energy is low)
          // - Overall RMS indicates some audio activity
          const avgNoise = noiseSamples.reduce((a, b) => a + b, 0) / noiseSamples.length;
          const avgVoice = voiceSamples.reduce((a, b) => a + b, 0) / voiceSamples.length;

          // Background noise detected if:
          // 1. Consistent low frequency energy > 0.03
          // 2. Voice energy is low (not speaking)
          // 3. Some overall audio activity
          if (avgNoise > 0.03 && avgVoice < 0.1 && rms > 0.02) {
            noiseDetectionCountRef.current++;

            // Show suggestion after 5 seconds of detected noise
            if (noiseDetectionCountRef.current >= 50 && !showSuggestion) {
              console.log('[NoiseSuggestion] Background noise detected, showing suggestion');
              setShowSuggestion(true);
            }
          } else {
            // Reset counter if noise stops
            noiseDetectionCountRef.current = Math.max(0, noiseDetectionCountRef.current - 1);
          }

        }, 100);

      } catch (error) {
        console.error('[NoiseSuggestion] Failed to start noise detection:', error);
      }
    };

    startNoiseDetection();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [room, isNoiseSuppressionEnabled, dismissed, showSuggestion]);

  // Auto-hide suggestion when noise suppression is enabled
  useEffect(() => {
    if (isNoiseSuppressionEnabled) {
      setShowSuggestion(false);
    }
  }, [isNoiseSuppressionEnabled]);

  return {
    showSuggestion,
    dismissSuggestion,
  };
};

export default useNoiseSuggestion;
