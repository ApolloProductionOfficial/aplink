import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Languages, Mic, MicOff, Volume2, VolumeX, Loader2, X, Minimize2, Maximize2, 
  Monitor, Download, History, Trash2, User
} from 'lucide-react';
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
  // Female voices
  { id: 'female-sarah', name: 'Sarah', gender: 'female', icon: '👩' },
  { id: 'female-laura', name: 'Laura', gender: 'female', icon: '👩‍🦰' },
  { id: 'female-alice', name: 'Alice', gender: 'female', icon: '👱‍♀️' },
  { id: 'female-matilda', name: 'Matilda', gender: 'female', icon: '👩‍🦳' },
  { id: 'female-lily', name: 'Lily', gender: 'female', icon: '👧' },
  { id: 'female-jessica', name: 'Jessica', gender: 'female', icon: '👩‍💼' },
  // Male voices
  { id: 'male-daniel', name: 'Daniel', gender: 'male', icon: '👨' },
  { id: 'male-george', name: 'George', gender: 'male', icon: '👨‍🦰' },
  { id: 'male-charlie', name: 'Charlie', gender: 'male', icon: '👱' },
  { id: 'male-liam', name: 'Liam', gender: 'male', icon: '👨‍🦳' },
  { id: 'male-brian', name: 'Brian', gender: 'male', icon: '🧔' },
  { id: 'male-chris', name: 'Chris', gender: 'male', icon: '👨‍💼' },
  // Neutral voices
  { id: 'neutral-river', name: 'River', gender: 'neutral', icon: '🧑' },
  { id: 'neutral-alloy', name: 'Roger', gender: 'neutral', icon: '🧑‍🦱' },
];

type AudioSource = 'microphone' | 'system';

