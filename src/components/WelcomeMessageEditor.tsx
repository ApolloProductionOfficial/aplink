import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, Image, Video, Save, RefreshCw, Eye, MessageCircle } from 'lucide-react';

interface WelcomeSettings {
  id: string;
  file_id: string | null;
  caption_ru: string | null;
  caption_en: string | null;
  caption_uk: string | null;
  updated_at: string;
}

export default function WelcomeMessageEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WelcomeSettings | null>(null);
  const [captionRu, setCaptionRu] = useState('');
  const [captionEn, setCaptionEn] = useState('');
  const [captionUk, setCaptionUk] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bot_welcome_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as WelcomeSettings);
        setCaptionRu(data.caption_ru || '');
        setCaptionEn(data.caption_en || '');
        setCaptionUk(data.caption_uk || '');
      }
    } catch (err) {
      console.error('Failed to fetch welcome settings:', err);
      toast.error('Ошибка загрузки настроек');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error('Поддерживаются только GIF, JPG, PNG, WEBP, MP4');
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Максимальный размер файла: 20MB');
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const uploadMedia = async (): Promise<string | null> => {
    if (!mediaFile) return null;

    setUploading(true);
    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `welcome-media-${Date.now()}.${fileExt}`;
      const filePath = `bot/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, mediaFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Ошибка загрузки файла');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload media if new file selected
      let mediaUrl: string | null = null;
      if (mediaFile) {
        mediaUrl = await uploadMedia();
        if (!mediaUrl && mediaFile) {
          setSaving(false);
          return;
        }
      }

      const updateData: Record<string, unknown> = {
        caption_ru: captionRu || null,
        caption_en: captionEn || null,
        caption_uk: captionUk || null,
        updated_at: new Date().toISOString(),
      };

      // Note: file_id must be set via Telegram bot command (it's a Telegram-side identifier)
      // Here we can only update captions from the web admin

      if (settings?.id) {
        const { error } = await supabase
          .from('bot_welcome_settings')
          .update(updateData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bot_welcome_settings')
          .insert(updateData);

        if (error) throw error;
      }

      toast.success('Приветствие сохранено!');
      await fetchSettings();
      setMediaFile(null);
      setMediaPreview(null);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Welcome Message
        </CardTitle>
        <CardDescription>
          Настройте приветственное сообщение бота для команды /start.
          <br />
          <span className="text-yellow-500">⚠️ Медиафайл (GIF/видео) можно задать только через Telegram командой /setwelcome</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Media Status */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center gap-3">
            {settings?.file_id ? (
              <>
                <Video className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-500">Медиа установлено</p>
                  <p className="text-xs text-muted-foreground">
                    file_id: {settings.file_id.substring(0, 20)}...
                  </p>
                </div>
              </>
            ) : (
              <>
                <Image className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Медиа не установлено</p>
                  <p className="text-xs text-muted-foreground">
                    Используйте /setwelcome в Telegram для загрузки GIF/видео
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Caption Fields */}
        <div className="grid gap-4">
          <div>
            <Label htmlFor="caption-ru" className="flex items-center gap-2 mb-2">
              🇷🇺 Русский
            </Label>
            <Textarea
              id="caption-ru"
              value={captionRu}
              onChange={(e) => setCaptionRu(e.target.value)}
              placeholder="Приветственный текст на русском..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div>
            <Label htmlFor="caption-en" className="flex items-center gap-2 mb-2">
              🇬🇧 English
            </Label>
            <Textarea
              id="caption-en"
              value={captionEn}
              onChange={(e) => setCaptionEn(e.target.value)}
              placeholder="Welcome text in English..."
              rows={4}
              className="resize-none"
            />
          </div>

          <div>
            <Label htmlFor="caption-uk" className="flex items-center gap-2 mb-2">
              🇺🇦 Українська
            </Label>
            <Textarea
              id="caption-uk"
              value={captionUk}
              onChange={(e) => setCaptionUk(e.target.value)}
              placeholder="Привітальний текст українською..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Предпросмотр (RU)</span>
          </div>
          <div className="p-3 bg-background rounded border text-sm whitespace-pre-wrap">
            {captionRu || <span className="text-muted-foreground italic">Текст не задан</span>}
          </div>
        </div>

        {/* Last Updated */}
        {settings?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Последнее обновление: {new Date(settings.updated_at).toLocaleString('ru-RU')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </Button>
          <Button variant="outline" onClick={fetchSettings} disabled={loading} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Button>
        </div>

        {/* Telegram Command Help */}
        <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            💡 Как установить медиа через Telegram
          </h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>1. Отправьте GIF/видео/фото боту с командой в caption:</p>
            <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
{`/setwelcome

🇷🇺 RU:
Текст на русском

🇬🇧 EN:
Text in English

🇺🇦 UK:
Текст українською`}
            </pre>
            <p>2. Или ответьте /setwelcome reply на сообщение с медиа.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
