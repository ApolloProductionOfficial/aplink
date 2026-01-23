import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { FACE_FILTERS, FilterType } from '@/hooks/useFaceFilters';

interface FaceFilterSelectorProps {
  activeFilter: FilterType;
  onSelectFilter: (filter: FilterType) => void;
}

export function FaceFilterSelector({ activeFilter, onSelectFilter }: FaceFilterSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg [&_svg]:drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]",
            activeFilter !== 'none'
              ? "bg-pink-500/30 border-pink-500/50 hover:bg-pink-500/40"
              : "bg-white/10 hover:bg-white/20"
          )}
          title="Фильтры лица"
        >
          <Sparkles className={cn(
            "w-5 h-5",
            activeFilter !== 'none' && "text-pink-400"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="center"
        className="w-64 p-3 bg-black/80 backdrop-blur-xl border-white/10 rounded-2xl"
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="font-medium text-sm">Фильтры</span>
            </div>
            
            {activeFilter !== 'none' && (
              <button
                onClick={() => onSelectFilter('none')}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-all text-xs text-red-300"
              >
                <X className="w-3 h-3" />
                <span>Сброс</span>
              </button>
            )}
          </div>

          {/* Filter grid */}
          <div className="grid grid-cols-3 gap-2">
            {FACE_FILTERS.filter(f => f.id !== 'none').map((filter) => (
              <button
                key={filter.id}
                onClick={() => onSelectFilter(filter.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                  activeFilter === filter.id
                    ? "bg-pink-500/30 border border-pink-500/50"
                    : "bg-white/5 border border-white/10 hover:bg-white/10"
                )}
              >
                <div 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500"
                  style={{ filter: filter.cssFilter }}
                />
                <span className="text-[10px] text-muted-foreground">{filter.label}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Применяется ко всем видео
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FaceFilterSelector;
