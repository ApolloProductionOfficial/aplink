import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Languages, Mic, MicOff, Volume2, Loader2, X, Minimize2, Maximize2, 
  Download, History, Trash2, Play, Keyboard, Activity, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTranslation } from '@/hooks/useTranslation';
import { useTranslationBroadcast } from '@/hooks/useTranslationBroadcast';
import { cn } from '@/lib/utils';

interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  audioUrl?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  voiceId?: string;
  direction?: 'outgoing' | 'incoming';
}

interface RealtimeTranslatorProps {
  isActive: boolean;
  onToggle: () => void;
  roomId?: string;
  className?: string;
  jitsiApi?: any;
  onTranslatedAudio?: (audioUrl: string) => void;
  /** Whether to broadcast translations to other participants */
  broadcastToOthers?: boolean;
  /** Callback when receiving translated audio from another participant */
  onReceivedTranslation?: (audioBase64: string, senderName: string) => void;
}

// Language detection from text patterns
const detectLanguageFromText = (text: string): string | null => {
  const patterns: Record<string, RegExp> = {
    ru: /[а-яёА-ЯЁ]/,
    uk: /[іїєґІЇЄҐ]/,
    zh: /[\u4e00-\u9fff]/,
    ja: /[\u3040-\u309f\u30a0-\u30ff]/,
    ko: /[\uac00-\ud7af]/,
    ar: /[\u0600-\u06ff]/,
  };
  
  // Check for specific scripts first
  if (patterns.uk.test(text)) return 'uk';
  if (patterns.ru.test(text)) return 'ru';
  if (patterns.zh.test(text)) return 'zh';
  if (patterns.ja.test(text)) return 'ja';
  if (patterns.ko.test(text)) return 'ko';
  if (patterns.ar.test(text)) return 'ar';
  
  // Latin-based languages - check common words
  const latinPatterns: Record<string, RegExp[]> = {
    en: [/\b(the|is|are|was|were|have|has|this|that|with)\b/i],
    es: [/\b(el|la|los|las|es|está|son|una|uno|que|con)\b/i],
    de: [/\b(der|die|das|ist|sind|ein|eine|und|mit|für)\b/i],
    fr: [/\b(le|la|les|est|sont|un|une|et|avec|pour)\b/i],
    it: [/\b(il|la|i|le|è|sono|un|una|e|con|per)\b/i],
    pt: [/\b(o|a|os|as|é|são|um|uma|e|com|para)\b/i],
  };
  
  for (const [lang, regexes] of Object.entries(latinPatterns)) {
    if (regexes.some(r => r.test(text))) return lang;
  }
  
  return null;
};

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

const VOICES = [
  { id: 'female-sarah', name: 'Sarah', gender: 'female', color: 'bg-pink-500' },
  { id: 'female-laura', name: 'Laura', gender: 'female', color: 'bg-rose-500' },
  { id: 'female-alice', name: 'Alice', gender: 'female', color: 'bg-fuchsia-500' },
  { id: 'female-matilda', name: 'Matilda', gender: 'female', color: 'bg-purple-500' },
  { id: 'female-lily', name: 'Lily', gender: 'female', color: 'bg-violet-500' },
  { id: 'female-jessica', name: 'Jessica', gender: 'female', color: 'bg-indigo-500' },
  { id: 'male-daniel', name: 'Daniel', gender: 'male', color: 'bg-blue-500' },
  { id: 'male-george', name: 'George', gender: 'male', color: 'bg-cyan-500' },
  { id: 'male-charlie', name: 'Charlie', gender: 'male', color: 'bg-teal-500' },
  { id: 'male-liam', name: 'Liam', gender: 'male', color: 'bg-emerald-500' },
  { id: 'male-brian', name: 'Brian', gender: 'male', color: 'bg-green-500' },
  { id: 'male-chris', name: 'Chris', gender: 'male', color: 'bg-lime-500' },
  { id: 'neutral-river', name: 'River', gender: 'neutral', color: 'bg-amber-500' },
  { id: 'neutral-alloy', name: 'Roger', gender: 'neutral', color: 'bg-orange-500' },
];

