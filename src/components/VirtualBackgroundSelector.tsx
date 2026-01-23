import { useState } from "react";
import { Palette, X, Loader2, Sparkles, Building2, Trees, Rocket, Umbrella } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface VirtualBackgroundSelectorProps {
  onSelectBlur: (intensity: number) => void;
  onSelectImage: (imageUrl: string) => void;
  onRemove: () => void;
  currentBackground: 'none' | 'blur-light' | 'blur-strong' | 'image';
  isProcessing: boolean;
}

const BLUR_OPTIONS = [
  { id: 'blur-light', intensity: 5, label: 'Лёгкое' },
  { id: 'blur-strong', intensity: 15, label: 'Сильное' },
];

const IMAGE_OPTIONS = [
  { 
    id: 'office', 
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80', 
    label: 'Офис',
    icon: Building2
  },
  { 
    id: 'nature', 
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80', 
    label: 'Природа',
    icon: Trees
  },
  { 
    id: 'space', 
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80', 
    label: 'Космос',
    icon: Rocket
  },
  { 
    id: 'beach', 
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80', 
    label: 'Пляж',
    icon: Umbrella
  },
];

export function VirtualBackgroundSelector({
  onSelectBlur,
  onSelectImage,
  onRemove,
  currentBackground,
  isProcessing,
}: VirtualBackgroundSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleBlurSelect = (intensity: number, id: string) => {
    onSelectBlur(intensity);
  };

  const handleImageSelect = (url: string) => {
    onSelectImage(url);
  };

  const handleRemove = () => {
    onRemove();
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "w-12 h-12 rounded-full border-white/20 transition-all hover:scale-105",
            currentBackground !== 'none' 
              ? "bg-primary/20 border-primary/50 hover:bg-primary/30" 
              : "bg-white/10 hover:bg-white/20"
          )}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Palette className="w-5 h-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-4 glass-dark border-white/10 rounded-2xl" 
        side="top"
        align="center"
        sideOffset={12}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Виртуальный фон</span>
            </div>
            {currentBackground !== 'none' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive rounded-full"
              >
                <X className="w-3 h-3 mr-1" />
                Убрать
              </Button>
            )}
          </div>

          {/* Blur options */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Размытие</span>
            <div className="grid grid-cols-2 gap-2">
              {BLUR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleBlurSelect(option.intensity, option.id)}
                  disabled={isProcessing}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-4 rounded-full transition-all",
                    "border hover:border-primary/50 hover:scale-[1.02]",
                    currentBackground === option.id
                      ? "bg-primary/20 border-primary/50"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <span className="text-sm">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image options */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Изображения</span>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleImageSelect(option.url)}
                    disabled={isProcessing}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all",
                      "border hover:border-primary/50 hover:scale-105",
                      currentBackground === 'image'
                        ? "bg-primary/20 border-primary/50"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <IconComponent className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note */}
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Виртуальные фоны могут влиять на производительность
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VirtualBackgroundSelector;
