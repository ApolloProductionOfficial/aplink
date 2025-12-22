import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, Clock, MapPin, Globe, Shield, User, Camera, Save, Trash2, Loader2, BarChart3, Languages, MousePointer, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import CustomCursor from '@/components/CustomCursor';
import AnimatedBackground from '@/components/AnimatedBackground';
import TwoFactorSetup from '@/components/TwoFactorSetup';
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

interface MeetingParticipant {
  id: string;
  room_id: string;
  user_name: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

interface ParticipantGeoData {
  id: string;
  participant_id: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface AnalyticsStats {
  totalPageViews: number;
  totalTranslations: number;
  totalClicks: number;
  totalRoomJoins: number;
  uniqueSessions: number;
  topPages: { path: string; count: number }[];
  recentEvents: { event_type: string; created_at: string; page_path: string; event_data: Record<string, unknown> }[];
  translationsByLanguage: { language: string; count: number }[];
}

interface RegisteredUser {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading } = useAuth();
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [geoData, setGeoData] = useState<Map<string, ParticipantGeoData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcripts' | 'participants' | 'profile' | 'analytics' | 'users'>('analytics');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [has2FA, setHas2FA] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/dashboard');
      }
    }
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      const [transcriptsRes, participantsRes, geoDataRes, profileRes] = await Promise.all([
        supabase
          .from('meeting_transcripts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('meeting_participants')
          .select('*')
          .order('joined_at', { ascending: false }),
        supabase
          .from('participant_geo_data')
          .select('*'),
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
      ]);
      
      if (transcriptsRes.data) {
        setTranscripts(transcriptsRes.data as MeetingTranscript[]);
      }
      if (participantsRes.data) {
        setParticipants(participantsRes.data as MeetingParticipant[]);
      }
      if (geoDataRes.data) {
        const geoMap = new Map<string, ParticipantGeoData>();
        geoDataRes.data.forEach((geo: ParticipantGeoData) => {
          geoMap.set(geo.participant_id, geo);
        });
        setGeoData(geoMap);
      }
      if (profileRes.data) {
        setProfile(profileRes.data as Profile);
        setDisplayName(profileRes.data.display_name || '');
        setUsername(profileRes.data.username || '');
      }
      
      setLoading(false);
    };
    
    fetchData();
    
    // Subscribe to realtime updates for participants
    const channel = supabase
      .channel('admin-participants-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_participants' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants(prev => [payload.new as MeetingParticipant, ...prev]);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  // Load analytics data
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== 'analytics') return;
    
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        // Fetch all analytics data
        const { data: analyticsData, error } = await supabase
          .from('site_analytics')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error) throw error;

        // Also get translation history count
        const { count: translationCount } = await supabase
          .from('translation_history')
          .select('*', { count: 'exact', head: true });

        const events = analyticsData || [];
        
        // Calculate stats
        const totalPageViews = events.filter(e => e.event_type === 'page_view').length;
        const totalTranslations = (translationCount || 0) + events.filter(e => e.event_type === 'translation_completed').length;
        const totalClicks = events.filter(e => e.event_type === 'button_click').length;
        const totalRoomJoins = events.filter(e => e.event_type === 'room_joined').length;
        const uniqueSessions = new Set(events.map(e => e.session_id)).size;

        // Top pages
        const pageCount = new Map<string, number>();
        events.filter(e => e.event_type === 'page_view').forEach(e => {
          const path = e.page_path || '/';
          pageCount.set(path, (pageCount.get(path) || 0) + 1);
        });
        const topPages = Array.from(pageCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([path, count]) => ({ path, count }));

        // Translations by language
        const langCount = new Map<string, number>();
        events.filter(e => e.event_type === 'translation_completed').forEach(e => {
          const data = e.event_data as Record<string, unknown>;
          const lang = (data?.target_language as string) || 'unknown';
          langCount.set(lang, (langCount.get(lang) || 0) + 1);
        });
        const translationsByLanguage = Array.from(langCount.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([language, count]) => ({ language, count }));

        // Recent events
        const recentEvents = events.slice(0, 50).map(e => ({
          event_type: e.event_type,
          created_at: e.created_at,
          page_path: e.page_path || '/',
          event_data: (e.event_data || {}) as Record<string, unknown>,
        }));

        setAnalyticsStats({
          totalPageViews,
          totalTranslations,
          totalClicks,
          totalRoomJoins,
          uniqueSessions,
          topPages,
          recentEvents,
          translationsByLanguage,
        });
      } catch (error) {
        console.error('Error loading analytics:', error);
        toast.error('Не удалось загрузить аналитику');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [user, isAdmin, activeTab]);

  // Load registered users
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== 'users') return;
    
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRegisteredUsers(data || []);
      } catch (error) {
        console.error('Error loading users:', error);
        toast.error('Не удалось загрузить пользователей');
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
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
        toast.success('2FA отключена');
      }
    } catch (err: any) {
      toast.error(err.message || 'Не удалось отключить 2FA');
    } finally {
      setDisabling2FA(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    
    try {
      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: displayName,
            username: username,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            display_name: displayName,
            username: username
          });
        
        if (error) throw error;
      }
      
      toast.success('Профиль сохранён');
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Максимальный размер файла 2MB');
      return;
    }

    setUploadingAvatar(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast.error('Не удалось загрузить аватар');
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
      toast.error('Не удалось обновить профиль');
    } else {
      setProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);
      toast.success('Аватар обновлён');
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

  const getCountryFlag = (countryCode: string | null) => {
    if (!countryCode) return '🌍';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (isLoading || !user || !isAdmin) {
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
            <Badge variant="secondary" className="gap-1">
              <Shield className="w-3 h-3" />
              Админ-панель
            </Badge>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={activeTab === 'analytics' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('analytics')}
              className="gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Статистика
            </Button>
            <Button
              variant={activeTab === 'transcripts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('transcripts')}
              className="gap-2"
            >
              <FileText className="w-4 h-4" />
              Записи
            </Button>
            <Button
              variant={activeTab === 'participants' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('participants')}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              IP-чекер
            </Button>
            <Button
              variant={activeTab === 'users' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('users')}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Пользователи
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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Аналитика сайта
            </h1>
            
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : analyticsStats ? (
              <>
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Eye className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analyticsStats.totalPageViews}</p>
                          <p className="text-xs text-muted-foreground">Просмотров</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                          <Languages className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analyticsStats.totalTranslations}</p>
                          <p className="text-xs text-muted-foreground">Переводов</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <MousePointer className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analyticsStats.totalClicks}</p>
                          <p className="text-xs text-muted-foreground">Кликов</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <Users className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analyticsStats.totalRoomJoins}</p>
                          <p className="text-xs text-muted-foreground">Входов в комнаты</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                          <TrendingUp className="w-5 h-5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{analyticsStats.uniqueSessions}</p>
                          <p className="text-xs text-muted-foreground">Сессий</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top pages */}
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        Популярные страницы
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analyticsStats.topPages.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Нет данных</p>
                      ) : (
                        <div className="space-y-2">
                          {analyticsStats.topPages.map((page, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="truncate flex-1 mr-4">{page.path}</span>
                              <Badge variant="secondary">{page.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Translations by language */}
                  <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Languages className="w-5 h-5 text-primary" />
                        Переводы по языкам
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {analyticsStats.translationsByLanguage.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Нет данных о переводах</p>
                      ) : (
                        <div className="space-y-2">
                          {analyticsStats.translationsByLanguage.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="uppercase font-mono">{item.language}</span>
                              <Badge variant="secondary">{item.count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent events */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Последние события
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {analyticsStats.recentEvents.map((event, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm border-b border-border/30 pb-2 last:border-0">
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {event.event_type.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-muted-foreground truncate flex-1">{event.page_path}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(event.created_at).toLocaleString('ru-RU')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет данных аналитики</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : activeTab === 'transcripts' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Все созвоны ({transcripts.length})
            </h1>
            
            {transcripts.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет записей созвонов</p>
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
          </div>
        ) : activeTab === 'participants' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              IP-чекер участников ({participants.length})
            </h1>
            
            {participants.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет данных об участниках</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {participants.map((participant) => {
                  const geo = geoData.get(participant.id);
                  return (
                    <Card key={participant.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">
                              {getCountryFlag(geo?.country_code || null)}
                            </div>
                            <div>
                              <h3 className="font-medium">{participant.user_name}</h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {geo?.city || 'Unknown'}, {geo?.country || 'Unknown'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {geo?.ip_address || 'Unknown'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Вошёл: {formatDate(participant.joined_at)}
                                </span>
                                {participant.left_at && (
                                  <span>Вышел: {formatDate(participant.left_at)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        <div className="text-right">
                          <Badge variant="outline">{participant.room_id.replace(/-/g, ' ')}</Badge>
                          {!participant.left_at && (
                            <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/50">
                              Онлайн
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Зарегистрированные пользователи ({registeredUsers.length})
            </h1>
            
            {usersLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : registeredUsers.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет зарегистрированных пользователей</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {registeredUsers.map((u) => (
                  <Card key={u.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={u.avatar_url || ''} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {u.display_name?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-medium">{u.display_name || 'Без имени'}</h3>
                            {u.username && (
                              <span className="text-sm text-muted-foreground">@{u.username}</span>
                            )}
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Регистрация: {formatDate(u.created_at)}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          ID: {u.user_id.slice(0, 8)}...
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-md mx-auto">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Редактирование профиля
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <div
                    onClick={handleAvatarClick}
                    className="relative w-24 h-24 cursor-pointer group"
                  >
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="text-2xl bg-primary/20 text-primary">
                        {displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Отображаемое имя</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Введите имя"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@username"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={user?.email || ''}
                      disabled
                      className="opacity-50"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleSaveProfile} 
                  className="w-full gap-2"
                  disabled={savingProfile}
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Сохранение...' : 'Сохранить'}
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
              </CardContent>
            </Card>
          </div>
        ) : null}
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

export default AdminPanel;