export const RealtimeTranslator: React.FC<RealtimeTranslatorProps> = ({
  isActive,
  onToggle,
  roomId,
  className,
}) => {
  const { user } = useAuth();
  const [targetLanguage, setTargetLanguage] = useState('ru');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [selectedVoice, setSelectedVoice] = useState('female-sarah');
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [saveToHistory, setSaveToHistory] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('translate');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<TranslationEntry[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const translationsEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!user || !saveToHistory) return;

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
    if (audioBlob.size < 1000) {
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

        // Create audio URL if available
        if (result.audioContent && autoPlayAudio) {
          const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
          entry.audioUrl = audioUrl;
          audioQueueRef.current.push(audioUrl);
          playNextAudio();
        }

        setTranslations(prev => [...prev.slice(-19), entry]);
        
        // Save to database
        await saveTranslation(entry);
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [targetLanguage, sourceLanguage, selectedVoice, autoPlayAudio, playNextAudio, saveToHistory, user, roomId]);

  const startRecordingChunk = useCallback(() => {
    if (!streamRef.current) return;

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

    // Stop after 4 seconds to process
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 4000);
  }, [processAudioChunk]);

  const startListeningMicrophone = useCallback(async () => {
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
      toast.success('Переводчик активирован (микрофон)');

      startRecordingChunk();
      recordingIntervalRef.current = setInterval(() => {
        if (streamRef.current) {
          startRecordingChunk();
        }
      }, 5000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Не удалось получить доступ к микрофону');
    }
  }, [startRecordingChunk]);

  const startListeningSystem = useCallback(async () => {
    try {
      // Request screen/window share with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required, but we'll ignore video
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints,
      });

      // Check if audio track is available
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        toast.error('Не удалось захватить системный звук. Убедитесь, что выбрали вкладку с аудио и включили "Поделиться звуком".');
        return;
      }

      // Stop video track - we only need audio
      stream.getVideoTracks().forEach(track => track.stop());

      // Create audio-only stream
      const audioStream = new MediaStream(audioTracks);
      streamRef.current = audioStream;
      setIsListening(true);
      toast.success('Переводчик активирован (системный звук)');

      startRecordingChunk();
      recordingIntervalRef.current = setInterval(() => {
        if (streamRef.current) {
          startRecordingChunk();
        }
      }, 5000);

    } catch (error) {
      console.error('Error accessing system audio:', error);
      if ((error as Error).name === 'NotAllowedError') {
        toast.error('Доступ к экрану отклонён');
      } else {
        toast.error('Не удалось захватить системный звук');
      }
    }
  }, [startRecordingChunk]);

  const startListening = useCallback(async () => {
    if (audioSource === 'microphone') {
      await startListeningMicrophone();
    } else {
      await startListeningSystem();
    }
  }, [audioSource, startListeningMicrophone, startListeningSystem]);

  const stopListening = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
  }, []);

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
            {isListening && (
              <Badge variant="destructive" className="animate-pulse">
                {audioSource === 'system' ? <Monitor className="h-3 w-3 mr-1" /> : <Mic className="h-3 w-3 mr-1" />}
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
      "fixed bottom-4 right-4 z-50 w-[420px] max-h-[70vh] bg-background/95 backdrop-blur border-primary/20 shadow-lg flex flex-col",
      className
    )}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Синхронный перевод</span>
            {isListening && (
              <Badge variant="destructive" className="animate-pulse text-xs">
                {audioSource === 'system' ? 'СИСТЕМА' : 'МИК'}
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
            {/* Audio source selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Источник:</Label>
              <div className="flex gap-1">
                <Button
                  variant={audioSource === 'microphone' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setAudioSource('microphone')}
                  disabled={isListening}
                >
                  <Mic className="h-3 w-3" />
                  Микрофон
                </Button>
                <Button
                  variant={audioSource === 'system' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setAudioSource('system')}
                  disabled={isListening}
                >
                  <Monitor className="h-3 w-3" />
                  Система
                </Button>
              </div>
            </div>

            {/* Language selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Исходный</Label>
                <Select value={sourceLanguage} onValueChange={setSourceLanguage} disabled={isListening}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">🌐 Авто</SelectItem>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Перевод на</Label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage} disabled={isListening}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
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
            </div>

            {/* Voice selector */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Голос озвучки
              </Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isListening}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header-female" disabled className="text-xs text-muted-foreground font-semibold">
                    — Женские голоса —
                  </SelectItem>
                  {VOICES.filter(v => v.gender === 'female').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.icon} {voice.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="header-male" disabled className="text-xs text-muted-foreground font-semibold">
                    — Мужские голоса —
                  </SelectItem>
                  {VOICES.filter(v => v.gender === 'male').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.icon} {voice.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="header-neutral" disabled className="text-xs text-muted-foreground font-semibold">
                    — Нейтральные голоса —
                  </SelectItem>
                  {VOICES.filter(v => v.gender === 'neutral').map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.icon} {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Switch id="autoplay" checked={autoPlayAudio} onCheckedChange={setAutoPlayAudio} className="scale-75" />
                  <Label htmlFor="autoplay" className="text-xs cursor-pointer flex items-center gap-1">
                    {autoPlayAudio ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  </Label>
                </div>
                {user && (
                  <div className="flex items-center gap-1">
                    <Switch id="saveHistory" checked={saveToHistory} onCheckedChange={setSaveToHistory} className="scale-75" />
                    <Label htmlFor="saveHistory" className="text-xs cursor-pointer">
                      <History className="h-3 w-3" />
                    </Label>
                  </div>
                )}
              </div>
              <Button
                variant={isListening ? "destructive" : "default"}
                size="sm"
                onClick={toggleListening}
                className="gap-2"
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    Стоп
                  </>
                ) : (
                  <>
                    {audioSource === 'system' ? <Monitor className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    Старт
                  </>
                )}
              </Button>
            </div>

            {/* Subtitles area */}
            <div className="flex-1 overflow-y-auto min-h-[100px] max-h-[180px] border rounded-lg bg-muted/30 p-2 space-y-2">
              {translations.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-6">
                  {isListening ? 'Слушаю...' : audioSource === 'system' 
                    ? 'Выберите вкладку браузера с Zoom/Teams и включите "Поделиться звуком"' 
                    : 'Нажмите "Старт" для начала'}
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
                Войдите для сохранения истории переводов
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
