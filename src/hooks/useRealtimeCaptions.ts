import { useState, useEffect, useCallback, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";

export interface Caption {
  id: string;
  speakerName: string;
  originalText: string;
  translatedText: string;
  targetLang: string;
  timestamp: number;
}

interface UseRealtimeCaptionsProps {
  room: Room | null;
  targetLang: string;
  participantName: string;
  enabled: boolean;
}

export const useRealtimeCaptions = ({
  room,
  targetLang,
  participantName,
  enabled,
}: UseRealtimeCaptionsProps) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const vadActiveRef = useRef(false);

  // Process audio and get transcription
  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    if (!enabled || audioBlob.size < 1000) return;

    try {
      setIsProcessing(true);

      // Step 1: Transcribe with ElevenLabs
      const formData = new FormData();
      formData.append('audio', audioBlob, 'chunk.webm');

      const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke(
        'elevenlabs-transcribe',
        { body: formData }
      );

      if (transcribeError || !transcribeData?.text) {
        console.log('[Captions] No transcription result');
        return;
      }

      const originalText = transcribeData.text.trim();
      if (!originalText || originalText.length < 2) return;

      console.log('[Captions] Transcribed:', originalText);

      // Step 2: Correct and translate with AI
      const { data: correctedData, error: correctError } = await supabase.functions.invoke(
        'correct-caption',
        {
          body: {
            originalText,
            targetLang,
            sourceLang: null, // auto-detect
          }
        }
      );

      if (correctError) {
        console.error('[Captions] Correction error:', correctError);
        return;
      }

      const corrected = correctedData?.corrected || originalText;
      const translated = correctedData?.translated || originalText;

      const newCaption: Caption = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        speakerName: participantName,
        originalText: corrected,
        translatedText: translated,
        targetLang,
        timestamp: Date.now(),
      };

      // Add to local captions
      setCaptions(prev => [...prev.slice(-9), newCaption]);

      // Broadcast to other participants via Data Channel
      if (room) {
        const captionData = {
          type: 'realtime_caption',
          caption: newCaption,
        };

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(captionData));

        try {
          await room.localParticipant.publishData(data, { reliable: true });
        } catch (err) {
          console.error('[Captions] Failed to broadcast caption:', err);
        }
      }

    } catch (error) {
      console.error('[Captions] Processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [enabled, room, targetLang, participantName]);

  // Listen for incoming captions from other participants
  useEffect(() => {
    if (!room || !enabled) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'realtime_caption' && message.caption) {
          const caption = message.caption as Caption;
          
          // Don't add our own captions again
          if (caption.speakerName === participantName) return;

          // Re-translate if needed
          if (caption.targetLang !== targetLang) {
            // For now, just show the translated text they sent
            // In production, you might want to re-translate
          }

          setCaptions(prev => [...prev.slice(-9), {
            ...caption,
            id: `received-${caption.id}`,
          }]);
        }
      } catch {
        // Not a caption message
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, enabled, participantName, targetLang]);

  // VAD-based recording
  const startVAD = useCallback(async () => {
    if (!enabled) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      mediaStreamRef.current = stream;

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const checkVoiceActivity = () => {
        if (!analyserRef.current || !enabled) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length) / 255;

        const isSpeaking = rms > 0.05; // Threshold for voice detection

        if (isSpeaking && !vadActiveRef.current) {
          // Start recording
          vadActiveRef.current = true;
          recordingChunksRef.current = [];

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          try {
            mediaRecorderRef.current = new MediaRecorder(stream, {
              mimeType: 'audio/webm;codecs=opus'
            });

            mediaRecorderRef.current.ondataavailable = (e) => {
              if (e.data.size > 0) {
                recordingChunksRef.current.push(e.data);
              }
            };

            mediaRecorderRef.current.onstop = () => {
              if (recordingChunksRef.current.length > 0) {
                const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
                processAudioChunk(blob);
              }
            };

            mediaRecorderRef.current.start(100);
            isRecordingRef.current = true;
          } catch (err) {
            console.error('[Captions] Failed to start recording:', err);
          }

        } else if (!isSpeaking && vadActiveRef.current) {
          // Silence detected - wait a bit before stopping
          if (!silenceTimeoutRef.current) {
            silenceTimeoutRef.current = setTimeout(() => {
              vadActiveRef.current = false;
              silenceTimeoutRef.current = null;

              if (mediaRecorderRef.current && isRecordingRef.current) {
                mediaRecorderRef.current.stop();
                isRecordingRef.current = false;
              }
            }, 1500); // 1.5s silence before stopping
          }
        } else if (isSpeaking && silenceTimeoutRef.current) {
          // Voice resumed - cancel silence timeout
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        if (enabled) {
          requestAnimationFrame(checkVoiceActivity);
        }
      };

      checkVoiceActivity();

    } catch (error) {
      console.error('[Captions] Failed to start VAD:', error);
    }
  }, [enabled, processAudioChunk]);

  const stopVAD = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    vadActiveRef.current = false;
  }, []);

  // Start/stop VAD based on enabled state
  useEffect(() => {
    if (enabled) {
      startVAD();
    } else {
      stopVAD();
    }

    return () => {
      stopVAD();
    };
  }, [enabled, startVAD, stopVAD]);

  // Clear old captions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCaptions(prev => prev.filter(c => now - c.timestamp < 30000)); // Keep 30 seconds
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
  }, []);

  return {
    captions,
    isProcessing,
    clearCaptions,
  };
};

export default useRealtimeCaptions;
