import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, Check, Play } from 'lucide-react';
import { toast } from 'sonner';

// ElevenLabs voice IDs
const VOICES = {
  female: {
    id: 'FGY2WhTYpPnrIDTdsKH5', // Laura
    name: 'Laura (Женский)',
    description: 'Чёткий женский голос'
  },
  male: {
    id: 'JBFqnCBsd6RMkjVDRZzb', // George
    name: 'George (Мужской)',
    description: 'Глубокий мужской голос'
  }
};

const VoiceSettings = () => {
  const { user } = useAuth();
  const [voicePreference, setVoicePreference] = useState<'female' | 'male'>('female');
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

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
        // Type assertion since columns may not be in types yet
        const profile = data as Record<string, unknown>;
        setVoicePreference((profile.voice_preference as 'female' | 'male') || 'female');
        setVoiceSpeed((profile.voice_speed as number) || 1.0);
      }
    } catch (error) {
      console.error('Error loading voice settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Use raw update since columns may not be in types yet
      const { error } = await supabase
        .from('profiles')
        .update({
          voice_preference: voicePreference,
          voice_speed: voiceSpeed,
        } as Record<string, unknown>)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Настройки голоса сохранены');
    } catch (error) {
      console.error('Error saving voice settings:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const testVoice = async () => {
    setTesting(true);
    try {
      const testMessage = voicePreference === 'female' 
        ? 'Привет! Это тестовое голосовое сообщение. Я Laura.'
        : 'Привет! Это тестовое голосовое сообщение. Я George.';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            text: testMessage,
            voiceId: VOICES[voicePreference].id,
            speed: voiceSpeed,
          }),
        }
      );

      if (!response.ok) throw new Error('TTS request failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error('Error testing voice:', error);
      toast.error('Ошибка воспроизведения. Попробуйте позже.');
    } finally {
      setTesting(false);
    }
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
          <Volume2 className="w-5 h-5 text-primary" />
          Настройки голосовых уведомлений
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voice selection */}
        <div className="space-y-3">
          <Label>Голос для уведомлений</Label>
          <RadioGroup
            value={voicePreference}
            onValueChange={(v: 'female' | 'male') => setVoicePreference(v)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {Object.entries(VOICES).map(([key, voice]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                  voicePreference === key
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value={key} className="mt-0.5" />
                <div>
                  <div className="font-medium">{voice.name}</div>
                  <div className="text-sm text-muted-foreground">{voice.description}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Speed slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Скорость речи</Label>
            <span className="text-sm font-mono text-muted-foreground">{voiceSpeed.toFixed(1)}x</span>
          </div>
          <Slider
            value={[voiceSpeed]}
            onValueChange={([v]) => setVoiceSpeed(v)}
            min={0.7}
            max={1.3}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Медленнее (0.7x)</span>
            <span>Быстрее (1.3x)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={testVoice}
            disabled={testing}
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Тест голоса
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Сохранить
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Эти настройки применяются к голосовым уведомлениям о входящих звонках в Telegram
        </p>
      </CardContent>
    </Card>
  );
};

export default VoiceSettings;
