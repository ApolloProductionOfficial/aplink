import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, User, Camera, Loader2, Check, Globe, Shield, Trash2 } from 'lucide-react';
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
import TwoFactorSetup from '@/components/TwoFactorSetup';
import apolloLogo from '@/assets/apollo-logo.mp4';

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

interface ParticipantWithIP {
  id: string;
  room_id: string;
  user_name: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
  // Geo data joined from participant_geo_data (admin only)
  geo?: {
    ip_address: string | null;
    city: string | null;
    country: string | null;
    region: string | null;
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading, signOut, isAdmin } = useAuth();
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
  const [participants, setParticipants] = useState<ParticipantWithIP[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);

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

  // Fetch participants for IP checker (admin only)
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== 'ip-checker') return;
    
    const fetchParticipants = async () => {
      setLoadingParticipants(true);
      
      // First get participants
      const { data: participantsData } = await supabase
        .from('meeting_participants')
        .select('*')
        .order('joined_at', { ascending: false })
        .limit(100);
      
      if (participantsData && participantsData.length > 0) {
        // Then get geo data for these participants
        const participantIds = participantsData.map(p => p.id);
        const { data: geoData } = await supabase
          .from('participant_geo_data')
          .select('*')
          .in('participant_id', participantIds);
        
        // Merge geo data with participants
        const geoMap = new Map(geoData?.map(g => [g.participant_id, g]) || []);
        const merged = participantsData.map(p => ({
          ...p,
          geo: geoMap.get(p.id) || null
        }));
        
        setParticipants(merged as ParticipantWithIP[]);
      } else {
        setParticipants([]);
      }
      
      setLoadingParticipants(false);
    };
    
    fetchParticipants();
  }, [user, isAdmin, activeTab]);

  // Check if user has 2FA enabled
  useEffect(() => {
    if (!user) return;
    
    const check2FAStatus = async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      if (data?.totp && data.totp.length > 0) {
        setHas2FA(true);
      } else {
        setHas2FA(false);
      }
    };
    
    check2FAStatus();
  }, [user]);

  const disable2FA = async () => {
    setDisabling2FA(true);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      
      if (factorsData?.totp?.[0]) {
        const { error } = await supabase.auth.mfa.unenroll({
          factorId: factorsData.totp[0].id,
        });
        
        if (error) throw error;
        
        setHas2FA(false);
        toast({
          title: 'Успешно',
          description: '2FA отключена',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Ошибка',
        description: err.message || 'Не удалось отключить 2FA',
        variant: 'destructive',
      });
    } finally {
      setDisabling2FA(false);
    }
  };

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
    <div className="min-h-screen bg-background">
      <CustomCursor />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-9 w-9 rounded-full hover:bg-primary/10"
              title="На главную"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {/* Logo - same as main page */}
            <div 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 md:gap-3 cursor-pointer group"
            >
              <div className="relative w-10 h-10 md:w-12 md:h-12">
                <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
                <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                  <video 
                    src={apolloLogo} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover scale-[1.3] origin-center"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                  APLink
                </span>
                <span className="text-[9px] md:text-xs text-muted-foreground -mt-1">
                  by Apollo Production
                </span>
              </div>
            </div>
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
            {isAdmin && (
              <Button
                variant={activeTab === 'ip-checker' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('ip-checker')}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                IP-чекер
              </Button>
            )}
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
            <h1 className="text-2xl font-bold flex items-center gap-2 justify-center">
              <User className="w-6 h-6 text-primary" />
              Мой профиль
            </h1>

            <Card className="bg-card/50 backdrop-blur-sm border-border/50 max-w-md mx-auto">
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
                  
                  {/* 2FA Section */}
                  <div className="pt-4 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        <span className="font-medium">Двухфакторная аутентификация</span>
                      </div>
                      {has2FA ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          Включена
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Выключена
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {has2FA 
                        ? 'Ваш аккаунт защищён двухфакторной аутентификацией'
                        : 'Добавьте дополнительный уровень защиты вашего аккаунта'
                      }
                    </p>
                    
                    {has2FA ? (
                      <Button
                        variant="outline"
                        onClick={disable2FA}
                        disabled={disabling2FA}
                        className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                      >
                        {disabling2FA ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Отключить 2FA
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setShow2FASetup(true)}
                        className="w-full border-primary/50 hover:bg-primary/10"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Настроить 2FA
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IP Checker Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="ip-checker" className="space-y-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                IP-чекер участников
              </h1>

              <Card className="bg-card/50 backdrop-blur-sm border-border/50 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">Данные участников ({participants.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingParticipants ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : participants.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Нет данных об участниках</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-medium">Имя</th>
                            <th className="text-left p-3 font-medium">Комната</th>
                            <th className="text-left p-3 font-medium">IP</th>
                            <th className="text-left p-3 font-medium">Локация</th>
                            <th className="text-left p-3 font-medium">Время входа</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map((p) => (
                            <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="p-3">{p.user_name}</td>
                              <td className="p-3 text-muted-foreground">{p.room_id}</td>
                              <td className="p-3 font-mono text-xs">{p.geo?.ip_address || '—'}</td>
                              <td className="p-3 text-muted-foreground">
                                {p.geo?.city && p.geo?.country ? `${p.geo.city}, ${p.geo.country}` : p.geo?.country || '—'}
                              </td>
                              <td className="p-3 text-muted-foreground">
                                {new Date(p.joined_at).toLocaleString('ru-RU')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
      
      {/* 2FA Setup Dialog */}
      <TwoFactorSetup
        isOpen={show2FASetup}
        onClose={() => setShow2FASetup(false)}
        onSuccess={() => setHas2FA(true)}
      />
    </div>
  );
};

export default Dashboard;
