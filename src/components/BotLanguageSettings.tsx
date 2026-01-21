import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Globe, Loader2, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

type BotLang = 'ru' | 'en' | 'uk';

const LANGUAGES: Record<BotLang, { flag: string; name: string; nativeName: string }> = {
  ru: { flag: '🇷🇺', name: 'Russian', nativeName: 'Русский' },
  en: { flag: '🇬🇧', name: 'English', nativeName: 'English' },
  uk: { flag: '🇺🇦', name: 'Ukrainian', nativeName: 'Українська' },
};

const BotLanguageSettings = () => {
  const { user } = useAuth();
  const [botLanguage, setBotLanguage] = useState<BotLang>('ru');
  const [telegramLinked, setTelegramLinked] = useState(false);
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
        .select('bot_language, telegram_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setBotLanguage((data.bot_language as BotLang) || 'ru');
        setTelegramLinked(!!data.telegram_id);
      }
    } catch (error) {
      console.error('Error loading bot language settings:', error);
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
        .update({ bot_language: botLanguage })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(
        botLanguage === 'ru' ? 'Язык бота сохранён' :
        botLanguage === 'uk' ? 'Мову бота збережено' :
        'Bot language saved'
      );
    } catch (error) {
      console.error('Error saving bot language:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
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
          <Globe className="w-5 h-5 text-primary" />
          Язык Telegram бота
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!telegramLinked && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
            <MessageCircle className="w-4 h-4 flex-shrink-0" />
            <span>Привяжите Telegram для использования бота</span>
          </div>
        )}

        <div className="space-y-3">
          <Label>Язык / Language / Мова</Label>
          <RadioGroup
            value={botLanguage}
            onValueChange={(v: BotLang) => setBotLanguage(v)}
            className="grid grid-cols-1 gap-2"
          >
            {(Object.entries(LANGUAGES) as [BotLang, typeof LANGUAGES.ru][]).map(([key, lang]) => (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  botLanguage === key
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value={key} className="flex-shrink-0" />
                <span className="text-xl">{lang.flag}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{lang.nativeName}</span>
                  <span className="text-xs text-muted-foreground">{lang.name}</span>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

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
          {botLanguage === 'ru' ? 'Сохранить' :
           botLanguage === 'uk' ? 'Зберегти' :
           'Save'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          {botLanguage === 'ru' ? 'Этот язык используется для всех сообщений от Telegram бота' :
           botLanguage === 'uk' ? 'Ця мова використовується для всіх повідомлень від Telegram бота' :
           'This language is used for all Telegram bot messages'}
        </p>
      </CardContent>
    </Card>
  );
};

export default BotLanguageSettings;
