import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Moon, Loader2, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

const DoNotDisturbSettings = () => {
  const { user } = useAuth();
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStartTime, setDndStartTime] = useState('22:00');
  const [dndEndTime, setDndEndTime] = useState('08:00');
  const [dndAutoReply, setDndAutoReply] = useState('Пользователь сейчас недоступен. Попробуйте позже.');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        const profile = data as Record<string, unknown>;
        setDndEnabled((profile.dnd_enabled as boolean) || false);
        setDndStartTime((profile.dnd_start_time as string) || '22:00');
        setDndEndTime((profile.dnd_end_time as string) || '08:00');
        setDndAutoReply((profile.dnd_auto_reply as string) || 'Пользователь сейчас недоступен. Попробуйте позже.');
      }
    } catch (error) {
      console.error('Error loading DND settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          dnd_enabled: dndEnabled,
          dnd_start_time: dndStartTime,
          dnd_end_time: dndEndTime,
          dnd_auto_reply: dndAutoReply,
        } as Record<string, unknown>)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Настройки "Не беспокоить" сохранены');
    } catch (error) {
      console.error('Error saving DND settings:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const isCurrentlyDND = () => {
    if (!dndEnabled) return false;
    
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Handle overnight DND (e.g., 22:00 to 08:00)
    if (dndStartTime > dndEndTime) {
      return currentTime >= dndStartTime || currentTime <= dndEndTime;
    }
    
    return currentTime >= dndStartTime && currentTime <= dndEndTime;
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Moon className="w-5 h-5 text-primary" />
          Режим "Не беспокоить"
          {isCurrentlyDND() && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              Активен
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Включить режим</Label>
            <p className="text-xs text-muted-foreground">
              Звонки будут автоматически отклоняться в указанное время
            </p>
          </div>
          <Switch
            checked={dndEnabled}
            onCheckedChange={setDndEnabled}
          />
        </div>

        {/* Time range */}
        <div className={`space-y-4 transition-opacity ${dndEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Начало
              </Label>
              <Input
                type="time"
                value={dndStartTime}
                onChange={(e) => setDndStartTime(e.target.value)}
                disabled={!dndEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Конец
              </Label>
              <Input
                type="time"
                value={dndEndTime}
                onChange={(e) => setDndEndTime(e.target.value)}
                disabled={!dndEnabled}
              />
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            {dndStartTime > dndEndTime 
              ? `Ночной режим: с ${dndStartTime} до ${dndEndTime} следующего дня`
              : `Дневной режим: с ${dndStartTime} до ${dndEndTime}`
            }
          </p>
        </div>

        {/* Auto-reply message */}
        <div className={`space-y-2 transition-opacity ${dndEnabled ? 'opacity-100' : 'opacity-50'}`}>
          <Label>Автоответ</Label>
          <Textarea
            value={dndAutoReply}
            onChange={(e) => setDndAutoReply(e.target.value)}
            disabled={!dndEnabled}
            rows={2}
            placeholder="Сообщение для звонящих..."
          />
          <p className="text-xs text-muted-foreground">
            Это сообщение будет отправлено в Telegram звонящим
          </p>
        </div>

        {/* Save button */}
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Сохранить настройки
        </Button>
      </CardContent>
    </Card>
  );
};

export default DoNotDisturbSettings;
