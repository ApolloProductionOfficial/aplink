import { useState, useRef } from "react";
import { Palette, Loader2, Sparkles, Building2, Trees, Rocket, Umbrella, Crown, Upload, Image } from "lucide-react";
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
    id: 'apollo', 
    url: '/videos/apollo-logo-bg.mp4', 
    label: 'Apollo',
    icon: Crown,
    isVideo: true
  },
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBlurSelect = (intensity: number, id: string) => {
    if (selectedId === id) {
      // Toggle off - remove background
      onRemove();
      setSelectedId(null);
    } else {
      onSelectBlur(intensity);
      setSelectedId(id);
    }
  };

  const handleImageSelect = (url: string, id: string) => {
    if (selectedId === id) {
      // Toggle off - remove background
      onRemove();
      setSelectedId(null);
    } else {
      onSelectImage(url);
      setSelectedId(id);
    }
  };

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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "w-12 h-12 rounded-full border-white/20 transition-all hover:scale-105",
            selectedId 
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
        className="w-80 p-4 glass-dark border-white/10 rounded-[1.5rem]" 
        side="top"
        align="center"
        sideOffset={12}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Виртуальный фон</span>
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
                    isSelected(option.id)
                      ? "bg-primary/30 border-primary/60 shadow-lg shadow-primary/20"
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
            <div className="grid grid-cols-5 gap-2">
              {IMAGE_OPTIONS.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleImageSelect(option.url, option.id)}
                    disabled={isProcessing}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                      "border hover:border-primary/50 hover:scale-105",
                      isSelected(option.id)
                        ? "bg-primary/30 border-primary/60 shadow-lg shadow-primary/20"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      option.id === 'apollo' 
                        ? "bg-gradient-to-br from-amber-500/30 to-amber-600/10" 
                        : "bg-gradient-to-br from-primary/20 to-primary/5"
                    )}>
                      <IconComponent className={cn(
                        "w-4 h-4",
                        option.id === 'apollo' ? "text-amber-400" : "text-primary"
                      )} />
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{option.label}</span>
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
              disabled={isProcessing}
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
                  <span className="text-sm">Загружен</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Загрузить изображение</span>
                </>
              )}
            </button>
          </div>

          {/* Note */}
          <p className="text-[10px] text-muted-foreground/70 text-center">
            Нажмите повторно для отмены • Влияет на производительность
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default VirtualBackgroundSelector;