import { useState, useRef, useCallback } from "react";
import { Loader2, Sparkles, Building2, Trees, Rocket, Umbrella, Crown, Upload, Image, RefreshCw, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CallMenuHint } from "@/components/CallMenuHint";

interface VirtualBackgroundSelectorProps {
  onSelectBlur: (intensity: number) => void;
  onSelectImage: (imageUrl: string) => void;
  onRemove: () => void;
  currentBackground: 'none' | 'blur-light' | 'blur-strong' | 'image';
  isProcessing: boolean;
  onResetAllEffects?: () => void;
}

const BLUR_OPTIONS = [
  { id: 'blur-light', intensity: 5, label: 'Лёгкое' },
  { id: 'blur-strong', intensity: 15, label: 'Сильное' },
];

// AI-generated themes - each click generates a new unique image
const AI_THEMES = [
  { 
    id: 'space', 
    label: 'Космос',
    icon: Rocket,
    gradient: 'from-purple-500/30 to-blue-600/10',
    iconColor: 'text-purple-400'
  },
  { 
    id: 'office', 
    label: 'Офис',
    icon: Building2,
    gradient: 'from-blue-500/30 to-cyan-600/10',
    iconColor: 'text-blue-400'
  },
  { 
    id: 'nature', 
    label: 'Природа',
    icon: Trees,
    gradient: 'from-green-500/30 to-emerald-600/10',
    iconColor: 'text-green-400'
  },
  { 
    id: 'beach', 
    label: 'Пляж',
    icon: Umbrella,
    gradient: 'from-cyan-500/30 to-teal-600/10',
    iconColor: 'text-cyan-400'
  },
];

// Static Apollo Production background
const APOLLO_BACKGROUND = {
  id: 'apollo',
  url: '/images/apollo-production-bg.png',
  label: 'Apollo',
  icon: Crown,
};

