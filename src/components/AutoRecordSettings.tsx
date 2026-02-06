import { useState, useEffect } from 'react';
import { Disc, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AutoRecordSettings = () => {
  const { user } = useAuth();
  const [autoRecordEnabled, setAutoRecordEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('auto_record_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading auto-record setting:', error);
      } else if (data) {
        setAutoRecordEnabled(data.auto_record_enabled ?? false);
      }

      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const handleToggle = async (checked: boolean) => {
    if (!user || saving) return;

    setSaving(true);
    setAutoRecordEnabled(checked);

    const { error } = await supabase
      .from('profiles')
      .update({ auto_record_enabled: checked })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error saving auto-record setting:', error);
      setAutoRecordEnabled(!checked);
      toast.error('Не удалось сохранить настройку');
    } else {
      toast.success(checked ? 'Автозапись включена' : 'Автозапись отключена');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="bg-background/40 backdrop-blur-2xl border-border/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-full bg-destructive/20">
              <Disc className="w-4 h-4 text-destructive" />
            </div>
            Автозапись
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background/40 backdrop-blur-2xl border-border/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={cn(
            "p-1.5 rounded-full transition-colors",
            autoRecordEnabled ? "bg-destructive/20" : "bg-muted"
          )}>
            <Disc className={cn(
              "w-4 h-4 transition-colors",
              autoRecordEnabled ? "text-destructive animate-pulse" : "text-muted-foreground"
            )} />
          </div>
          Автозапись
          {autoRecordEnabled && (
            <span className="ml-auto text-xs font-normal text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              Активна
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-record" className="text-sm font-medium">
              Автоматическая запись звонков
            </Label>
            <p className="text-xs text-muted-foreground">
              При входе в комнату запись начнётся автоматически
            </p>
          </div>
          <Switch
            id="auto-record"
            checked={autoRecordEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className="text-xs text-muted-foreground bg-muted/20 backdrop-blur-sm rounded-lg p-3 border border-border/20">
          <p className="flex items-center gap-2">
            <Disc className={cn(
              "w-3 h-3",
              autoRecordEnabled ? "text-destructive" : "text-muted-foreground"
            )} />
            {autoRecordEnabled
              ? 'Записи сохраняются автоматически в «Мои созвоны»'
              : 'По умолчанию выключено. Вы сможете вручную начать запись во время звонка'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AutoRecordSettings;
