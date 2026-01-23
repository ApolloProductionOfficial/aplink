import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Room } from "livekit-client";
import { Subtitles, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRealtimeCaptions, type Caption } from "@/hooks/useRealtimeCaptions";

interface CaptionsOverlayProps {
  room: Room | null;
  participantName: string;
  isEnabled: boolean;
  onToggle: () => void;
}

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
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

// Load saved language from localStorage
const loadSavedLanguage = (): string => {
  try {
    return localStorage.getItem('captions_target_lang') || 'ru';
  } catch {
    return 'ru';
  }
};

// Save language to localStorage
const saveLanguage = (lang: string) => {
  try {
    localStorage.setItem('captions_target_lang', lang);
  } catch { /* ignore */ }
};

export function CaptionsOverlay({
  room,
  participantName,
  isEnabled,
  onToggle,
}: CaptionsOverlayProps) {
  const [targetLang, setTargetLang] = useState(loadSavedLanguage);
  const [isExpanded, setIsExpanded] = useState(false);

  const { captions, isProcessing, clearCaptions } = useRealtimeCaptions({
    room,
    targetLang,
    participantName,
    enabled: isEnabled,
  });

  const handleLanguageChange = (lang: string) => {
    setTargetLang(lang);
    saveLanguage(lang);
    clearCaptions(); // Clear captions when language changes
  };

  // Get last 4 captions for display
  const displayCaptions = captions.slice(-4);
  const selectedLang = LANGUAGES.find(l => l.code === targetLang);

  // Don't render if not enabled
  if (!isEnabled) return null;

  const overlayContent = (
    <div 
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[9998] pointer-events-auto"
      style={{ maxWidth: 'min(90vw, 800px)' }}
    >
      <div className="flex flex-col items-center gap-2">
        {/* Captions display */}
        <div 
          className={cn(
            "w-full rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10",
            "transition-all duration-300",
            displayCaptions.length > 0 ? "p-4" : "p-2"
          )}
        >
          {displayCaptions.length > 0 ? (
            <div className="space-y-2">
              {displayCaptions.map((caption, index) => (
                <div 
                  key={caption.id}
                  className={cn(
                    "flex flex-col gap-0.5 animate-fade-in",
                    index === displayCaptions.length - 1 && "text-white",
                    index !== displayCaptions.length - 1 && "text-white/70"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary/80">
                      {caption.speakerName}
                    </span>
                    {caption.originalText !== caption.translatedText && (
                      <span className="text-[10px] text-muted-foreground/60 italic truncate max-w-[200px]">
                        ({caption.originalText})
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm leading-relaxed",
                    index === displayCaptions.length - 1 && "text-base font-medium"
                  )}>
                    {caption.translatedText}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Subtitles className="w-4 h-4" />
              <span className="text-sm">
                {isProcessing ? 'Обработка...' : 'Ожидание речи...'}
              </span>
              {isProcessing && (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <Select value={targetLang} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] bg-black/50 border-white/20 rounded-full text-xs backdrop-blur-md">
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <span>{selectedLang?.flag}</span>
                  <span>{selectedLang?.code.toUpperCase()}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/20 backdrop-blur-xl rounded-xl">
              {LANGUAGES.map((lang) => (
                <SelectItem 
                  key={lang.code} 
                  value={lang.code}
                  className="text-sm hover:bg-white/10 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 rounded-full bg-black/50 border border-white/20 hover:bg-white/20 backdrop-blur-md"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Use portal to render outside the LiveKit container
  if (typeof window !== 'undefined') {
    return createPortal(overlayContent, document.body);
  }

  return null;
}

export default CaptionsOverlay;