export function VirtualBackgroundSelector({
  onSelectBlur,
  onSelectImage,
  onRemove,
  currentBackground,
  isProcessing,
  onResetAllEffects,
}: VirtualBackgroundSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingTheme, setGeneratingTheme] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleBlurSelect = (intensity: number, id: string) => {
    if (selectedId === id) {
      onRemove();
      setSelectedId(null);
    } else {
      onSelectBlur(intensity);
      setSelectedId(id);
    }
  };

  // Mirror image helper for Apollo background
  const mirrorImage = useCallback(async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        
        // Mirror horizontally
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  }, []);

  // Track loading state for static images to prevent double-click toggle issue
  const [isLoadingStatic, setIsLoadingStatic] = useState(false);

  const handleStaticImageSelect = async (url: string, id: string) => {
    // If already loading, ignore click
    if (isLoadingStatic) return;
    
    // If already selected and NOT loading, toggle off
    if (selectedId === id && !isProcessing) {
      onRemove();
      setSelectedId(null);
      return;
    }
    
    // Apply the background on first click
    setIsLoadingStatic(true);
    setSelectedId(id);
    
    try {
      // Mirror the Apollo background to fix orientation
      if (id === 'apollo') {
        const mirroredUrl = await mirrorImage(url);
        onSelectImage(mirroredUrl);
      } else {
        onSelectImage(url);
      }
    } catch (err) {
      console.error('Failed to process image:', err);
      onSelectImage(url);
    } finally {
      setIsLoadingStatic(false);
    }
  };

  // Generate new AI background on each click
  const handleAIThemeSelect = async (theme: string) => {
    if (isGenerating) return;

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsGenerating(true);
    setGeneratingTheme(theme);
    setSelectedId(theme);

    try {
      toast({
        title: "🎨 Генерация фона...",
        description: "AI создаёт уникальное изображение",
      });

      const { data, error } = await supabase.functions.invoke('generate-background', {
        body: { theme }
      });

      if (error) {
        throw error;
      }

      if (data?.imageUrl) {
        onSelectImage(data.imageUrl);
        toast({
          title: "✨ Фон применён!",
          description: "AI-сгенерированный фон успешно установлен",
        });
      } else {
        throw new Error('No image URL received');
      }

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.log('Generation cancelled');
        return;
      }
      console.error('Failed to generate background:', err);
      toast({
        title: "Ошибка генерации",
        description: "Не удалось создать AI-фон. Попробуйте ещё раз.",
        variant: "destructive",
      });
      setSelectedId(null);
    } finally {
      setIsGenerating(false);
      setGeneratingTheme(null);
    }
  };

  const handleReset = useCallback(() => {
    // Cancel any ongoing generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setGeneratingTheme(null);
    
    // Reset background
    onRemove();
    setSelectedId(null);
    
    // Reset other effects
    if (onResetAllEffects) {
      onResetAllEffects();
    }
  }, [onRemove, onResetAllEffects]);

  const handleCustomUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImageUrl(url);
      onSelectImage(url);
      setSelectedId('custom');
    }
  };

  const isSelected = (id: string) => selectedId === id;
  const hasAnyEffect = selectedId !== null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <CallMenuHint hint="Виртуальный фон" side="top">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 [&_svg]:drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] [&_svg]:stroke-[2.5]",
              hasAnyEffect 
                ? "bg-primary/20 border-primary/50 hover:bg-primary/30" 
                : "bg-white/15 hover:bg-white/25"
            )}
            disabled={isProcessing || isGenerating}
          >
            {isProcessing || isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
          </Button>
        </PopoverTrigger>
      </CallMenuHint>
      <PopoverContent 
        className="w-[340px] p-4 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]" 
        side="top"
        align="center"
        sideOffset={12}
      >
        <div className="space-y-4">
          {/* Header with reset button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Виртуальный фон</span>
            </div>
            
            {/* Reset button - shows when any effect is active */}
            {hasAnyEffect && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-all text-xs text-red-300"
              >
                <X className="w-3 h-3" />
                <span>Сброс</span>
              </button>
            )}
          </div>

          {/* Blur options */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Размытие фона</span>
            <div className="grid grid-cols-2 gap-2">
              {BLUR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleBlurSelect(option.intensity, option.id)}
                  disabled={isProcessing || isGenerating}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-4 rounded-full transition-all",
                    "border hover:border-primary/50 hover:scale-[1.02]",
                    isSelected(option.id)
                      ? "bg-primary/30 border-primary/60 shadow-lg shadow-primary/20"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* AI Generated backgrounds */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">AI-генерация фона</span>
              <span className="text-[10px] text-muted-foreground/60">Клик = новый фон</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {/* Apollo static background */}
              <button
                onClick={() => handleStaticImageSelect(APOLLO_BACKGROUND.url, APOLLO_BACKGROUND.id)}
                disabled={isProcessing || isGenerating}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                  "border hover:border-amber-500/50 hover:scale-105",
                  isSelected(APOLLO_BACKGROUND.id)
                    ? "bg-amber-500/30 border-amber-500/60 shadow-lg shadow-amber-500/20"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-amber-500/30 to-amber-600/10">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{APOLLO_BACKGROUND.label}</span>
              </button>

              {/* AI themes */}
              {AI_THEMES.map((theme) => {
                const IconComponent = theme.icon;
                const isThisGenerating = generatingTheme === theme.id;
                
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleAIThemeSelect(theme.id)}
                    disabled={isProcessing || isGenerating}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative",
                      "border hover:border-primary/50 hover:scale-105",
                      isSelected(theme.id)
                        ? "bg-primary/30 border-primary/60 shadow-lg shadow-primary/20"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                      theme.gradient
                    )}>
                      {isThisGenerating ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <IconComponent className={cn("w-5 h-5", theme.iconColor)} />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom upload */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Свой фон</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleCustomUpload}
              disabled={isProcessing || isGenerating}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full transition-all",
                "border border-dashed hover:border-primary/50",
                isSelected('custom')
                  ? "bg-primary/30 border-primary/60 border-solid shadow-lg shadow-primary/20"
                  : "bg-white/5 border-white/20 hover:bg-white/10"
              )}
            >
              {customImageUrl && isSelected('custom') ? (
                <>
                  <Image className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Загружен</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Загрузить изображение</span>
                </>
              )}
            </button>
          </div>

          {/* Note */}
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Нажмите повторно для отмены • AI создаёт уникальный фон
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VirtualBackgroundSelector;
