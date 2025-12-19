import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, User, Pencil, Check, X, Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import CustomCursor from '@/components/CustomCursor';
import AnimatedBackground from '@/components/AnimatedBackground';
import logoVideo from '@/assets/logo-video.mov';

interface MeetingTranscript {
  id: string;
  room_id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
  key_points: {
    summary?: string;
    keyPoints?: string[];
    actionItems?: string[];
    decisions?: string[];
  } | null;
  participants: string[] | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState('calls');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
        setEditedName(profileData.display_name || '');
        setEditedUsername(profileData.username || '');
      }
      
      // Fetch transcripts where user participated
      const { data: transcriptsData } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (transcriptsData) {
        setTranscripts(transcriptsData as MeetingTranscript[]);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSaveName = async () => {
    if (!user || !editedName.trim()) return;
    
    // Validate username format
    if (editedUsername && !/^[a-z0-9_]{3,20}$/.test(editedUsername)) {
      toast({
        title: 'Ошибка',
        description: 'Username должен содержать 3-20 символов (a-z, 0-9, _)',
        variant: 'destructive',
      });
      return;
    }
    
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: editedName.trim(),
          username: editedUsername || null
        })
        .eq('user_id', user.id);
      
      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Ошибка',
            description: 'Этот @username уже занят',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }
      
      setProfile(prev => prev ? { ...prev, display_name: editedName.trim(), username: editedUsername || null } : null);
      setIsEditingName(false);
      toast({
        title: 'Профиль сохранён',
        description: 'Ваши данные успешно обновлены',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить профиль',
        variant: 'destructive',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(profile?.display_name || '');
    setEditedUsername(profile?.username || '');
    setIsEditingName(false);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, выберите изображение',
        variant: 'destructive',
      });
      return;
    }

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

    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const newAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

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
      setProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);
      toast({ title: 'Аватар обновлён' });
    }

    setUploadingAvatar(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cursor-none">
      <CustomCursor />
      <AnimatedBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <video 
                src={logoVideo} 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-8 h-8 object-cover rounded-full"
              />
              <span className="font-semibold">APLink</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'calls' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('calls')}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Записи
            </Button>
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('profile')}
              className="gap-2"
            >
              <User className="w-4 h-4" />
              Профиль
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Мои созвоны
            </h1>
            
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              </div>
            ) : transcripts.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет записей созвонов</p>
                  <p className="text-sm mt-2">После завершения созвона здесь появится его конспект</p>
                  <Button
                    onClick={() => navigate('/')}
                    className="mt-4"
                  >
                    Начать созвон
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {transcripts.map((transcript) => (
                  <Card key={transcript.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            {transcript.room_name}
                          </CardTitle>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(transcript.started_at)}
                            </span>
                            {transcript.participants && (
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {transcript.participants.length} участников
                              </span>
                            )}
                          </div>
                        </div>
                        {transcript.ended_at && (
                          <Badge variant="secondary">Завершён</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {transcript.summary && (
                        <div className="mb-4">
                          <h4 className="font-medium mb-2">Краткое содержание</h4>
                          <p className="text-muted-foreground">{transcript.summary}</p>
                        </div>
                      )}
                      
                      {transcript.key_points && (
                        <Accordion type="single" collapsible className="w-full">
                          {transcript.key_points.keyPoints && transcript.key_points.keyPoints.length > 0 && (
                            <AccordionItem value="key-points">
                              <AccordionTrigger>Ключевые моменты</AccordionTrigger>
                              <AccordionContent>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                  {transcript.key_points.keyPoints.map((point, i) => (
                                    <li key={i}>{point}</li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                          
                          {transcript.key_points.actionItems && transcript.key_points.actionItems.length > 0 && (
                            <AccordionItem value="actions">
                              <AccordionTrigger>Задачи к выполнению</AccordionTrigger>
                              <AccordionContent>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                  {transcript.key_points.actionItems.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                          
                          {transcript.key_points.decisions && transcript.key_points.decisions.length > 0 && (
                            <AccordionItem value="decisions">
                              <AccordionTrigger>Принятые решения</AccordionTrigger>
                              <AccordionContent>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                  {transcript.key_points.decisions.map((decision, i) => (
                                    <li key={i}>{decision}</li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                          
                          {transcript.transcript && (
                            <AccordionItem value="transcript">
                              <AccordionTrigger>Полная транскрипция</AccordionTrigger>
                              <AccordionContent>
                                <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                                    {transcript.transcript}
                                  </pre>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              Мой профиль
            </h1>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50 max-w-md">
              <CardContent className="pt-6 space-y-6">
                {/* Avatar */}
                <div className="flex flex-col items-center">
                  <div
                    onClick={handleAvatarClick}
                    className="relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group"
                  >
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <User className="w-12 h-12 text-primary" />
                      </div>
                    )}
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
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Отображаемое имя</Label>
                    <Input
                      id="displayName"
                      placeholder="Ваше имя"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">@username</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        id="username"
                        placeholder="username"
                        value={editedUsername}
                        onChange={(e) =>
                          setEditedUsername(
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
                    <p className="text-xs text-muted-foreground">Email нельзя изменить</p>
                  </div>

                  <Button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="w-full"
                  >
                    {savingName ? (
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
