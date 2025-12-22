import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Check, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CustomCursor from '@/components/CustomCursor';

const Profile = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        .select('display_name, username, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      } else if (data) {
        setDisplayName(data.display_name || '');
        setUsername(data.username || '');
        setAvatarUrl(data.avatar_url);
      }

      setLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername && cleanUsername.length < 3) {
      toast({
        title: 'Ошибка',
        description: 'Username должен быть минимум 3 символа',
        variant: 'destructive',
      });
      return;
    }

    if (cleanUsername && cleanUsername.length > 20) {
      toast({
        title: 'Ошибка',
        description: 'Username должен быть максимум 20 символов',
        variant: 'destructive',
      });
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
        toast({
          title: 'Ошибка',
          description: 'Этот username уже занят',
          variant: 'destructive',
        });
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
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить профиль',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Сохранено',
        description: 'Профиль успешно обновлён',
      });
    }

    setSaving(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, выберите изображение',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Максимальный размер файла 2MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingAvatar(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить аватар',
        variant: 'destructive',
      });
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
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить профиль',
        variant: 'destructive',
      });
    } else {
      setAvatarUrl(newAvatarUrl);
      toast({
        title: 'Аватар обновлён',
      });
    }

    setUploadingAvatar(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cursor-none">
      <CustomCursor />
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
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

      <main className="container mx-auto px-4 py-8 max-w-md">
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
            <p className="text-xs text-muted-foreground">
              3–20 символов: латиница, цифры, подчёркивание
            </p>
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
        </div>
      </main>
    </div>
  );
};

export default Profile;
