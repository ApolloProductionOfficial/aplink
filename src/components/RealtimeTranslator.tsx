import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Languages, Mic, MicOff, Volume2, Loader2, X, Minimize2, Maximize2, 
  Download, History, Trash2, Play, Keyboard, Activity, Settings2
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
}

interface RealtimeTranslatorProps {
  isActive: boolean;
  onToggle: () => void;
  roomId?: string;
  className?: string;
}

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
  // Female voices - using audio wave icons
  { id: 'female-sarah', name: 'Sarah', gender: 'female', color: 'bg-pink-500' },
  { id: 'female-laura', name: 'Laura', gender: 'female', color: 'bg-rose-500' },
  { id: 'female-alice', name: 'Alice', gender: 'female', color: 'bg-fuchsia-500' },
  { id: 'female-matilda', name: 'Matilda', gender: 'female', color: 'bg-purple-500' },
  { id: 'female-lily', name: 'Lily', gender: 'female', color: 'bg-violet-500' },
  { id: 'female-jessica', name: 'Jessica', gender: 'female', color: 'bg-indigo-500' },
  // Male voices
  { id: 'male-daniel', name: 'Daniel', gender: 'male', color: 'bg-blue-500' },
  { id: 'male-george', name: 'George', gender: 'male', color: 'bg-cyan-500' },
  { id: 'male-charlie', name: 'Charlie', gender: 'male', color: 'bg-teal-500' },
  { id: 'male-liam', name: 'Liam', gender: 'male', color: 'bg-emerald-500' },
  { id: 'male-brian', name: 'Brian', gender: 'male', color: 'bg-green-500' },
  { id: 'male-chris', name: 'Chris', gender: 'male', color: 'bg-lime-500' },
  // Neutral voices
  { id: 'neutral-river', name: 'River', gender: 'neutral', color: 'bg-amber-500' },
  { id: 'neutral-alloy', name: 'Roger', gender: 'neutral', color: 'bg-orange-500' },
];

