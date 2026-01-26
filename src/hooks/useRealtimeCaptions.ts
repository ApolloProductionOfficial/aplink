import { useState, useEffect, useCallback, useRef } from "react";
import { Room, RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { getCachedTranscription, setCachedTranscription } from "@/utils/transcriptionCache";

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
  const recordingMimeTypeRef = useRef<string>('audio/webm');
  const [vadActive, setVadActive] = useState(false);

  // Process audio and get transcription with fallback and caching
  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    // Minimum 1.5KB for valid WebM - ultra-fast response
    if (!enabled || audioBlob.size < 1500) {
      console.log('[Captions] Audio too small:', audioBlob.size, 'bytes, skipping');
      return;
    }

    try {
      setIsProcessing(true);

      // Check cache first
      const cached = await getCachedTranscription(audioBlob);
      if (cached) {
        console.log('[Captions] Using cached transcription');
        
        const newCaption: Caption = {
          id: `${Date.now()}-cached`,
          speakerName: participantName,
          originalText: cached.originalText,
          translatedText: cached.translatedText,
          targetLang,
          timestamp: Date.now(),
        };

        setCaptions(prev => [...prev.slice(-9), newCaption]);
        
        // Broadcast cached caption
        if (room) {
          const captionData = { type: 'realtime_caption', caption: newCaption };
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify(captionData));
          try {
            await room.localParticipant.publishData(data, { reliable: true });
          } catch (err) {
            console.error('[Captions] Failed to broadcast cached caption:', err);
          }
        }
        
        return;
      }

      // Step 1: Transcribe with ElevenLabs (primary)
      const formData = new FormData();
      formData.append('audio', audioBlob, 'chunk.webm');

      let transcribeData: any = null;
      let transcribeError: any = null;

      try {
        const result = await supabase.functions.invoke('elevenlabs-transcribe', { body: formData });
        transcribeData = result.data;
        transcribeError = result.error;
      } catch (err) {
        console.log('[Captions] ElevenLabs invoke error:', err);
        transcribeError = err;
      }

      // Fallback to Whisper if ElevenLabs fails
      if (transcribeError || !transcribeData?.text) {
        console.log('[Captions] ElevenLabs failed, trying Whisper fallback...');
        
        try {
          const whisperFormData = new FormData();
          whisperFormData.append('audio', audioBlob, 'chunk.webm');
          
          const { data: whisperData, error: whisperError } = await supabase.functions.invoke(
            'whisper-transcribe',
            { body: whisperFormData }
          );

          if (!whisperError && whisperData?.text) {
            transcribeData = whisperData;
            transcribeError = null;
            console.log('[Captions] Whisper transcription successful');
          } else {
            console.error('[Captions] Whisper also failed:', whisperError);
            return;
          }
        } catch (whisperErr) {
          console.error('[Captions] Whisper invoke error:', whisperErr);
          return;
        }
      }

      if (!transcribeData?.text) {
        console.log('[Captions] No transcription from any provider');
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

      // Save to cache for future use
      await setCachedTranscription(audioBlob, corrected, translated);

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

        // Even more sensitive threshold for better detection
        const isSpeaking = rms > 0.01;
        
        // Debug logging every 60 frames (~1 second)
        if (Math.random() < 0.017) {
          console.log(`[Captions VAD] rms=${rms.toFixed(4)}, speaking=${isSpeaking}, active=${vadActiveRef.current}`);
        }

        if (isSpeaking && !vadActiveRef.current) {
          // Start recording
          vadActiveRef.current = true;
          setVadActive(true);
          recordingChunksRef.current = [];

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          try {
            // Determine best supported mimeType and save it
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=vp8,opus')) {
              mimeType = 'audio/webm;codecs=vp8,opus';
            }
            
            recordingMimeTypeRef.current = mimeType;
            console.log('[Captions] Using MIME type:', mimeType);
              
            mediaRecorderRef.current = new MediaRecorder(stream, {
              mimeType,
              audioBitsPerSecond: 128000,
            });

            mediaRecorderRef.current.ondataavailable = (e) => {
              if (e.data.size > 0) {
                recordingChunksRef.current.push(e.data);
              }
            };

            mediaRecorderRef.current.onstop = () => {
              if (recordingChunksRef.current.length > 0) {
                // CRITICAL: Use the SAME mimeType as MediaRecorder to preserve WebM container
                const blob = new Blob(recordingChunksRef.current, { 
                  type: recordingMimeTypeRef.current 
                });
                const chunksCount = recordingChunksRef.current.length;
                recordingChunksRef.current = []; // Clear immediately
                
                if (blob.size >= 2000) {
                  console.log('[Captions] Created valid blob:', chunksCount, 'chunks →', blob.size, 'bytes, type:', blob.type);
                  processAudioChunk(blob);
                } else {
                  console.log('[Captions] Recording too short, discarded:', blob.size, 'bytes');
                }
              } else {
                console.log('[Captions] No chunks to process');
              }
            };

            // Start without timeslice - collect all data until stop()
            // This creates a proper WebM container with headers
            mediaRecorderRef.current.start();
            isRecordingRef.current = true;
          } catch (err) {
            console.error('[Captions] Failed to start recording:', err);
          }

        } else if (!isSpeaking && vadActiveRef.current) {
          // Silence detected - wait a bit before stopping
          if (!silenceTimeoutRef.current) {
            silenceTimeoutRef.current = setTimeout(() => {
              vadActiveRef.current = false;
              setVadActive(false);
              silenceTimeoutRef.current = null;

              if (mediaRecorderRef.current && isRecordingRef.current) {
                // Request data before stopping to ensure we get all recorded content
                try {
                  mediaRecorderRef.current.requestData();
                } catch {
                  // Ignore if not supported
                }
                mediaRecorderRef.current.stop();
                isRecordingRef.current = false;
              }
            }, 600); // Slightly longer pause to capture complete phrases
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
    console.log('[Captions] Stopping VAD...');
    
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.log('[Captions] Error stopping MediaRecorder:', e);
      }
      mediaRecorderRef.current = null;
    }
    isRecordingRef.current = false;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.log('[Captions] Error closing AudioContext:', e);
      }
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    vadActiveRef.current = false;
    setVadActive(false);
    recordingChunksRef.current = [];
    
    console.log('[Captions] VAD stopped and cleaned up');
  }, []);

  // Start/stop VAD based on enabled state AND room availability
  // Using a unique key to force restart when room changes
  const roomIdentityRef = useRef<string | null>(null);
  
  useEffect(() => {
    const currentRoomIdentity = room?.localParticipant?.identity || null;
    const roomChanged = roomIdentityRef.current !== currentRoomIdentity;
    
    if (roomChanged) {
      console.log('[Captions] Room changed, resetting VAD. Was:', roomIdentityRef.current, 'Now:', currentRoomIdentity);
      roomIdentityRef.current = currentRoomIdentity;
      
      // Force stop old VAD first
      stopVAD();
    }
    
    if (enabled && room) {
      // Small delay to ensure clean state after stopVAD
      const timer = setTimeout(() => {
        startVAD();
      }, roomChanged ? 300 : 0);
      
      return () => {
        clearTimeout(timer);
        stopVAD();
      };
    } else {
      stopVAD();
    }

    return () => {
      stopVAD();
    };
  }, [enabled, room, startVAD, stopVAD]);

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
    vadActive, // Expose VAD state for UI indicator
  };
};

export default useRealtimeCaptions;
