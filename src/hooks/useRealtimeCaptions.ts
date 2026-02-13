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
  isPartial?: boolean; // NEW: Indicates this is a partial/interim transcript
}

interface UseRealtimeCaptionsProps {
  room: Room | null;
  targetLang: string;
  participantName: string;
  enabled: boolean;
}

// WebSocket URL for ElevenLabs Scribe Realtime
// Docs: https://elevenlabs.io/docs/cookbooks/speech-to-text/streaming
const SCRIBE_WS_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionType extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionType, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionType, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionType, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionType, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionType;
    webkitSpeechRecognition: new () => SpeechRecognitionType;
  }
}

export const useRealtimeCaptions = ({
  room,
  targetLang,
  participantName,
  enabled,
}: UseRealtimeCaptionsProps) => {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vadActive, setVadActive] = useState(false);
  const [partialText, setPartialText] = useState<string>(""); // Live partial transcript
  
  // WebSocket and audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const tokenRef = useRef<string | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Web Speech API refs (PRIMARY - free, instant)
  const webSpeechRef = useRef<SpeechRecognitionType | null>(null);
  const useWebSpeechRef = useRef(true); // Try Web Speech API first
  
  // Credit exhaustion warning tracking
  const creditWarningShownRef = useRef(false);
  
  // For fallback to batch API if WebSocket fails
  const useFallbackRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const vadActiveRef = useRef(false);
  const recordingMimeTypeRef = useRef<string>('audio/webm');

  // Get single-use token for WebSocket connection
  const getScribeToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-scribe-token');
      
      if (error || !data?.token) {
        console.error('[Captions] Failed to get scribe token:', error || 'No token in response');
        return null;
      }
      
      console.log('[Captions] Got realtime scribe token');
      return data.token;
    } catch (err) {
      console.error('[Captions] Error getting scribe token:', err);
      return null;
    }
  }, []);

  // Translate committed transcript
  const translateText = useCallback(async (text: string): Promise<{ corrected: string; translated: string }> => {
    if (!text || text.length < 2) {
      return { corrected: text, translated: text };
    }

    try {
      const { data, error } = await supabase.functions.invoke('correct-caption', {
        body: { originalText: text, targetLang, sourceLang: null }
      });

      if (error) {
        // Check for 402 / credit exhaustion
        const errorName = (error as any)?.name || '';
        const errorContext = (error as any)?.context || {};
        const is402 = errorName === 'FunctionsHttpError' || errorContext?.status === 402;
        
        if (is402 && !creditWarningShownRef.current) {
          creditWarningShownRef.current = true;
          // Import toast dynamically to avoid circular deps
          const { toast } = await import('sonner');
          toast.warning('Кредиты AI исчерпаны', {
            description: 'Субтитры показывают оригинальный текст без перевода',
            duration: 8000,
          });
        }
        
        if (!is402) {
          console.error('[Captions] Translation error:', error);
        }
        return { corrected: text, translated: text };
      }

      return {
        corrected: data?.corrected || text,
        translated: data?.translated || text
      };
    } catch (err) {
      console.error('[Captions] Translation failed:', err);
      return { corrected: text, translated: text };
    }
  }, [targetLang]);

  // FIX Issue 1: Use ref for room to prevent stale closures in Web Speech callbacks
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;

  // Add caption to list and broadcast
  const addCaption = useCallback((originalText: string, translatedText: string, isPartial: boolean = false) => {
    const newCaption: Caption = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      speakerName: participantName,
      originalText,
      translatedText,
      targetLang,
      timestamp: Date.now(),
      isPartial,
    };

    // For partial, replace the last partial caption; for committed, add new
    if (isPartial) {
      setCaptions(prev => {
        const withoutLastPartial = prev.filter(c => !c.isPartial);
        return [...withoutLastPartial.slice(-9), newCaption];
      });
    } else {
      setCaptions(prev => [...prev.filter(c => !c.isPartial).slice(-9), newCaption]);
    }

    // Broadcast to other participants (only committed transcripts)
    // FIX: Use roomRef.current to always get the latest room reference
    const currentRoom = roomRef.current;
    if (currentRoom && !isPartial) {
      const captionData = { type: 'realtime_caption', caption: newCaption };
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(captionData));
      try {
        currentRoom.localParticipant.publishData(data, { reliable: true });
        console.log('[Captions] Broadcast caption to other participants');
      } catch (err) {
        console.error('[Captions] Failed to broadcast caption:', err);
      }
    }
  }, [participantName, targetLang]);

  // Process WebSocket message
  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'partial_transcript' && message.text) {
        // Show partial immediately (no translation yet)
        setPartialText(message.text);
        setVadActive(true);
        addCaption(message.text, message.text + '...', true);
        console.log('[Captions] Partial:', message.text);
      } 
      else if (message.type === 'committed_transcript' && message.text) {
        setPartialText("");
        setVadActive(false);
        setIsProcessing(true);
        
        try {
          // Translate the committed transcript
          const { corrected, translated } = await translateText(message.text);
          addCaption(corrected, translated, false);
          console.log('[Captions] Committed:', message.text, '→', translated);
        } catch (translateErr) {
          // Fallback: show original text
          addCaption(message.text, message.text, false);
          console.warn('[Captions] Translation failed, showing original:', translateErr);
        } finally {
          setIsProcessing(false);
        }
      }
      else if (message.type === 'error') {
        console.error('[Captions] WebSocket error:', message.error);
      }
    } catch (err) {
      console.error('[Captions] Failed to parse WebSocket message:', err);
    }
  }, [addCaption, translateText]);

  // Connect WebSocket to ElevenLabs Scribe Realtime
  const connectWebSocket = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[Captions] WebSocket already connected');
      return true;
    }

    // Get token
    const token = await getScribeToken();
    if (!token) {
      console.log('[Captions] No token, falling back to batch API');
      useFallbackRef.current = true;
      return false;
    }
    tokenRef.current = token;

    try {
      // Connect with token
      const wsUrl = `${SCRIBE_WS_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      return new Promise<boolean>((resolve) => {
        ws.onopen = () => {
          console.log('[Captions] WebSocket connected');
          isConnectedRef.current = true;
          
          // Send config message
          ws.send(JSON.stringify({
            type: 'configure',
            model_id: 'scribe_v2_realtime',
            audio_format: 'pcm_16000',
            sample_rate: 16000,
            channels: 1,
            commit_strategy: 'vad',
            vad_silence_threshold_secs: 0.5,
          }));
          
          resolve(true);
        };

        ws.onmessage = handleWebSocketMessage;

        ws.onerror = (error) => {
          console.error('[Captions] WebSocket error:', error);
          isConnectedRef.current = false;
          useFallbackRef.current = true;
          resolve(false);
        };

        ws.onclose = (event) => {
          console.log('[Captions] WebSocket closed:', event.code, event.reason);
          isConnectedRef.current = false;
          wsRef.current = null;
          
          // Try to reconnect if enabled
          if (enabled && !useFallbackRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[Captions] Attempting reconnect...');
              connectWebSocket();
            }, 3000);
          }
        };

        // Timeout if connection doesn't establish
        setTimeout(() => {
          if (!isConnectedRef.current) {
            console.log('[Captions] WebSocket connection timeout');
            ws.close();
            useFallbackRef.current = true;
            resolve(false);
          }
        }, 10000);
      });
    } catch (err) {
      console.error('[Captions] WebSocket connection failed:', err);
      useFallbackRef.current = true;
      return false;
    }
  }, [enabled, getScribeToken, handleWebSocketMessage]);

  // Start Web Speech API (PRIMARY - free, instant, works without tokens)
  // Issue 7 & 12: Add VAD logic to only restart recognition when user is actually speaking
  const startWebSpeechCapture = useCallback(() => {
    // Check if Web Speech API is available
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.log('[Captions] Web Speech API not available');
      return false;
    }
    
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ru-RU'; // Default to Russian, can be made dynamic
      recognition.maxAlternatives = 1;
      
      // Issue 7: Add watchdog to restart if no results but speaking
      const watchdogRef = { current: null as NodeJS.Timeout | null };
      
      const resetWatchdog = () => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
          if (isConnectedRef.current && recognition) {
            console.log('[Captions] Watchdog: No results for 8s, restarting...');
            try { recognition.stop(); } catch {}
          }
        }, 8000);
      };
      
      recognition.onstart = () => {
        console.log('[Captions] Web Speech API started');
        setVadActive(true);
        isConnectedRef.current = true;
        resetWatchdog();
      };
      
      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        // Show interim results immediately (partial)
        if (interimTranscript) {
          setPartialText(interimTranscript);
          setVadActive(true);
          addCaption(interimTranscript, interimTranscript + '...', true);
          resetWatchdog(); // Reset watchdog on activity
        }
        
        // Process final results - translate and show
        if (finalTranscript && finalTranscript.length > 2) {
          setPartialText("");
          setIsProcessing(true);
          try {
            const { corrected, translated } = await translateText(finalTranscript);
            addCaption(corrected, translated, false);
          } catch (translateErr) {
            addCaption(finalTranscript, finalTranscript, false);
            console.warn('[Captions] Translation failed, showing original:', translateErr);
          } finally {
            setIsProcessing(false);
            resetWatchdog(); // Reset watchdog on success
          }
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('[Captions] Web Speech API error:', event.error);
        // If Web Speech fails, try ElevenLabs as fallback
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          useWebSpeechRef.current = false;
          startElevenLabsCapture();
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          // Auto-restart on transient errors
          setTimeout(() => {
            if (enabled && webSpeechRef.current) {
              try {
                webSpeechRef.current.start();
              } catch (e) {
                console.warn('[Captions] Failed to restart Web Speech:', e);
              }
            }
          }, 500);
        }
      };
      
      recognition.onend = () => {
        console.log('[Captions] Web Speech API ended');
        setVadActive(false);
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        // Auto-restart if still enabled
        if (enabled && useWebSpeechRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              console.warn('[Captions] Failed to restart Web Speech:', e);
            }
          }, 100);
        }
      };
      
      recognition.start();
      webSpeechRef.current = recognition;
      return true;
    } catch (error) {
      console.error('[Captions] Failed to start Web Speech API:', error);
      return false;
    }
  }, [enabled, addCaption, translateText]);

  // Start ElevenLabs capture (FALLBACK - requires token and API)
  // NOTE: This function doesn't call startFallbackVAD directly to avoid circular dependency
  // Instead it sets useFallbackRef and the caller handles fallback
  const startElevenLabsCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        }
      });
      mediaStreamRef.current = stream;

      // Try WebSocket first
      const wsConnected = await connectWebSocket();
      
      if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[Captions] Using ElevenLabs realtime WebSocket streaming');
        
        // Create AudioContext for PCM extraction
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Use ScriptProcessorNode for PCM extraction
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Convert Float32 to Int16 PCM
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Send as base64
            const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              data: base64
            }));
          }
        };
        
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        return null; // WebSocket connected, no fallback needed
        
      } else {
        // Return stream for fallback VAD
        console.log('[Captions] WebSocket unavailable, returning stream for fallback');
        useFallbackRef.current = true;
        return stream;
      }

    } catch (error) {
      console.error('[Captions] Failed to start ElevenLabs capture:', error);
      return null;
    }
  }, [connectWebSocket]);

  // Fallback VAD-based recording (original implementation) - declared early so startRealtimeCapture can use it
  const startFallbackVADRef = useRef<((stream: MediaStream) => void) | null>(null);

  // Start audio capture and streaming - TRY WEB SPEECH FIRST (free, instant)
  const startRealtimeCapture = useCallback(async () => {
    if (!enabled) return;

    console.log('[Captions] Starting capture - trying Web Speech API first (free, instant)');
    
    // Try Web Speech API first (free, no token required, instant start)
    if (useWebSpeechRef.current) {
      const webSpeechStarted = startWebSpeechCapture();
      if (webSpeechStarted) {
        console.log('[Captions] Using Web Speech API (instant, free)');
        return;
      }
    }
    
    // Fall back to ElevenLabs
    console.log('[Captions] Web Speech unavailable, trying ElevenLabs');
    const fallbackStream = await startElevenLabsCapture();
    
    // If ElevenLabs returned a stream, it means WebSocket failed - use VAD fallback
    if (fallbackStream && startFallbackVADRef.current) {
      console.log('[Captions] Starting VAD fallback with stream');
      startFallbackVADRef.current(fallbackStream);
    }
  }, [enabled, startWebSpeechCapture, startElevenLabsCapture]);

  // Fallback VAD-based recording (original implementation)
  const startFallbackVAD = useCallback((stream: MediaStream) => {
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
      
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length) / 255;
      const isSpeaking = rms > 0.01;

      if (isSpeaking && !vadActiveRef.current) {
        vadActiveRef.current = true;
        setVadActive(true);
        recordingChunksRef.current = [];

        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        try {
          let mimeType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          }
          recordingMimeTypeRef.current = mimeType;
            
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
              const blob = new Blob(recordingChunksRef.current, { 
                type: recordingMimeTypeRef.current 
              });
              recordingChunksRef.current = [];
              
              if (blob.size >= 2000) {
                processAudioChunkFallback(blob);
              }
            }
          };

          mediaRecorderRef.current.start();
          isRecordingRef.current = true;
        } catch (err) {
          console.error('[Captions] Failed to start recording:', err);
        }

      } else if (!isSpeaking && vadActiveRef.current) {
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = setTimeout(() => {
            vadActiveRef.current = false;
            setVadActive(false);
            silenceTimeoutRef.current = null;

            if (mediaRecorderRef.current && isRecordingRef.current) {
              try {
                mediaRecorderRef.current.requestData();
              } catch {
                // Ignore
              }
              mediaRecorderRef.current.stop();
              isRecordingRef.current = false;
            }
          }, 800); // 0.8s silence threshold
        }
      } else if (isSpeaking && silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }

      if (enabled) {
        requestAnimationFrame(checkVoiceActivity);
      }
    };

    checkVoiceActivity();
  }, [enabled]);

  // Store ref for startFallbackVAD so it can be called from startRealtimeCapture
  startFallbackVADRef.current = startFallbackVAD;
  const processAudioChunkFallback = useCallback(async (audioBlob: Blob) => {
    if (!enabled || audioBlob.size < 500) return;

    try {
      setIsProcessing(true);

      // Check cache first
      const cached = await getCachedTranscription(audioBlob);
      if (cached) {
        addCaption(cached.originalText, cached.translatedText, false);
        setIsProcessing(false);
        return;
      }

      // Transcribe with ElevenLabs
      const formData = new FormData();
      formData.append('audio', audioBlob, 'chunk.webm');

      let transcribeData: any = null;

      try {
        const result = await supabase.functions.invoke('elevenlabs-transcribe', { body: formData });
        transcribeData = result.data;
      } catch (err) {
        console.error('[Captions] Transcription failed:', err);
      }

      // Fallback to Whisper
      if (!transcribeData?.text) {
        try {
          const whisperFormData = new FormData();
          whisperFormData.append('audio', audioBlob, 'chunk.webm');
          const { data } = await supabase.functions.invoke('whisper-transcribe', { body: whisperFormData });
          transcribeData = data;
        } catch {
          // Ignore
        }
      }

      if (!transcribeData?.text || transcribeData.text.length < 2) {
        setIsProcessing(false);
        return;
      }

      const { corrected, translated } = await translateText(transcribeData.text);
      await setCachedTranscription(audioBlob, corrected, translated);
      addCaption(corrected, translated, false);

    } catch (error) {
      console.error('[Captions] Processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [enabled, addCaption, translateText]);

  // Stop all capture
  const stopCapture = useCallback(() => {
    console.log('[Captions] Stopping capture...');
    
    // Stop Web Speech API
    if (webSpeechRef.current) {
      try {
        webSpeechRef.current.abort();
      } catch {
        // Ignore
      }
      webSpeechRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Ignore
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
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    isConnectedRef.current = false;
    vadActiveRef.current = false;
    setVadActive(false);
    setPartialText("");
    recordingChunksRef.current = [];
    
    console.log('[Captions] Capture stopped');
  }, []);

  // Listen for incoming captions from other participants
  useEffect(() => {
    if (!room || !enabled) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'realtime_caption' && message.caption) {
          const caption = message.caption as Caption;
          if (caption.speakerName === participantName) return;

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
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room, enabled, participantName]);

  // Start/stop based on enabled state - STARTS IMMEDIATELY when enabled
  const roomIdentityRef = useRef<string | null>(null);
  
  useEffect(() => {
    const currentRoomIdentity = room?.localParticipant?.identity || null;
    const roomChanged = roomIdentityRef.current !== currentRoomIdentity;
    
    if (roomChanged) {
      console.log('[Captions] Room changed, resetting');
      roomIdentityRef.current = currentRoomIdentity;
      stopCapture();
      useFallbackRef.current = false; // Reset fallback flag
    }
    
    // INSTANT START: Start capture immediately when enabled, no language selection required
    if (enabled && room) {
      console.log('[Captions] Starting capture immediately (enabled=true)');
      // Use minimal delay only for room changes to ensure stability
      const timer = setTimeout(() => {
        startRealtimeCapture();
      }, roomChanged ? 200 : 0); // Reduced delay for faster start
      
      return () => {
        clearTimeout(timer);
        stopCapture();
      };
    } else {
      stopCapture();
    }

    return () => { stopCapture(); };
  }, [enabled, room, startRealtimeCapture, stopCapture]);

  // Clear old captions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCaptions(prev => prev.filter(c => now - c.timestamp < 60000));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
    setPartialText("");
  }, []);

  return {
    captions,
    isProcessing,
    clearCaptions,
    vadActive,
    partialText, // NEW: Live partial transcript for UI
  };
};

export default useRealtimeCaptions;
