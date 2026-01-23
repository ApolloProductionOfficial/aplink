import { useState } from "react";
import { Palette, X, Loader2, Image, Sparkles } from "lucide-react";
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
  { id: 'blur-light', intensity: 5, label: 'Лёгкое размытие', icon: '🌫️' },
  { id: 'blur-strong', intensity: 15, label: 'Сильное размытие', icon: '🌁' },
];

const IMAGE_OPTIONS = [
  { id: 'office', url: '/backgrounds/office.jpg', label: 'Офис', icon: '🏢' },
  { id: 'nature', url: '/backgrounds/nature.jpg', label: 'Природа', icon: '🌲' },
  { id: 'space', url: '/backgrounds/space.jpg', label: 'Космос', icon: '🌌' },
  { id: 'beach', url: '/backgrounds/beach.jpg', label: 'Пляж', icon: '🏖️' },
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
          variant={currentBackground !== 'none' ? "default" : "outline"}
          size="icon"
          className={cn(
            "w-12 h-12 rounded-xl border-border/50 transition-all",
            currentBackground !== 'none' 
              ? "bg-primary/20 border-primary/50" 
              : "bg-card hover:bg-card/80"
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
        className="w-72 p-3 glass-dark border-border/50" 
        side="top"
        align="center"
      >
        <div className="space-y-3">
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
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="w-3 h-3 mr-1" />
                Убрать
              </Button>
            )}
          </div>

          {/* Blur options */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Размытие</span>
            <div className="grid grid-cols-2 gap-2">
              {BLUR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleBlurSelect(option.intensity, option.id)}
                  disabled={isProcessing}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                    "border hover:border-primary/50",
                    currentBackground === option.id
                      ? "bg-primary/20 border-primary/50"
                      : "bg-background/50 border-border/50 hover:bg-background"
                  )}
                >
                  <span className="text-xl">{option.icon}</span>
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image options */}
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Изображения</span>
            <div className="grid grid-cols-4 gap-2">
              {IMAGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleImageSelect(option.url)}
                  disabled={isProcessing}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                    "border hover:border-primary/50",
                    currentBackground === 'image'
                      ? "bg-primary/20 border-primary/50"
                      : "bg-background/50 border-border/50 hover:bg-background"
                  )}
                >
                  <span className="text-lg">{option.icon}</span>
                  <span className="text-[10px] truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <p className="text-[10px] text-muted-foreground text-center">
            Виртуальные фоны могут влиять на производительность
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VirtualBackgroundSelector;
