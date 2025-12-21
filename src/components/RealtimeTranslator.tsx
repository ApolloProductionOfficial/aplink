import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Languages, Mic, MicOff, Volume2, VolumeX, Loader2, X, Minimize2, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  audioUrl?: string;
}

interface RealtimeTranslatorProps {
  isActive: boolean;
  onToggle: () => void;
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

export const RealtimeTranslator: React.FC<RealtimeTranslatorProps> = ({
  isActive,
  onToggle,
  className,
}) => {
  const [targetLanguage, setTargetLanguage] = useState('ru');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showMuteAudio, setShowMuteAudio] = useState(false);
  
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const audioUrl = audioQueueRef.current.shift()!;
    
    try {
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        isPlayingRef.current = false;
        URL.revokeObjectURL(audioUrl);
        playNextAudio();
      };
      audio.onerror = () => {
        isPlayingRef.current = false;
        URL.revokeObjectURL(audioUrl);
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
        };

        // Create audio URL if available
        if (result.audioContent && autoPlayAudio) {
          const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
          entry.audioUrl = audioUrl;
          audioQueueRef.current.push(audioUrl);
          playNextAudio();
        }

        setTranslations(prev => [...prev.slice(-19), entry]); // Keep last 20
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Don't show toast for every error to avoid spam
    } finally {
      setIsProcessing(false);
    }
  }, [targetLanguage, sourceLanguage, autoPlayAudio, playNextAudio]);

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

      // Start recording chunks every 5 seconds
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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsMinimized(false)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 w-96 max-h-[60vh] bg-background/95 backdrop-blur border-primary/20 shadow-lg flex flex-col",
      className
    )}>
      <CardContent className="p-4 flex flex-col gap-4 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Синхронный перевод</span>
            {isListening && (
              <Badge variant="destructive" className="animate-pulse">
                LIVE
              </Badge>
            )}
            {isProcessing && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onToggle}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Language selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Исходный</Label>
            <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
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
            <Select value={targetLanguage} onValueChange={setTargetLanguage}>
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

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="autoplay"
              checked={autoPlayAudio}
              onCheckedChange={setAutoPlayAudio}
            />
            <Label htmlFor="autoplay" className="text-xs cursor-pointer flex items-center gap-1">
              {autoPlayAudio ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              Озвучка
            </Label>
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
                <Mic className="h-4 w-4" />
                Старт
              </>
            )}
          </Button>
        </div>

        {/* Subtitles area */}
        <div className="flex-1 overflow-y-auto min-h-[120px] max-h-[200px] border rounded-lg bg-muted/30 p-2 space-y-2">
          {translations.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              {isListening ? 'Слушаю...' : 'Нажмите "Старт" для начала'}
            </div>
          ) : (
            translations.map((entry) => (
              <div
                key={entry.id}
                className="text-xs space-y-0.5 border-b border-border/50 pb-2 last:border-0"
              >
                <p className="text-muted-foreground italic">"{entry.originalText}"</p>
                <p className="text-foreground font-medium">{entry.translatedText}</p>
              </div>
            ))
          )}
          <div ref={translationsEndRef} />
        </div>

        {/* Footer */}
        {translations.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={clearTranslations}
          >
            Очистить субтитры
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default RealtimeTranslator;