export const RealtimeTranslator: React.FC<RealtimeTranslatorProps> = ({
  isActive,
  onToggle,
  roomId,
  className,
}) => {
  const { user } = useAuth();
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [selectedVoice, setSelectedVoice] = useState('female-sarah');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<TranslationEntry[]>([]);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [pushToTalkMode, setPushToTalkMode] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  // VAD is always enabled (no toggle needed)
  const vadEnabled = true;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [vadSettingsOpen, setVadSettingsOpen] = useState(false);
  
  // VAD configurable settings
  const [vadThreshold, setVadThreshold] = useState(0.02);
  const [silenceDuration, setSilenceDuration] = useState(1500);
  const [minSpeechDuration, setMinSpeechDuration] = useState(300);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const translationsEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pushToTalkRecordingRef = useRef(false);
  
  // VAD (Voice Activity Detection) refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const vadRecordingRef = useRef(false);

  // Auto-scroll to latest translation
  useEffect(() => {
    if (translationsEndRef.current) {
      translationsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [translations]);

  // Load history when tab changes
  useEffect(() => {
    if (activeTab === 'history' && user) {
      loadHistory();
    }
  }, [activeTab, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

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
      toast.error('Не удалось загрузить историю');
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
        source_language: entry.sourceLanguage || sourceLanguage,
        target_language: targetLanguage,
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
      toast.success('История очищена');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Ошибка очистки истории');
    }
  };

  const exportHistory = () => {
    const items = historyItems.length > 0 ? historyItems : translations;
    if (items.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const csv = [
      ['Время', 'Оригинал', 'Перевод', 'Язык источника', 'Язык перевода'].join(','),
      ...items.map(item => [
        item.timestamp.toISOString(),
        `"${item.originalText.replace(/"/g, '""')}"`,
        `"${item.translatedText.replace(/"/g, '""')}"`,
        item.sourceLanguage || 'auto',
        item.targetLanguage || targetLanguage,
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translations_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('История экспортирована');
  };

  // Preview selected voice
  const previewVoice = async () => {
    if (isPreviewingVoice) return;
    
    setIsPreviewingVoice(true);
    try {
      const targetLang = LANGUAGES.find(l => l.code === targetLanguage);
      const sampleText = targetLanguage === 'ru' 
        ? 'Привет! Это пример моего голоса.' 
        : targetLanguage === 'en'
        ? 'Hello! This is a sample of my voice.'
        : targetLanguage === 'es'
        ? 'Hola! Este es un ejemplo de mi voz.'
        : targetLanguage === 'de'
        ? 'Hallo! Dies ist ein Beispiel meiner Stimme.'
        : targetLanguage === 'fr'
        ? 'Bonjour! Ceci est un exemple de ma voix.'
        : 'Hello! This is a sample of my voice.';

      const formData = new FormData();
      // Create a small audio blob with silence just to trigger TTS
      const silentBlob = new Blob([new Uint8Array(1000)], { type: 'audio/webm' });
      formData.append('audio', silentBlob, 'audio.webm');
      formData.append('targetLanguage', targetLanguage);
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

      if (!response.ok) {
        throw new Error('Preview failed');
      }

      const result = await response.json();
      
      if (result.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
        const audio = new Audio(audioUrl);
        await audio.play();
      }
    } catch (error) {
      console.error('Voice preview error:', error);
      toast.error('Не удалось воспроизвести голос');
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const audioUrl = audioQueueRef.current.shift()!;
    
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
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      isPlayingRef.current = false;
      playNextAudio();
    }
  }, []);

  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    // Increased minimum size to ensure we have meaningful audio
    if (audioBlob.size < 2000) {
      console.log('Audio chunk too small, skipping...');
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('targetLanguage', targetLanguage);
      formData.append('voiceId', selectedVoice);
      if (sourceLanguage !== 'auto') {
        formData.append('sourceLanguage', sourceLanguage);
      }

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

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.translatedText && result.translatedText.trim()) {
        const entry: TranslationEntry = {
          id: Date.now().toString(),
          originalText: result.originalText,
          translatedText: result.translatedText,
          timestamp: new Date(),
          sourceLanguage: result.detectedLanguage,
          targetLanguage: result.targetLanguage,
          voiceId: result.voiceId,
        };

        // Create audio URL if available - always play
        if (result.audioContent) {
          const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
          entry.audioUrl = audioUrl;
          audioQueueRef.current.push(audioUrl);
          playNextAudio();
        }

        setTranslations(prev => [...prev.slice(-19), entry]);
        
        // Save to database if user is logged in
        if (user) {
          await saveTranslation(entry);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [targetLanguage, sourceLanguage, selectedVoice, playNextAudio, user, roomId]);

  // VAD: Start recording when speech detected
  const startVadRecording = useCallback(() => {
    if (!streamRef.current) {
      console.log('VAD Recording: No stream');
      return;
    }
    if (vadRecordingRef.current) {
      console.log('VAD Recording: Already recording');
      return;
    }
    
    console.log('VAD Recording: Starting new recording');
    vadRecordingRef.current = true;
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
      console.log('VAD Recording: Stopped, processing audio');
      vadRecordingRef.current = false;
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await processAudioChunk(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [processAudioChunk]);

  // VAD: Stop recording after silence
  const stopVadRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // VAD: Analyze audio levels (and always run mic level meter)
  const startVad = useCallback(() => {
    if (!streamRef.current) {
      console.log('VAD: No stream available');
      return;
    }
    if (vadIntervalRef.current) {
      console.log('VAD: Already running');
      return;
    }

    console.log('VAD: Starting audio analysis, pushToTalkMode:', pushToTalkMode);

    // Create audio context for analysis
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 512;
    analyserRef.current.smoothingTimeConstant = 0.4;

    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    source.connect(analyserRef.current);

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    vadIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate RMS volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += (dataArray[i] / 255) ** 2;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Update audio level for visual indicator (0-100)
      setAudioLevel(Math.min(100, rms * 500));

      // In push-to-talk mode we only need the mic level meter, skip VAD logic
      if (pushToTalkMode) {
        return;
      }

      const now = Date.now();

      if (rms > vadThreshold) {
        // Speech detected
        silenceStartRef.current = null;

        if (!speechStartRef.current) {
          speechStartRef.current = now;
          console.log('VAD: Speech started');
        }

        // Start recording if speech has been detected for minimum duration
        if (!vadRecordingRef.current && (now - speechStartRef.current) >= minSpeechDuration) {
          console.log('VAD: Starting recording');
          setIsSpeaking(true);
          startVadRecording();
        }
      } else {
        // Silence detected
        if (speechStartRef.current && !silenceStartRef.current) {
          silenceStartRef.current = now;
        }

        // If silence has lasted long enough, stop recording
        if (vadRecordingRef.current && silenceStartRef.current && (now - silenceStartRef.current) >= silenceDuration) {
          console.log('VAD: Silence detected, stopping recording');
          setIsSpeaking(false);
          stopVadRecording();
          speechStartRef.current = null;
          silenceStartRef.current = null;
        }
      }
    }, 50); // Check every 50ms
  }, [pushToTalkMode, startVadRecording, stopVadRecording, vadThreshold, silenceDuration, minSpeechDuration]);

  // Stop VAD
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

  const startRecordingChunk = useCallback(() => {
    if (!streamRef.current) return;
    // In push-to-talk mode, don't start auto chunks
    if (pushToTalkMode && !pushToTalkRecordingRef.current) return;
    // In VAD mode, don't use fixed intervals
    if (vadEnabled) return;

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
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await processAudioChunk(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();

    // In auto mode without VAD: stop after 10 seconds
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 10000);
  }, [processAudioChunk, pushToTalkMode, vadEnabled]);

  // Push-to-talk: start recording on key down
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
      
      // In PTT mode, stop mic after each recording so user knows it's not always on
      if (pushToTalkMode && streamRef.current) {
        stopListeningInternal();
      }
      
      await processAudioChunk(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
  }, [processAudioChunk]);

  // Push-to-talk: stop recording on key up
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
        toast.success('Режим Push-to-talk: удерживайте Пробел и говорите');
      } else {
        toast.success('VAD активирован — говорите, перевод начнётся автоматически');
      }

      // Always start audio analysis (mic level meter). In non-PTT mode this also runs VAD.
      startVad();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Не удалось получить доступ к микрофону');
    }
  }, [pushToTalkMode, startVad]);

  // Keyboard listener for push-to-talk (Space key) - proper hold behavior
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
      // stopImmediatePropagation is not on the TS KeyboardEvent type, but exists at runtime
      (e as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.();
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isSpaceHeld) return;
      if (shouldIgnoreTarget(e.target)) return;

      stopEvent(e);
      isSpaceHeld = true;

      // If mic isn't active yet, start it first (so PTT can work without pressing "Начать перевод")
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

  // Internal stop (doesn't process current audio, just cleans up)
  const stopListeningInternal = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

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
      "fixed bottom-4 right-4 z-50 w-[400px] max-h-[70vh] bg-background/95 backdrop-blur border-primary/20 shadow-lg flex flex-col",
      className
    )}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Переводчик</span>
            {pushToTalkMode && isPushToTalkActive && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                REC
              </Badge>
            )}
            {!pushToTalkMode && isListening && (
              <Badge variant="default" className="text-xs bg-green-600">
                LIVE
              </Badge>
            )}
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="translate" className="text-xs">Перевод</TabsTrigger>
            <TabsTrigger value="history" className="text-xs flex items-center gap-1">
              <History className="h-3 w-3" />
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="translate" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
            {/* Language selectors - improved styling */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Languages className="h-3 w-3" />
                  Исходный
                </label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={isListening}>
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-base">🌍</span>
                        <span>Авто-определение</span>
                      </span>
                    </SelectItem>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Languages className="h-3 w-3" />
                  Перевод на
                </label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isListening}>
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Voice selector with preview - improved styling */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Volume2 className="h-3 w-3" />
                Голос озвучки
              </label>
              <div className="flex gap-2">
                <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isListening}>
                  <SelectTrigger className="h-9 text-sm flex-1 bg-muted/30 border-border/50 hover:bg-muted/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="px-2 py-1.5 text-xs font-semibold text-pink-500/80 bg-pink-500/5">
                      Женские голоса
                    </div>
                    {VOICES.filter(v => v.gender === 'female').map(voice => (
                      <SelectItem key={voice.id} value={voice.id} className="text-sm">
                        <span className="flex items-center gap-2.5">
                          <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", voice.color)} />
                          <span>{voice.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-blue-500/80 bg-blue-500/5 mt-1">
                      Мужские голоса
                    </div>
                    {VOICES.filter(v => v.gender === 'male').map(voice => (
                      <SelectItem key={voice.id} value={voice.id} className="text-sm">
                        <span className="flex items-center gap-2.5">
                          <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", voice.color)} />
                          <span>{voice.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1.5 text-xs font-semibold text-amber-500/80 bg-amber-500/5 mt-1">
                      Нейтральные голоса
                    </div>
                    {VOICES.filter(v => v.gender === 'neutral').map(voice => (
                      <SelectItem key={voice.id} value={voice.id} className="text-sm">
                        <span className="flex items-center gap-2.5">
                          <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", voice.color)} />
                          <span>{voice.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 bg-muted/30 border-border/50 hover:bg-muted/50"
                  onClick={previewVoice}
                  disabled={isPreviewingVoice || isListening}
                  title="Прослушать голос"
                >
                  {isPreviewingVoice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* VAD settings (VAD is always enabled) */}
            <Collapsible open={vadSettingsOpen} onOpenChange={setVadSettingsOpen}>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 flex-1">
                  <Activity className={cn("h-4 w-4", isSpeaking && isListening ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
                  <span className="text-xs">VAD (определение речи)</span>
                  {isSpeaking && isListening && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 border-green-500/50 text-green-500">
                      Говорите...
                    </Badge>
                  )}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="mt-2 space-y-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
                {/* Audio level indicator */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Уровень звука</span>
                    <span className="text-[10px] text-muted-foreground">{Math.round(audioLevel)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-75 rounded-full",
                        audioLevel > vadThreshold * 500 ? "bg-green-500" : "bg-primary/50"
                      )}
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                  <div 
                    className="relative h-0.5 -mt-1"
                    style={{ marginLeft: `${Math.min(100, vadThreshold * 500)}%` }}
                  >
                    <div className="absolute w-0.5 h-3 -top-1 bg-destructive rounded" title="Порог" />
                  </div>
                </div>
                
                {/* Threshold slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Порог громкости</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{(vadThreshold * 100).toFixed(1)}%</span>
                  </div>
                  <Slider
                    value={[vadThreshold * 100]}
                    onValueChange={([v]) => setVadThreshold(v / 100)}
                    min={0.5}
                    max={10}
                    step={0.1}
                    className="h-4"
                    disabled={isListening}
                  />
                </div>
                
                {/* Silence duration slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Пауза для отправки</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{(silenceDuration / 1000).toFixed(1)}с</span>
                  </div>
                  <Slider
                    value={[silenceDuration]}
                    onValueChange={([v]) => setSilenceDuration(v)}
                    min={500}
                    max={4000}
                    step={100}
                    className="h-4"
                    disabled={isListening}
                  />
                </div>
                
                {/* Min speech duration slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Мин. длит. речи</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{minSpeechDuration}мс</span>
                  </div>
                  <Slider
                    value={[minSpeechDuration]}
                    onValueChange={([v]) => setMinSpeechDuration(v)}
                    min={100}
                    max={1000}
                    step={50}
                    className="h-4"
                    disabled={isListening}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Mode selector */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => !isListening && setPushToTalkMode(false)}
                  disabled={isListening}
                  className={cn(
                    "py-2.5 px-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    !pushToTalkMode 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Авто (VAD)
                </button>
                <button
                  type="button"
                  onClick={() => !isListening && setPushToTalkMode(true)}
                  disabled={isListening}
                  className={cn(
                    "py-2.5 px-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                    pushToTalkMode 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  )}
                >
                  <Keyboard className="h-3.5 w-3.5" />
                  Пробел (PTT)
                </button>
              </div>
            </div>

            {/* Live audio level bar when listening (VAD mode) */}
            {isListening && !pushToTalkMode && (
              <div className="flex items-center gap-2 px-1">
                <Mic className={cn("h-3.5 w-3.5 shrink-0", isSpeaking ? "text-green-500" : "text-muted-foreground")} />
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-75 rounded-full",
                      audioLevel > vadThreshold * 500 ? "bg-green-500" : "bg-primary/40"
                    )}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            )}

            {/* PTT visual feedback when recording */}
            {pushToTalkMode && isPushToTalkActive && (
              <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-600">Записываю...</span>
              </div>
            )}

            {/* Start/Stop button or PTT instructions */}
            {pushToTalkMode ? (
              <div className="text-center py-3 px-4 rounded-lg bg-muted/30 border border-dashed border-border">
                <Keyboard className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                <p className="text-sm font-medium">Зажмите Пробел для записи</p>
                <p className="text-xs text-muted-foreground mt-0.5">Отпустите — и речь будет переведена</p>
              </div>
            ) : (
              <Button
                variant={isListening ? "destructive" : "default"}
                onClick={toggleListening}
                className="gap-2 h-10"
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Остановить
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Начать перевод
                  </>
                )}
              </Button>
            )}

            {/* Subtitles area */}
            <div className="flex-1 overflow-y-auto min-h-[80px] max-h-[150px] border rounded-lg bg-muted/30 p-2 space-y-2">
              {translations.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  {isListening ? 'Слушаю... говорите чётко' : 'Нажмите "Начать перевод"'}
                </div>
              ) : (
                translations.map((entry) => (
                  <div key={entry.id} className="text-xs space-y-0.5 border-b border-border/50 pb-2 last:border-0">
                    <p className="text-muted-foreground italic">"{entry.originalText}"</p>
                    <p className="text-foreground font-medium">{entry.translatedText}</p>
                  </div>
                ))
              )}
              <div ref={translationsEndRef} />
            </div>

            {/* Footer */}
            {translations.length > 0 && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-xs flex-1" onClick={clearTranslations}>
                  Очистить
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={exportHistory}>
                  <Download className="h-3 w-3" />
                  CSV
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 flex flex-col gap-3 overflow-hidden mt-3">
            {!user ? (
              <div className="text-center text-muted-foreground text-xs py-8">
                Войдите для просмотра истории переводов
              </div>
            ) : historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto min-h-[150px] max-h-[250px] border rounded-lg bg-muted/30 p-2 space-y-2">
                  {historyItems.length === 0 ? (
                    <div className="text-center text-muted-foreground text-xs py-8">
                      История переводов пуста
                    </div>
                  ) : (
                    historyItems.map((entry) => (
                      <div key={entry.id} className="text-xs space-y-0.5 border-b border-border/50 pb-2 last:border-0">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>{entry.timestamp.toLocaleDateString()} {entry.timestamp.toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[10px] h-4">
                            {entry.sourceLanguage || 'auto'} → {entry.targetLanguage}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground italic">"{entry.originalText}"</p>
                        <p className="text-foreground font-medium">{entry.translatedText}</p>
                      </div>
                    ))
                  )}
                </div>

                {historyItems.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" className="text-xs flex-1 gap-1" onClick={clearHistory}>
                      <Trash2 className="h-3 w-3" />
                      Очистить
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs flex-1 gap-1" onClick={exportHistory}>
                      <Download className="h-3 w-3" />
                      Экспорт CSV
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
