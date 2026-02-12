import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Room } from "livekit-client";
import { Subtitles, X, GripHorizontal } from "lucide-react";
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

  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const { captions, isProcessing, clearCaptions, vadActive } = useRealtimeCaptions({
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

  // Unified drag start (mouse + touch)
  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  const handleMouseDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleTouchDragStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [startDrag]);

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const deltaX = clientX - dragRef.current.startX;
      const deltaY = clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.startPosX + deltaX,
        y: dragRef.current.startPosY + deltaY,
      });
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Get last 4 captions for display
  const displayCaptions = captions.slice(-4);
  const selectedLang = LANGUAGES.find(l => l.code === targetLang);

  // Don't render if not enabled
  if (!isEnabled) return null;

  const overlayContent = (
    <div 
      className={cn(
        "fixed z-[9998] pointer-events-auto",
        isDragging && "cursor-grabbing select-none"
      )}
      style={{ 
        maxWidth: 'min(90vw, 800px)',
        left: `calc(50% + ${position.x}px)`,
        bottom: `calc(7rem - ${position.y}px)`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        {/* Captions display */}
        <div 
          className={cn(
            "w-full rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.08]",
            "transition-all duration-300 shadow-[0_0_1px_rgba(255,255,255,0.1)]",
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
            <div className="flex items-center justify-center gap-3 text-muted-foreground py-1">
              {/* VAD indicator - green pulsing dot when voice detected */}
              <div className="relative">
                <div className={cn(
                  "w-3 h-3 rounded-full transition-all duration-200",
                  vadActive 
                    ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]" 
                    : "bg-gray-600"
                )} />
                {vadActive && (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
                )}
              </div>
              
              <Subtitles className="w-4 h-4" />
              <span className="text-sm">
                {vadActive ? 'Голос обнаружен...' : (isProcessing ? 'Обработка...' : 'Ожидание речи...')}
              </span>
              {isProcessing && (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <div 
            className="flex items-center justify-center w-8 h-8 rounded-full bg-black/50 border border-white/20 cursor-grab active:cursor-grabbing backdrop-blur-md touch-none"
            onMouseDown={handleMouseDragStart}
            onTouchStart={handleTouchDragStart}
          >
            <GripHorizontal className="w-4 h-4 text-white/40" />
          </div>

          {/* Language selector with label */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/50">Переводить на:</span>
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
          </div>

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
