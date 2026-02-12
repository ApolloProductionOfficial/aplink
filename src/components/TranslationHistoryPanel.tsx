import { Languages, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TranslationEntry } from '@/contexts/ActiveCallContext';

interface TranslationHistoryPanelProps {
  entries: TranslationEntry[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
}

export function TranslationHistoryPanel({ entries, isOpen, onClose, onClear }: TranslationHistoryPanelProps) {
  if (!isOpen || entries.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[99990] w-80 max-h-96 flex flex-col bg-background/80 backdrop-blur-2xl border border-border/30 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
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
        <div className="flex flex-col gap-2 p-3">
          {entries.slice().reverse().map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 p-2.5 rounded-xl bg-foreground/5 border border-border/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary">{entry.senderName}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                </span>
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
