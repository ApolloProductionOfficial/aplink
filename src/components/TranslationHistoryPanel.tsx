import { useState, useCallback } from 'react';
import { Languages, X, Trash2, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import type { TranslationEntry } from '@/contexts/ActiveCallContext';

interface TranslationHistoryPanelProps {
  entries: TranslationEntry[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

export function TranslationHistoryPanel({ entries, isOpen, onClose, onClear }: TranslationHistoryPanelProps) {
  const isMobile = useIsMobile();
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Issue 13: Play button for manual replay via browser TTS
  const playEntry = useCallback((entry: TranslationEntry) => {
    if (!('speechSynthesis' in window) || !entry.translatedText) return;
    
    window.speechSynthesis.cancel();
    setPlayingId(entry.id);
    
    const utterance = new SpeechSynthesisUtterance(entry.translatedText);
    utterance.lang = entry.sourceLang === 'ru' ? 'en' : entry.sourceLang === 'en' ? 'ru' : 'en';
    utterance.rate = 1.1;
    utterance.volume = 1.0;
    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);
    window.speechSynthesis.speak(utterance);
  }, []);

  if (!isOpen || entries.length === 0) return null;

  return (
    <div className={`fixed ${isMobile ? 'bottom-16 right-2 left-2 w-auto' : 'bottom-24 right-4 w-80'} z-[99990] max-h-96 flex flex-col bg-background/80 backdrop-blur-2xl border border-border/30 rounded-2xl shadow-2xl overflow-hidden animate-fade-in`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Переводы</span>
          <span className="text-xs text-muted-foreground">({entries.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onClear} className="w-7 h-7 rounded-full" title="Очистить">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-7 h-7 rounded-full" title="Закрыть">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 max-h-72">
        <div className="flex flex-col gap-2 p-2.5">
          {entries.slice().reverse().map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 p-2 rounded-xl bg-foreground/5 border border-border/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary">{entry.senderName}</span>
                <div className="flex items-center gap-1">
                  {/* Issue 13: Play button for manual replay */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 rounded-full"
                    onClick={() => playEntry(entry)}
                    title="Воспроизвести"
                  >
                    <Volume2 className={`w-3 h-3 ${playingId === entry.id ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              {entry.originalText && (
                <p className="text-xs text-muted-foreground italic">{entry.originalText}</p>
              )}
              <p className="text-sm">{entry.translatedText}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
