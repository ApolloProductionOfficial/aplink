import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, Image, Video, Save, RefreshCw, Eye, MessageCircle, X, CheckCircle2 } from 'lucide-react';

interface WelcomeSettings {
  id: string;
  file_id: string | null;
  media_url: string | null;
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
        const settingsData = data as WelcomeSettings;
        setSettings(settingsData);
        setCaptionRu(data.caption_ru || '');
        setCaptionEn(data.caption_en || '');
        setCaptionUk(data.caption_uk || '');
        // Set preview from existing media_url
        if (settingsData.media_url) {
          setMediaPreview(settingsData.media_url);
        }
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
      const fileExt = mediaFile.name.split('.').pop()?.toLowerCase() || 'gif';
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

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload media if new file selected
      let mediaUrl: string | null = settings?.media_url || null;
      if (mediaFile) {
        const uploadedUrl = await uploadMedia();
        if (!uploadedUrl) {
          setSaving(false);
          return;
        }
        mediaUrl = uploadedUrl;
      }

      const updateData: Record<string, unknown> = {
        caption_ru: captionRu || null,
        caption_en: captionEn || null,
        caption_uk: captionUk || null,
        media_url: mediaUrl,
        updated_at: new Date().toISOString(),
      };

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

      toast.success('Приветствие сохранено! Медиа будет отправляться в боте.');
      await fetchSettings();
      setMediaFile(null);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const isVideo = (url: string) => {
    return url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov');
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
          🎬 Приветствие бота
        </CardTitle>
        <CardDescription>
          Настройте приветственное сообщение и медиа для команды /start
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Media Upload Section */}
        <div className="space-y-4">
          <Label className="flex items-center gap-2 text-base font-medium">
            <Video className="w-4 h-4" />
            Медиафайл (GIF / Видео / Фото)
          </Label>
          
          {/* Current/New Media Preview */}
          {mediaPreview ? (
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
              <div className="aspect-video flex items-center justify-center bg-black/20">
                {isVideo(mediaPreview) ? (
                  <video 
                    src={mediaPreview} 
                    className="max-h-64 w-auto rounded"
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                  />
                ) : (
                  <img 
                    src={mediaPreview} 
                    alt="Welcome media preview" 
                    className="max-h-64 w-auto rounded object-contain"
                  />
                )}
              </div>
              <div className="absolute top-2 right-2 flex gap-2">
                {mediaFile && (
                  <span className="px-2 py-1 bg-green-500/90 text-white text-xs rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Новый файл
                  </span>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRemoveMedia}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {settings?.media_url && !mediaFile && (
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 bg-primary/90 text-primary-foreground text-xs rounded-full">
                    Текущее медиа
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div 
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-1">Нажмите для загрузки</p>
              <p className="text-xs text-muted-foreground">GIF, MP4, JPG, PNG, WEBP (до 20MB)</p>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {mediaPreview && (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Заменить файл
            </Button>
          )}
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
            <span className="text-sm font-medium">Предпросмотр сообщения (RU)</span>
          </div>
          <div className="p-3 bg-background rounded border text-sm whitespace-pre-wrap">
            {captionRu || <span className="text-muted-foreground italic">Текст не задан</span>}
          </div>
        </div>

        {/* Status Info */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2">
          <div className="flex items-center gap-3">
            {settings?.media_url || mediaFile ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-500 font-medium">Медиа настроено</span>
              </>
            ) : (
              <>
                <Image className="w-5 h-5 text-yellow-500" />
                <span className="text-yellow-500 font-medium">Медиа не загружено</span>
              </>
            )}
          </div>
          {settings?.file_id && (
            <p className="text-xs text-muted-foreground">
              Telegram file_id: {settings.file_id.substring(0, 30)}...
            </p>
          )}
        </div>

        {/* Last Updated */}
        {settings?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Последнее обновление: {new Date(settings.updated_at).toLocaleString('ru-RU')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || uploading} className="gap-2">
            {saving || uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {uploading ? 'Загрузка...' : saving ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button variant="outline" onClick={fetchSettings} disabled={loading} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Обновить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
