import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Languages, Mic, MicOff, Volume2, Loader2, X, Minimize2, Maximize2, 
  Download, History, Trash2, User, Play
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

    // Stop after 6 seconds to give user more time to finish speaking
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 6000);
  }, [processAudioChunk]);

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
      toast.success('Переводчик активирован');

      startRecordingChunk();
      // Increased interval to 7 seconds for better speech capture
      recordingIntervalRef.current = setInterval(() => {
        if (streamRef.current) {
          startRecordingChunk();
        }
      }, 7000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Не удалось получить доступ к микрофону');
    }
  }, [startRecordingChunk]);

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
            {isListening && (
              <Badge variant="destructive" className="animate-pulse text-xs">
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
            {/* Language selectors */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Исходный</label>
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
                <label className="text-xs text-muted-foreground">Перевод на</label>
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

            {/* Voice selector with preview */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Голос озвучки
              </label>
              <div className="flex gap-2">
                <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isListening}>
                  <SelectTrigger className="h-8 text-xs flex-1">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3"
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

            {/* Start/Stop button */}
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

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center">
              Говорите в микрофон — перевод воспроизводится автоматически. 
              Только вы слышите озвучку перевода.
            </p>

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
