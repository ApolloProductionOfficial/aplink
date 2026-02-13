import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Loader2, User, MessageCircle, ExternalLink, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import CustomCursor from '@/components/CustomCursor';
import VoiceSettings from '@/components/VoiceSettings';
import DoNotDisturbSettings from '@/components/DoNotDisturbSettings';
import BotLanguageSettings from '@/components/BotLanguageSettings';
import AutoRecordSettings from '@/components/AutoRecordSettings';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import { AIModelSettings } from '@/components/AIModelSettings';

const Profile = () => {
  const { user, isLoading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Avatar crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url, telegram_username, telegram_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      } else if (data) {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url);
        setTelegramUsername(data.telegram_username);
        setTelegramId(data.telegram_id);
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername && cleanUsername.length < 3) {
      toast.error('Username должен быть минимум 3 символа');
      return;
    }

    if (cleanUsername && cleanUsername.length > 20) {
      toast.error('Username должен быть максимум 20 символов');
      return;
    }

    setSaving(true);

    // Check if username is taken
    if (cleanUsername) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        toast.error('Этот username уже занят');
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        username: cleanUsername || null,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Не удалось сохранить профиль');
    } else {
      toast.success('Профиль успешно обновлён');
    }

    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Заполните оба поля пароля');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен быть минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setChangingPassword(true);

    const { error } = await updatePassword(newPassword);

    if (error) {
      toast.error(error.message || 'Не удалось сменить пароль');
    } else {
      toast.success('Пароль успешно изменён');
      setNewPassword('');
      setConfirmPassword('');
    }

    setChangingPassword(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 5MB for crop)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Максимальный размер файла 5MB');
      return;
    }

    // Open crop dialog
    setSelectedImageFile(file);
    setCropDialogOpen(true);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropSave = async (croppedBlob: Blob) => {
    if (!user) return;

    setUploadingAvatar(true);
    setCropDialogOpen(false);

    const fileName = `${user.id}/avatar.jpg`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      toast.error('Не удалось загрузить аватар');
      setUploadingAvatar(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: newAvatarUrl })
      .eq('user_id', user.id);

    if (updateError) {
      toast.error('Не удалось обновить профиль');
    } else {
      setAvatarUrl(newAvatarUrl);
      toast.success('Аватар обновлён');
    }

    setUploadingAvatar(false);
    setSelectedImageFile(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cursor-none relative overflow-hidden">
      <CustomCursor />
      
      {/* Glassmorphism background effect */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-2xl border-b border-border/30 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="focus-visible:ring-0 ring-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Профиль</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md relative z-10">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div
            onClick={handleAvatarClick}
            className="relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                <User className="w-12 h-12 text-primary" />
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />

          <p className="text-sm text-muted-foreground mt-2">
            Нажмите, чтобы изменить аватар
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="displayName">Отображаемое имя</Label>
            <Input
              id="displayName"
              placeholder="Ваше имя"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">@username</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="username"
                placeholder="username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                      .slice(0, 20)
                  )
                }
                className="bg-background/50 pl-8"
              />
            </div>
            {/* Подсказка убрана */}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={user?.email || ''}
              disabled
              className="bg-muted/50 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email нельзя изменить
            </p>
          </div>

          {/* Telegram Status */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Telegram
            </Label>
            {telegramId ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  Привязан
                </Badge>
                <span className="text-sm font-medium">
                  {telegramUsername ? `@${telegramUsername}` : `ID: ${telegramId}`}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                  <Badge variant="secondary" className="text-muted-foreground">
                    Не привязан
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Для получения уведомлений о звонках
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <a
                    href="https://t.me/aplink_live_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Привязать через бота
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full focus-visible:ring-0 ring-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Сохранить
              </>
            )}
          </Button>

          {/* Change Password Section */}
          <div className="pt-6 border-t border-border space-y-4">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Lock className="w-4 h-4" />
              Сменить пароль
            </Label>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">Новый пароль</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Минимум 6 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Повторите новый пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
              variant="outline"
              className="w-full"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Смена пароля...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Сменить пароль
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* AI Model Settings */}
        <div className="mt-6">
          <AIModelSettings />
        </div>

        {/* Bot Language Settings */}
        <div className="mt-6">
          <BotLanguageSettings />
        </div>

        {/* Auto Record Settings */}
        <div className="mt-6">
          <AutoRecordSettings />
        </div>

        {/* Voice Settings */}
        <div className="mt-6">
          <VoiceSettings />
        </div>
        
        {/* Do Not Disturb Settings */}
        <div className="mt-6">
          <DoNotDisturbSettings />
        </div>
      </main>

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={cropDialogOpen}
        imageFile={selectedImageFile}
        onClose={() => {
          setCropDialogOpen(false);
          setSelectedImageFile(null);
        }}
        onSave={handleCropSave}
      />
    </div>
  );
};

export default Profile;
