import { useState } from 'react';
import { Brain, Zap, Crown, Sparkles, Check, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAIModelSettings, OPENROUTER_MODELS, LOVABLE_MODELS, RECOMMENDED_MODELS, type AIModelConfig } from '@/hooks/useAIModelSettings';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const speedIcon = (speed: string) => {
  switch (speed) {
    case 'fastest': return <Zap className="w-3 h-3 text-yellow-400" />;
    case 'fast': return <Zap className="w-3 h-3 text-green-400" />;
    case 'medium': return <Brain className="w-3 h-3 text-blue-400" />;
    case 'slow': return <Crown className="w-3 h-3 text-purple-400" />;
    default: return null;
  }
};

const categoryColor = (cat: string) => {
  switch (cat) {
    case 'fast': return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'balanced': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'quality': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    case 'premium': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
};

export function AIModelSettings() {
  const { config, save, loading } = useAIModelSettings();
  const [open, setOpen] = useState(false);

  if (loading) return null;

  const isOpenRouter = config.provider === 'openrouter';
  const models = isOpenRouter ? OPENROUTER_MODELS : LOVABLE_MODELS;

  const handleProviderToggle = (checked: boolean) => {
    const newProvider = checked ? 'openrouter' : 'lovable';
    const defaultModel = newProvider === 'openrouter' ? 'openai/gpt-4o-mini' : 'google/gemini-2.5-flash';
    save({ provider: newProvider as AIModelConfig['provider'], model: defaultModel });
    toast.success(checked ? 'OpenRouter AI активирован' : 'Lovable AI активирован');
  };

  const handleModelSelect = (modelId: string) => {
    save({ ...config, model: modelId });
    const m = models.find(m => m.id === modelId);
    toast.success(`Модель: ${m?.name || modelId}`);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Модель
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">OpenRouter AI</Label>
            <p className="text-xs text-muted-foreground">
              {isOpenRouter ? '100+ моделей • Ваш ключ' : 'Lovable AI • Встроенный'}
            </p>
          </div>
          <Switch checked={isOpenRouter} onCheckedChange={handleProviderToggle} />
        </div>

        {/* Current model */}
        <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Активная модель</p>
          <div className="flex items-center gap-2">
            {speedIcon(models.find(m => m.id === config.model)?.speed || 'fast')}
            <span className="text-sm font-medium">
              {models.find(m => m.id === config.model)?.name || config.model}
            </span>
          </div>
        </div>

        {/* Auto-recommendations info */}
        <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1.5">🤖 Авто-выбор по задаче</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(RECOMMENDED_MODELS).map(([task, rec]) => {
              const modelId = isOpenRouter ? rec.openrouter : rec.lovable;
              const allModels = [...OPENROUTER_MODELS, ...LOVABLE_MODELS];
              const m = allModels.find(m => m.id === modelId);
              return (
                <div key={task} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>{rec.icon}</span>
                  <span className="truncate">{m?.name || modelId.split('/')[1]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model selector */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">
            <span>Выбрать модель</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 mt-2 max-h-[300px] overflow-y-auto pr-1">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all",
                    "hover:bg-muted/60 border border-transparent",
                    config.model === m.id && "bg-primary/10 border-primary/30"
                  )}
                >
                  {speedIcon(m.speed)}
                  <span className="flex-1 truncate">{m.name}</span>
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", categoryColor(m.category))}>
                    {m.category}
                  </Badge>
                  {config.model === m.id && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