const STORAGE_KEY = 'translator-settings';

interface StoredSettings {
  myLanguage: string;
  selectedVoice: string;
  pushToTalkMode: boolean;
}

const loadStoredSettings = (): Partial<StoredSettings> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveSettings = (settings: StoredSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
};

export const RealtimeTranslator: React.FC<RealtimeTranslatorProps> = ({
  isActive,
  onToggle,
  roomId,
  className,
  jitsiApi,
  broadcastToOthers = true, // default: broadcast translations to all participants
}) => {
  const { user } = useAuth();
  const { trackEvent } = useAnalytics();
  const { t } = useTranslation();
  
  // WebRTC broadcast - auto-enabled when translator is active
  const { 
    isBroadcasting, 
    startBroadcast, 
    stopBroadcast, 
    playTranslatedAudio: playThroughWebRTC 
  } = useTranslationBroadcast(jitsiApi);
  
  // State for broadcasting toggle
  const [enableBroadcast, setEnableBroadcast] = useState(broadcastToOthers);
  
  const storedSettings = loadStoredSettings();
  
  // Symmetric translation: user only selects their own language
  const [myLanguage, setMyLanguage] = useState(storedSettings.myLanguage || 'ru');
  const [detectedPartnerLanguage, setDetectedPartnerLanguage] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(storedSettings.selectedVoice || 'female-sarah');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingIncoming, setIsProcessingIncoming] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<TranslationEntry[]>([]);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [pushToTalkMode, setPushToTalkMode] = useState(storedSettings.pushToTalkMode ?? false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  
  // For incoming translation handling
  const incomingAudioQueueRef = useRef<string[]>([]);
  const isPlayingIncomingRef = useRef(false);
  
  // VAD settings
  const vadThreshold = 0.02;
  const silenceDuration = 2000;
  const minSpeechDuration = 300;
  const [isVadRecording, setIsVadRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const translationsEndRef = useRef<HTMLDivElement>(null);
  const pushToTalkRecordingRef = useRef(false);
  
  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const vadRecordingRef = useRef(false);

  // Auto-start WebRTC broadcast when translator becomes active
  useEffect(() => {
    if (isActive && jitsiApi && !isBroadcasting) {
      startBroadcast().catch(console.error);
    }
    if (!isActive && isBroadcasting) {
      stopBroadcast();
    }
  }, [isActive, jitsiApi, isBroadcasting, startBroadcast, stopBroadcast]);

  useEffect(() => {
    if (translationsEndRef.current) {
      translationsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [translations]);

  useEffect(() => {
    if (activeTab === 'history' && user) {
      loadHistory();
    }
  }, [activeTab, user]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    saveSettings({
      myLanguage,
      selectedVoice,
      pushToTalkMode,
    });
  }, [myLanguage, selectedVoice, pushToTalkMode]);

  const loadHistory = async () => {
    if (!user) return;
    
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('translation_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setHistoryItems(data?.map(item => ({
        id: item.id,
        originalText: item.original_text,
        translatedText: item.translated_text,
        timestamp: new Date(item.created_at),
        sourceLanguage: item.source_language || undefined,
        targetLanguage: item.target_language,
        voiceId: item.voice_id || undefined,
      })) || []);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error(t.translator.loadHistoryError);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveTranslation = async (entry: TranslationEntry) => {
    if (!user) return;

    try {
      await supabase.from('translation_history').insert({
        user_id: user.id,
        room_id: roomId || null,
        original_text: entry.originalText,
        translated_text: entry.translatedText,
        source_language: entry.sourceLanguage || myLanguage,
        target_language: entry.targetLanguage || detectedPartnerLanguage || 'en',
        voice_id: selectedVoice,
      });
    } catch (error) {
      console.error('Error saving translation:', error);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('translation_history')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setHistoryItems([]);
      toast.success(t.translator.historyCleared);
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error(t.translator.clearHistoryError);
    }
  };

  const exportHistory = () => {
    const items = historyItems.length > 0 ? historyItems : translations;
    if (items.length === 0) {
      toast.error(t.translator.noDataToExport);
      return;
    }

    const csv = [
      ['Время', 'Оригинал', 'Перевод', 'Язык источника', 'Язык перевода'].join(','),
      ...items.map(item => [
        item.timestamp.toISOString(),
        `"${item.originalText.replace(/"/g, '""')}"`,
        `"${item.translatedText.replace(/"/g, '""')}"`,
        item.sourceLanguage || 'auto',
        item.targetLanguage || detectedPartnerLanguage || 'en',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t.translator.historyExported);
  };

  const previewVoice = async () => {
    if (isPreviewingVoice) return;
    
    setIsPreviewingVoice(true);
    try {
      // Preview in partner's language (what they will hear)
      const previewLang = detectedPartnerLanguage || (myLanguage === 'ru' ? 'en' : 'ru');
      const sampleText = previewLang === 'ru' 
        ? 'Привет! Это пример моего голоса.' 
        : previewLang === 'en'
        ? 'Hello! This is a sample of my voice.'
        : previewLang === 'es'
        ? 'Hola! Este es un ejemplo de mi voz.'
        : previewLang === 'de'
        ? 'Hallo! Dies ist ein Beispiel meiner Stimme.'
        : previewLang === 'fr'
        ? 'Bonjour! Ceci est un exemple de ma voix.'
        : 'Hello! This is a sample of my voice.';

      const formData = new FormData();
      const silentBlob = new Blob([new Uint8Array(1000)], { type: 'audio/webm' });
      formData.append('audio', silentBlob, 'audio.webm');
      formData.append('targetLanguage', previewLang);
      formData.append('voiceId', selectedVoice);
      formData.append('previewText', sampleText);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-translate`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error('Preview failed');

      const result = await response.json();
      
      if (result.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
        const audio = new Audio(audioUrl);
        await audio.play();
      }
    } catch (error) {
      console.error('Voice preview error:', error);
      toast.error(t.translator.voicePreviewError);
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const audioUrl = audioQueueRef.current.shift()!;
    
    // Always try WebRTC broadcast first when in a call
    if (isBroadcasting) {
      try {
        await playThroughWebRTC(audioUrl);
        isPlayingRef.current = false;
        playNextAudio();
        return;
      } catch (e) {
        console.log('WebRTC playback failed, falling back to local');
      }
    }
    
    try {
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      audio.onerror = () => {
        isPlayingRef.current = false;
        playNextAudio();
      };
      
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(async () => {
          try {
            const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
            await silentAudio.play();
            silentAudio.pause();
            await audio.play();
          } catch {
            // Silent fail
          }
          isPlayingRef.current = false;
          playNextAudio();
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, [isBroadcasting, playThroughWebRTC]);

  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 2000) {
      console.log('Audio chunk too small, skipping...');
      return;
    }

    setIsProcessing(true);
    
    try {
      // For outgoing: translate from my language to partner's language
      const targetLang = detectedPartnerLanguage || (myLanguage === 'ru' ? 'en' : 'ru');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('targetLanguage', targetLang);
      formData.append('voiceId', selectedVoice);
      formData.append('sourceLanguage', myLanguage);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-translate`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error(`Translation failed: ${response.status}`);

      const result = await response.json();
      
      if (result.translatedText && result.translatedText.trim()) {
        // Auto-detect partner's language from our translation target
        if (result.detectedLanguage && result.detectedLanguage !== myLanguage) {
          // We detected a different language in our speech - update partner detection
          const detected = detectLanguageFromText(result.originalText);
          if (detected && detected !== myLanguage && !detectedPartnerLanguage) {
            console.log('Auto-detected partner language from context:', detected);
          }
        }
        
        const entry: TranslationEntry = {
          id: Date.now().toString(),
          originalText: result.originalText,
          translatedText: result.translatedText,
          timestamp: new Date(),
          sourceLanguage: myLanguage,
          targetLanguage: targetLang,
          voiceId: result.voiceId,
          direction: 'outgoing',
        };

        if (result.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
          entry.audioUrl = audioUrl;
          audioQueueRef.current.push(audioUrl);
          playNextAudio();
          
          // Broadcast audio to other participants via Jitsi data channel
          if (enableBroadcast && jitsiApi) {
            try {
              const translationPayload = JSON.stringify({
                type: 'translation_audio',
                audioBase64: result.audioContent,
                text: result.translatedText,
                originalText: result.originalText,
                lang: targetLang,
                sourceLang: myLanguage,
              });
              // Send to all participants via private message (empty recipient = broadcast)
              jitsiApi.executeCommand('sendChatMessage', translationPayload, '', { ignorePrivacy: true });
              console.log('Broadcast translation to other participants');
            } catch (e) {
              console.log('Could not broadcast translation:', e);
            }
          }
        }

        setTranslations(prev => [...prev.slice(-19), entry]);
        
        trackEvent({
          eventType: 'translation_completed',
          eventData: {
            source_language: myLanguage,
            target_language: targetLang,
            voice_id: selectedVoice,
            text_length: result.originalText?.length || 0,
            direction: 'outgoing',
          },
        });
        
        if (user) {
          await saveTranslation(entry);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [myLanguage, detectedPartnerLanguage, selectedVoice, playNextAudio, user, roomId, trackEvent, enableBroadcast, jitsiApi]);

  const startVadRecording = useCallback(() => {
    if (!streamRef.current || vadRecordingRef.current) return;
    
    console.log('VAD Recording: Starting');
    vadRecordingRef.current = true;
    setIsVadRecording(true);
    audioChunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      vadRecordingRef.current = false;
      setIsVadRecording(false);
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await processAudioChunk(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [processAudioChunk]);

  const stopVadRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startVad = useCallback(() => {
    if (!streamRef.current || vadIntervalRef.current) return;

    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 1024;
    analyserRef.current.smoothingTimeConstant = 0.2;

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    source.connect(analyserRef.current);

    const timeData = new Uint8Array(analyserRef.current.fftSize);
    let lastSpeaking = false;

    vadIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(timeData);

      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length);

      setAudioLevel(Math.min(100, rms * 500));

      if (pushToTalkMode) {
        if (lastSpeaking) {
          lastSpeaking = false;
          setIsSpeaking(false);
        }
        return;
      }

      const isAbove = rms > vadThreshold;
      if (isAbove !== lastSpeaking) {
        lastSpeaking = isAbove;
        setIsSpeaking(isAbove);
      }

      const now = Date.now();

      if (isAbove) {
        silenceStartRef.current = null;

        if (!speechStartRef.current) {
          speechStartRef.current = now;
        }

        if (!vadRecordingRef.current && (now - speechStartRef.current) >= minSpeechDuration) {
          startVadRecording();
        }
      } else {
        if (speechStartRef.current && !silenceStartRef.current) {
          silenceStartRef.current = now;
        }

        if (vadRecordingRef.current && silenceStartRef.current && (now - silenceStartRef.current) >= silenceDuration) {
          stopVadRecording();
          speechStartRef.current = null;
          silenceStartRef.current = null;
        }
      }
    }, 50);
  }, [pushToTalkMode, startVadRecording, stopVadRecording]);

  const stopVad = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
    speechStartRef.current = null;
    setIsSpeaking(false);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    if (isListening && streamRef.current && !pushToTalkMode) {
      stopVad();
      startVad();
    }
  }, [pushToTalkMode]);

  const startPushToTalk = useCallback(() => {
    if (!streamRef.current || pushToTalkRecordingRef.current) return;
    
    pushToTalkRecordingRef.current = true;
    setIsPushToTalkActive(true);
    
    audioChunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      pushToTalkRecordingRef.current = false;
      setIsPushToTalkActive(false);
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (pushToTalkMode && streamRef.current) {
        stopListeningInternal();
      }
      
      await processAudioChunk(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [processAudioChunk, pushToTalkMode]);

  const stopPushToTalk = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        },
      });

      streamRef.current = stream;
      setIsListening(true);

      if (pushToTalkMode) {
        toast.success(t.translator.pttActivated);
      } else {
        toast.success(t.translator.vadActivated);
      }

      startVad();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error(t.translator.micError);
    }
  }, [pushToTalkMode, startVad]);

  useEffect(() => {
    if (!pushToTalkMode) return;

    let isSpaceHeld = false;

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
    };

    const stopEvent = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isSpaceHeld) return;
      if (shouldIgnoreTarget(e.target)) return;

      stopEvent(e);
      isSpaceHeld = true;

      if (!isListening) {
        await startListening();
      }

      startPushToTalk();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !isSpaceHeld) return;
      if (shouldIgnoreTarget(e.target)) return;

      stopEvent(e);
      isSpaceHeld = false;
      stopPushToTalk();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [pushToTalkMode, isListening, startListening, startPushToTalk, stopPushToTalk]);

  const stopListeningInternal = useCallback(() => {
    stopVad();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  }, [stopVad]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopListeningInternal();
  }, [stopListeningInternal]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearTranslations = useCallback(() => {
    setTranslations([]);
  }, []);

  if (!isActive) return null;

  if (isMinimized) {
    return (
      <Card className={cn(
        "fixed bottom-4 right-4 z-50 w-auto bg-background/95 backdrop-blur border-primary/20 shadow-lg",
        className
      )}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            {isBroadcasting && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
            {pushToTalkMode && isPushToTalkActive && (
              <Badge variant="destructive" className="animate-pulse">
                <Mic className="h-3 w-3 mr-1" />
                REC
              </Badge>
            )}
            {!pushToTalkMode && isListening && (
              <Badge variant="default" className="bg-green-600">
                <Mic className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 w-[380px] max-h-[60vh] bg-background/95 backdrop-blur border-primary/20 shadow-lg flex flex-col",
      className
    )}>
      <CardContent className="p-3 flex flex-col gap-2 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">{t.translator.title}</span>
            {isBroadcasting && (
              <span className="flex items-center gap-1 text-[10px] text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
            )}
            {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="translate" className="text-xs">
              <Languages className="h-3 w-3 mr-1" />
              {t.translator.tabTranslate}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              {t.translator.tabHistory}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="translate" className="flex-1 flex flex-col gap-2 overflow-hidden mt-2">
            {/* Symmetric Translation - My Language */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground mb-1">{t.translator.myLanguage || 'Я говорю на'}</div>
                  <Select value={myLanguage} onValueChange={setMyLanguage}>
                    <SelectTrigger className="h-9 text-xs bg-muted/40 border-border/40">
                      <div className="flex items-center gap-1.5">
                        <span>{LANGUAGES.find(l => l.code === myLanguage)?.flag}</span>
                        <span className="truncate">{LANGUAGES.find(l => l.code === myLanguage)?.name}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col items-center justify-center pt-4">
                  <div className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3 text-primary" />
                    <ArrowRight className="h-3 w-3 text-primary rotate-180" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground mb-1">{t.translator.partnerLanguage || 'Собеседник'}</div>
                  <div className="h-9 px-3 flex items-center gap-1.5 text-xs bg-muted/20 border border-dashed border-border/40 rounded-md">
                    {detectedPartnerLanguage ? (
                      <>
                        <span>{LANGUAGES.find(l => l.code === detectedPartnerLanguage)?.flag}</span>
                        <span className="truncate">{LANGUAGES.find(l => l.code === detectedPartnerLanguage)?.name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 ml-auto">{t.translator.detected || 'Авто'}</Badge>
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">{t.translator.waitingForPartner || 'Ожидаю...'}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Manual partner language override */}
              {!detectedPartnerLanguage && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground">{t.translator.orSelectManually || 'Или выберите вручную:'}</span>
                  <div className="flex flex-wrap gap-1">
                    {LANGUAGES.filter(l => l.code !== myLanguage).slice(0, 4).map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => setDetectedPartnerLanguage(lang.code)}
                        className="px-2 py-0.5 rounded bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        {lang.flag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Voice */}
            <div className="flex gap-1.5">
              <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isListening}>
                <SelectTrigger className="h-9 text-xs flex-1 bg-muted/40 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="h-3 w-3 text-muted-foreground" />
                    <span>{VOICES.find(v => v.id === selectedVoice)?.name}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] font-semibold text-pink-500/80">{t.translator.femaleVoices}</div>
                  {VOICES.filter(v => v.gender === 'female').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", voice.color)} />
                        {voice.name}
                      </span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-semibold text-blue-500/80 mt-1">{t.translator.maleVoices}</div>
                  {VOICES.filter(v => v.gender === 'male').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", voice.color)} />
                        {voice.name}
                      </span>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-semibold text-amber-500/80 mt-1">{t.translator.neutralVoices}</div>
                  {VOICES.filter(v => v.gender === 'neutral').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", voice.color)} />
                        {voice.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 bg-muted/40 border-border/40"
                onClick={previewVoice}
                disabled={isPreviewingVoice || isListening}
              >
                {isPreviewingVoice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              </Button>
            </div>

            {/* Mode toggle + Broadcast toggle */}
            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => setPushToTalkMode(false)}
                  className={cn(
                    "h-9 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                    !pushToTalkMode 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/40 text-muted-foreground border border-border/40"
                  )}
                >
                  <Activity className="h-3 w-3" />
                  {t.translator.modeAuto}
                </button>
                <button
                  type="button"
                  onClick={() => setPushToTalkMode(true)}
                  className={cn(
                    "h-9 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
                    pushToTalkMode 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/40 text-muted-foreground border border-border/40"
                  )}
                >
                  <Keyboard className="h-3 w-3 hidden md:block" />
                  <Mic className="h-3 w-3 md:hidden" />
                  <span className="hidden md:inline">{t.translator.modeSpace}</span>
                  <span className="md:hidden">Удержать</span>
                </button>
              </div>
              
              {/* Broadcast toggle */}
              <Button
                variant={enableBroadcast ? "default" : "outline"}
                size="sm"
                onClick={() => setEnableBroadcast(b => !b)}
                className={cn(
                  "h-9 px-2 text-xs gap-1",
                  enableBroadcast ? "bg-green-600 hover:bg-green-700" : ""
                )}
                title={enableBroadcast ? "Трансляция включена — другие слышат перевод" : "Трансляция выключена — только вы слышите"}
              >
                <Volume2 className="h-3 w-3" />
                <span className="hidden sm:inline">{enableBroadcast ? 'Всем' : 'Себе'}</span>
              </Button>
            </div>
            
            {/* iOS Audio Unlock Button */}
            {!audioUnlocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const silentAudio = new Audio(
                      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
                    );
                    await silentAudio.play();
                    silentAudio.pause();
                    setAudioUnlocked(true);
                    toast.success("Звук разблокирован! Переводы будут воспроизводиться автоматически.");
                  } catch (e) {
                    console.error("Failed to unlock audio:", e);
                    toast.error("Не удалось разблокировать звук. Попробуйте ещё раз.");
                  }
                }}
                className="h-8 text-xs bg-yellow-500/10 border-yellow-500/50 hover:bg-yellow-500/20 text-yellow-600"
              >
                <Volume2 className="h-3 w-3 mr-1.5" />
                Включить звук (для iPhone)
              </Button>
            )}

            {/* Audio level when listening */}
            {isListening && !pushToTalkMode && (
              <div className="flex items-center gap-2 px-1">
                <Mic className={cn(
                  "h-3 w-3 shrink-0",
                  isSpeaking ? "text-green-500" : "text-muted-foreground",
                  isVadRecording && "animate-pulse"
                )} />
                <div className={cn(
                  "flex-1 h-1.5 bg-muted rounded-full overflow-hidden",
                  isVadRecording && "ring-1 ring-green-500/50"
                )}>
                  <div 
                    className={cn(
                      "h-full transition-all duration-75 rounded-full",
                      audioLevel > vadThreshold * 500 ? "bg-green-500" : "bg-primary/40"
                    )}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                {isVadRecording && (
                  <span className="text-[10px] text-green-500 font-medium animate-pulse">REC</span>
                )}
              </div>
            )}

            {/* PTT feedback */}
            {pushToTalkMode && isPushToTalkActive && (
              <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-green-600">{t.translator.recording}</span>
              </div>
            )}

            {/* Start/Stop or PTT area */}
            {pushToTalkMode ? (
              <div 
                className="text-center py-3 px-3 rounded-lg bg-muted/30 border border-dashed border-border cursor-pointer select-none touch-none active:bg-primary/20 transition-colors"
                onTouchStart={async (e) => {
                  e.preventDefault();
                  if (!isListening) await startListening();
                  startPushToTalk();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  stopPushToTalk();
                }}
                onMouseDown={async (e) => {
                  if ('ontouchstart' in window) return;
                  e.preventDefault();
                  if (!isListening) await startListening();
                  startPushToTalk();
                }}
                onMouseUp={(e) => {
                  if ('ontouchstart' in window) return;
                  e.preventDefault();
                  stopPushToTalk();
                }}
                onMouseLeave={() => {
                  if ('ontouchstart' in window) return;
                  if (isPushToTalkActive) stopPushToTalk();
                }}
              >
                <Keyboard className="h-5 w-5 mx-auto mb-1 text-muted-foreground hidden md:block" />
                <Mic className="h-5 w-5 mx-auto mb-1 text-muted-foreground md:hidden" />
                <p className="text-xs font-medium hidden md:block">{t.translator.holdSpaceToRecord}</p>
                <p className="text-xs font-medium md:hidden">Удерживайте для записи</p>
              </div>
            ) : (
              <Button
                variant={isListening ? "destructive" : "default"}
                onClick={toggleListening}
                className="gap-2 h-9"
                size="sm"
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3 w-3" />
                    {t.translator.stop}
                  </>
                ) : (
                  <>
                    <Mic className="h-3 w-3" />
                    {t.translator.startTranslation}
                  </>
                )}
              </Button>
            )}

            {/* Subtitles */}
            <div className="flex-1 overflow-y-auto min-h-[60px] max-h-[120px] border rounded-lg bg-muted/30 p-2 space-y-1.5">
              {translations.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-3">
                  {isListening ? t.translator.listening : t.translator.pressStart}
                </div>
              ) : (
                translations.map((entry) => (
                  <div key={entry.id} className="text-xs space-y-0.5 border-b border-border/50 pb-1.5 last:border-0">
                    <p className="text-muted-foreground italic text-[11px]">"{entry.originalText}"</p>
                    <p className="text-foreground font-medium">{entry.translatedText}</p>
                  </div>
                ))
              )}
              <div ref={translationsEndRef} />
            </div>

            {translations.length > 0 && (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="text-xs flex-1 h-7" onClick={clearTranslations}>
                  {t.translator.clear}
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1 h-7" onClick={exportHistory}>
                  <Download className="h-3 w-3" />
                  CSV
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 flex flex-col gap-2 overflow-hidden mt-2">
            {!user ? (
              <div className="text-center text-muted-foreground text-xs py-6">
                {t.translator.signInToViewHistory}
              </div>
            ) : historyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto min-h-[100px] max-h-[200px] border rounded-lg bg-muted/30 p-2 space-y-1.5">
                  {historyItems.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-6">
                      {t.translator.noHistory}
                    </div>
                  ) : (
                    historyItems.map((entry) => (
                      <div key={entry.id} className="text-xs space-y-0.5 border-b border-border/50 pb-1.5 last:border-0">
                        <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                          <span>{entry.timestamp.toLocaleDateString()} {entry.timestamp.toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[9px] h-4">
                            {entry.sourceLanguage || 'auto'} → {entry.targetLanguage}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground italic text-[11px]">"{entry.originalText}"</p>
                        <p className="text-foreground font-medium">{entry.translatedText}</p>
                      </div>
                    ))
                  )}
                </div>

                {historyItems.length > 0 && (
                  <div className="flex gap-1.5">
                    <Button variant="destructive" size="sm" className="text-xs flex-1 gap-1 h-7" onClick={clearHistory}>
                      <Trash2 className="h-3 w-3" />
                      {t.translator.clearHistory}
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs flex-1 gap-1 h-7" onClick={exportHistory}>
                      <Download className="h-3 w-3" />
                      {t.translator.exportCsv}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default RealtimeTranslator;
