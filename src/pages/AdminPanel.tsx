import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, Clock, MapPin, Globe, Shield, User, Camera, Save, Trash2, Loader2, BarChart3, Languages, MousePointer, TrendingUp, Eye, Download, Share2, Search, X, Link2, Copy, Link2Off, AlertTriangle, Bug, XCircle, AlertCircle, Info, Send, Check, MessageCircle, Smartphone, Server } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import CustomCursor from '@/components/CustomCursor';

import TwoFactorSetup from '@/components/TwoFactorSetup';
import aplinkNeonLogo from '@/assets/aplink-logo-neon.png';
import { generateMeetingDocx } from '@/utils/generateMeetingDocx';
import TelegramSetupCard from '@/components/TelegramSetupCard';
import TelegramActivityChart from '@/components/TelegramActivityChart';
import GroupCallHistory from '@/components/GroupCallHistory';
import CallScheduler from '@/components/CallScheduler';
import TelegramMiniAppAnalytics from '@/components/TelegramMiniAppAnalytics';
import AutoRecordSettings from '@/components/AutoRecordSettings';
import { useAdminPushNotifications } from '@/hooks/useAdminPushNotifications';
import ErrorStatsExport from '@/components/ErrorStatsExport';
import SystemStatusDashboard from '@/components/SystemStatusDashboard';
import DataBackupsManager from '@/components/DataBackupsManager';
import WelcomeMessageEditor from '@/components/WelcomeMessageEditor';
import UXAnomaliesPanel from '@/components/UXAnomaliesPanel';
import LiveKitMonitor from '@/components/LiveKitMonitor';
import ContactRequestsPanel from '@/components/ContactRequestsPanel';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';
import ErrorFilterStatsPanel from '@/components/ErrorFilterStatsPanel';

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

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  source: string | null;
  severity: string;
  details: Record<string, unknown> | null;
  url: string | null;
  user_agent: string | null;
  notified: boolean;
}

interface ErrorStats {
  total: number;
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  today: number;
  week: number;
  notified: number;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading } = useAuth();
  const { t } = useTranslation();
  // Initialize admin push notifications
  useAdminPushNotifications();
  const admin = (t as any).adminPanel || {};
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [geoData, setGeoData] = useState<Map<string, ParticipantGeoData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transcripts' | 'users-ip' | 'stats-errors' | 'profile' | 'telegram'>('stats-errors');
  const [usersIpSubTab, setUsersIpSubTab] = useState<'users' | 'ip'>('users');
  const [statsErrorsSubTab, setStatsErrorsSubTab] = useState<'analytics' | 'errors' | 'livekit'>('analytics');
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
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error logs state
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [errorFilter, setErrorFilter] = useState<'all' | 'critical' | 'error' | 'warning' | 'info'>('all');
  const [testingSendTelegram, setTestingSendTelegram] = useState(false);
  const [sendingStats, setSendingStats] = useState(false);
  const [sendingPing, setSendingPing] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [runningAutofix, setRunningAutofix] = useState(false);
  const [clearingOldLogs, setClearingOldLogs] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState<{
    results: Array<{
      category: string;
      name: string;
      status: 'ok' | 'warning' | 'error';
      message: string;
      fixable?: boolean;
    }>;
    fixes: string[];
    summary: { total: number; ok: number; warnings: number; errors: number };
  } | null>(null);

  // Handle clearing logs older than 7 days
  const handleClearOldLogs = async () => {
    setClearingOldLogs(true);
    setShowClearLogsConfirm(false);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-bot-command", {
        body: { command: "clear" }
      });
      if (error) throw error;
      
      // Reload error logs
      const { data: newLogs } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (newLogs) {
        setErrorLogs(newLogs as ErrorLog[]);
      }
      
      toast.success("🗑️ Логи старше 7 дней очищены и уведомление отправлено в Telegram!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка очистки: " + message);
    } finally {
      setClearingOldLogs(false);
    }
  };
  // Handle test Telegram notification
  const handleTestTelegramNotification = async () => {
    setTestingSendTelegram(true);
    try {
      const { error } = await supabase.functions.invoke("send-telegram-notification", {
        body: {
          errorType: "TEST_NOTIFICATION",
          errorMessage: "Это тестовое уведомление для проверки работы Telegram бота 🧪",
          source: "Admin Panel - Test",
          severity: "info",
          isTest: true,
          details: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            testedAt: new Date().toISOString(),
            testedBy: user?.email || 'Unknown'
          }
        }
      });
      
      if (error) throw error;
      toast.success("✅ Тестовое уведомление отправлено в Telegram!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка отправки: " + message);
    } finally {
      setTestingSendTelegram(false);
    }
  };

  // Handle sending /stats command to Telegram bot
  const handleSendStats = async () => {
    setSendingStats(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-bot-command", {
        body: { command: "stats" }
      });
      if (error) throw error;
      toast.success("📊 Статистика отправлена в Telegram!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + message);
    } finally {
      setSendingStats(false);
    }
  };

  // Handle ping bot
  const handlePingBot = async () => {
    setSendingPing(true);
    try {
      const { error } = await supabase.functions.invoke("telegram-bot-command", {
        body: { command: "ping" }
      });
      if (error) throw error;
      toast.success("🏓 Пинг отправлен!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + message);
    } finally {
      setSendingPing(false);
    }
  };

  // Run full diagnostics
  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    setDiagnosticsResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-diagnostics", {
        body: { action: "scan" }
      });
      if (error) throw error;
      setDiagnosticsResults(data);
      toast.success("🔍 Диагностика завершена!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка диагностики: " + message);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  // Run autofix
  const handleRunAutofix = async () => {
    setRunningAutofix(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-diagnostics", {
        body: { action: "fix" }
      });
      if (error) throw error;
      setDiagnosticsResults(data);
      toast.success("🔧 Автофикс завершён!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка автофикса: " + message);
    } finally {
      setRunningAutofix(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sharingMeetingId, setSharingMeetingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkActive, setShareLinkActive] = useState(true);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

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
    if (!user || !isAdmin || activeTab !== 'stats-errors' || statsErrorsSubTab !== 'analytics') return;
    
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
        toast.error(admin.loadAnalyticsError || 'Не удалось загрузить аналитику');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [user, isAdmin, activeTab, statsErrorsSubTab]);

  // Load registered users
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== 'users-ip' || usersIpSubTab !== 'users') return;
    
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
        toast.error(admin.loadUsersError || 'Не удалось загрузить пользователей');
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
  }, [user, isAdmin, activeTab, usersIpSubTab]);

  // Load error logs
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== 'stats-errors' || statsErrorsSubTab !== 'errors') return;
    
    const loadErrors = async () => {
      setErrorsLoading(true);
      try {
        const { data, error } = await supabase
          .from('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500) as { data: ErrorLog[] | null; error: any };

        if (error) throw error;
        
        const logs = data || [];
        setErrorLogs(logs);
        
        // Calculate stats
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        
        const byType = new Map<string, number>();
        const bySeverity = new Map<string, number>();
        let todayCount = 0;
        let weekCount = 0;
        let notifiedCount = 0;
        
        logs.forEach(log => {
          // By type
          byType.set(log.error_type, (byType.get(log.error_type) || 0) + 1);
          // By severity
          bySeverity.set(log.severity, (bySeverity.get(log.severity) || 0) + 1);
          // Today
          if (new Date(log.created_at) >= todayStart) todayCount++;
          // Week
          if (new Date(log.created_at) >= weekStart) weekCount++;
          // Notified
          if (log.notified) notifiedCount++;
        });
        
        setErrorStats({
          total: logs.length,
          byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
          bySeverity: Array.from(bySeverity.entries()).map(([severity, count]) => ({ severity, count })),
          today: todayCount,
          week: weekCount,
          notified: notifiedCount,
        });
      } catch (error) {
        console.error('Error loading error logs:', error);
        toast.error('Не удалось загрузить логи ошибок');
      } finally {
        setErrorsLoading(false);
      }
    };

    loadErrors();
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
        toast.success(admin.twoFADisabled || '2FA отключена');
      }
    } catch (err: any) {
      toast.error(err.message || admin.twoFADisableError || 'Не удалось отключить 2FA');
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
      
      toast.success(admin.profileSaved || 'Профиль сохранён');
    } catch (error: any) {
      toast.error((admin.profileSaveError || 'Ошибка сохранения:') + ' ' + error.message);
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
      toast.error(admin.selectImage || 'Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(admin.maxFileSize || 'Максимальный размер файла 5MB');
      return;
    }

    // Open crop dialog instead of direct upload
    setSelectedAvatarFile(file);
    setAvatarCropOpen(true);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCroppedAvatarSave = async (croppedBlob: Blob) => {
    if (!user) return;
    
    setAvatarCropOpen(false);
    setUploadingAvatar(true);

    try {
      const fileName = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) {
        throw uploadError;
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
        throw updateError;
      }

      setProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);
      toast.success(admin.avatarUpdated || 'Аватар обновлён');
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast.error(admin.avatarUploadError || 'Не удалось загрузить аватар');
    } finally {
      setUploadingAvatar(false);
      setSelectedAvatarFile(null);
    }
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

  // Filter transcripts based on search and date (same as Dashboard)
  const filteredTranscripts = transcripts.filter((t) => {
    const matchesSearch = searchQuery === '' || 
      t.room_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (dateFilter === 'all') return true;
    
    const meetingDate = new Date(t.started_at);
    const now = new Date();
    
    if (dateFilter === 'today') {
      return meetingDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return meetingDate >= weekAgo;
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return meetingDate >= monthAgo;
    }
    
    return true;
  });

  // Share meeting
  const handleShareMeeting = async (meetingId: string) => {
    if (!user) return;
    
    setSharingMeetingId(meetingId);
    setShareLink(null);
    setShareLinkActive(true);
    
    try {
      const { data: existingLink } = await supabase
        .from('shared_meeting_links')
        .select('share_token, is_active')
        .eq('meeting_id', meetingId)
        .eq('created_by', user.id)
        .maybeSingle();
      
      if (existingLink) {
        const link = `https://aplink.live/shared/${existingLink.share_token}`;
        setShareLink(link);
        setShareLinkActive(existingLink.is_active);
        return;
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const { data: newLink, error } = await supabase
        .from('shared_meeting_links')
        .insert({
          meeting_id: meetingId,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
        })
        .select('share_token')
        .single();
      
      if (error) throw error;
      
      const link = `https://aplink.live/shared/${newLink.share_token}`;
      setShareLink(link);
      setShareLinkActive(true);
      
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Не удалось создать ссылку');
      setSharingMeetingId(null);
    }
  };

  // Deactivate/activate share link
  const handleDeactivateShareLink = async () => {
    if (!user || !sharingMeetingId) return;
    
    try {
      const { error } = await supabase
        .from('shared_meeting_links')
        .update({ is_active: !shareLinkActive })
        .eq('meeting_id', sharingMeetingId)
        .eq('created_by', user.id);
      
      if (error) throw error;
      
      setShareLinkActive(!shareLinkActive);
      toast.success(shareLinkActive ? 'Ссылка деактивирована' : 'Ссылка активирована');
    } catch (error) {
      console.error('Error toggling share link:', error);
      toast.error('Не удалось изменить статус ссылки');
    }
  };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('shared_meeting_links')
        .delete()
        .eq('meeting_id', meetingId);
      
      const { error } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('id', meetingId);
      
      if (error) throw error;
      
      setTranscripts(prev => prev.filter(t => t.id !== meetingId));
      setDeletingMeetingId(null);
      
      toast.success('Созвон удалён');
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Не удалось удалить созвон');
    }
  };

  // Download Word
  const handleDownloadPdf = async (transcript: MeetingTranscript) => {
    setDownloadingPdf(transcript.id);
    try {
      await generateMeetingDocx(transcript);
    } catch (error) {
      console.error('Error generating Word:', error);
      toast.error('Не удалось создать Word документ');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      toast.success('Ссылка скопирована');
    }
  };

  const closeShareDialog = () => {
    setSharingMeetingId(null);
    setShareLink(null);
  };

  if (isLoading || !user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cursor-none relative overflow-hidden">
      <CustomCursor />
      
      {/* Lightweight gradient bg instead of AnimatedBackground + blur orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 border-b border-border/30 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
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
                src={apolloLogo} 
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
              {admin.title || 'Админ-панель'}
            </Badge>
          </div>
          
          <div className="flex gap-1.5 md:gap-2 flex-wrap justify-end">
            <Button
              variant={activeTab === 'stats-errors' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('stats-errors')}
              className="gap-1 md:gap-2 px-2 md:px-3 text-xs md:text-sm relative"
            >
              <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Статистика</span>
              {errorStats && errorStats.today > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                  {errorStats.today > 9 ? '9+' : errorStats.today}
                </span>
              )}
            </Button>
            <Button
              variant={activeTab === 'transcripts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('transcripts')}
              className="gap-1 md:gap-2 px-2 md:px-3 text-xs md:text-sm"
            >
              <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{admin.transcripts || 'Записи'}</span>
            </Button>
            <Button
              variant={activeTab === 'users-ip' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('users-ip')}
              className="gap-1 md:gap-2 px-2 md:px-3 text-xs md:text-sm"
            >
              <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Юзеры & IP</span>
            </Button>
            <Button
              variant={activeTab === 'telegram' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('telegram')}
              className="gap-1 md:gap-2 px-2 md:px-3 text-xs md:text-sm"
            >
              <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Telegram App</span>
            </Button>
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('profile')}
              className="gap-1 md:gap-2 px-2 md:px-3 text-xs md:text-sm"
            >
              <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{admin.profile || 'Профиль'}</span>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : activeTab === 'stats-errors' ? (
          <div className="space-y-6">
            {/* Sub-tabs for Stats & Errors */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-2 mr-4">
                <BarChart3 className="w-6 h-6 text-primary" />
                Статистика & Мониторинг
              </h1>
              <div className="flex gap-1.5 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={statsErrorsSubTab === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatsErrorsSubTab('analytics')}
                  className="gap-1.5 text-xs"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Аналитика
                </Button>
                <Button
                  variant={statsErrorsSubTab === 'errors' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatsErrorsSubTab('errors')}
                  className="gap-1.5 text-xs relative"
                >
                  <Bug className="w-3.5 h-3.5" />
                  Ошибки
                  {errorStats && errorStats.today > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                      {errorStats.today > 9 ? '9+' : errorStats.today}
                    </span>
                  )}
                </Button>
                <Button
                  variant={statsErrorsSubTab === 'livekit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setStatsErrorsSubTab('livekit')}
                  className="gap-1.5 text-xs"
                >
                  <Server className="w-3.5 h-3.5" />
                  LiveKit
                </Button>
              </div>
            </div>

            {/* Analytics Sub-tab */}
            {statsErrorsSubTab === 'analytics' && (
              <>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : analyticsStats ? (
                  <>
                    {/* Stats cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <Card className="bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                              <Eye className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{analyticsStats.totalPageViews}</p>
                              <p className="text-xs text-muted-foreground">{admin.pageViews || 'Просмотров'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card/80 border-border/50">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/20">
                              <Languages className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                              <p className="text-2xl font-bold">{analyticsStats.totalTranslations}</p>
                              <p className="text-xs text-muted-foreground">{admin.translations || 'Переводов'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card/80 border-border/50">
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
                      
                      <Card className="bg-card/80 border-border/50">
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
                      
                      <Card className="bg-card/80 border-border/50">
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
                      <Card className="bg-card/80 border-border/50">
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
                      <Card className="bg-card/80 border-border/50">
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
                    <Card className="bg-card/80 border-border/50">
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
                  <Card className="bg-card/80 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Нет данных аналитики</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Errors Sub-tab */}
            {statsErrorsSubTab === 'errors' && (
              <>
                <div className="flex items-center justify-end">
                  <ErrorStatsExport errorLogs={errorLogs} errorStats={errorStats} />
                </div>

                {errorsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <SystemStatusDashboard 
                      errorLogs={errorLogs}
                      errorStats={errorStats}
                      onClearOldLogs={handleClearOldLogs}
                      clearingLogs={clearingOldLogs}
                    />
                    
                    {/* UX Anomalies Panel */}
                    <UXAnomaliesPanel />

                    {/* Error filter noise stats */}
                    <ErrorFilterStatsPanel />
                    
                    <DataBackupsManager />
                  </>
                )}
              </>
            )}

            {/* LiveKit Sub-tab */}
            {statsErrorsSubTab === 'livekit' && (
              <>
                <LiveKitMonitor />
                {user && <ContactRequestsPanel userId={user.id} />}
              </>
            )}
          </div>
        ) : activeTab === 'telegram' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-primary" />
              Telegram App
            </h1>
            
            {/* Telegram Mini App Setup */}
            <TelegramSetupCard publishedUrl="https://aplink.live" />
            
            {/* Full Telegram Mini App Analytics */}
            <TelegramMiniAppAnalytics />
            
            {/* Welcome Message Editor */}
            <WelcomeMessageEditor />
            
            {/* Group Call History */}
            <GroupCallHistory />
            
            {/* Call Scheduler */}
            <CallScheduler />
          </div>
        ) : activeTab === 'transcripts' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Все созвоны ({filteredTranscripts.length}/{transcripts.length})
            </h1>

            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card/50"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className="flex gap-1.5">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={dateFilter === filter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDateFilter(filter)}
                    className="text-xs"
                  >
                    {filter === 'all' ? 'Все' : filter === 'today' ? 'Сегодня' : filter === 'week' ? 'Неделя' : 'Месяц'}
                  </Button>
                ))}
              </div>
            </div>
            
            {filteredTranscripts.length === 0 ? (
              <Card className="bg-card/80 border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{searchQuery || dateFilter !== 'all' ? 'Ничего не найдено' : 'Пока нет записей созвонов'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredTranscripts.map((transcript) => (
                  <Card key={transcript.id} className="bg-card/80 border-border/50">
                    <CardHeader>
                      <div className="flex items-start justify-between flex-wrap gap-3">
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShareMeeting(transcript.id)}
                            className="gap-1.5"
                            title="Поделиться"
                          >
                            <Share2 className="w-4 h-4" />
                            Поделиться
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPdf(transcript)}
                            disabled={downloadingPdf === transcript.id}
                            className="gap-1.5"
                            title="Скачать Word"
                          >
                            {downloadingPdf === transcript.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            Word
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingMeetingId(transcript.id)}
                            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {transcript.ended_at && (
                            <Badge variant="secondary">Завершён</Badge>
                          )}
                        </div>
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

            {/* Share Link Modal */}
            {sharingMeetingId && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={closeShareDialog}>
                <Card className="max-w-md w-full bg-card border-border" onClick={(e) => e.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-primary" />
                      Поделиться созвоном
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {shareLink ? (
                      <>
                        {!shareLinkActive && (
                          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                            <Link2Off className="w-4 h-4 shrink-0" />
                            Ссылка деактивирована и не работает
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {shareLinkActive 
                            ? 'Скопируйте ссылку и отправьте её тому, с кем хотите поделиться. Ссылка действует 7 дней.'
                            : 'Ссылка неактивна. Активируйте её, чтобы получатели могли просматривать конспект.'
                          }
                        </p>
                        <div className="flex gap-2">
                          <Input
                            value={shareLink}
                            readOnly
                            className={`bg-muted/50 text-sm ${!shareLinkActive ? 'opacity-50' : ''}`}
                          />
                          <Button onClick={copyShareLink} className="shrink-0 gap-1.5" disabled={!shareLinkActive}>
                            <Copy className="w-4 h-4" />
                            Копировать
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant={shareLinkActive ? "destructive" : "default"}
                            onClick={handleDeactivateShareLink} 
                            className="flex-1 gap-1.5"
                          >
                            {shareLinkActive ? (
                              <>
                                <Link2Off className="w-4 h-4" />
                                Деактивировать
                              </>
                            ) : (
                              <>
                                <Link2 className="w-4 h-4" />
                                Активировать
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Создаём ссылку...</span>
                      </div>
                    )}
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button variant="outline" onClick={closeShareDialog} className="w-full">
                      Закрыть
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletingMeetingId && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeletingMeetingId(null)}>
                <Card className="max-w-md w-full bg-card border-border" onClick={(e) => e.stopPropagation()}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Удалить созвон?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Вы уверены, что хотите удалить этот созвон? Это действие нельзя отменить. 
                      Будут удалены запись, транскрипция и все публичные ссылки.
                    </p>
                  </CardContent>
                  <div className="px-6 pb-6 flex gap-2">
                    <Button variant="outline" onClick={() => setDeletingMeetingId(null)} className="flex-1">
                      Отмена
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleDeleteMeeting(deletingMeetingId)} 
                      className="flex-1 gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : activeTab === 'users-ip' ? (
          <div className="space-y-6">
            {/* Sub-tabs for Users & IP */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-2 mr-4">
                <Users className="w-6 h-6 text-primary" />
                Пользователи & IP
              </h1>
              <div className="flex gap-1.5 bg-muted/50 p-1 rounded-lg">
                <Button
                  variant={usersIpSubTab === 'users' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setUsersIpSubTab('users')}
                  className="gap-1.5 text-xs"
                >
                  <User className="w-3.5 h-3.5" />
                  Пользователи ({registeredUsers.length})
                </Button>
                <Button
                  variant={usersIpSubTab === 'ip' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setUsersIpSubTab('ip')}
                  className="gap-1.5 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  IP-чекер ({participants.length})
                </Button>
              </div>
            </div>

            {/* Users Sub-tab */}
            {usersIpSubTab === 'users' && (
              <>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : registeredUsers.length === 0 ? (
                  <Card className="bg-card/80 border-border/50">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Пока нет зарегистрированных пользователей</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {registeredUsers.map((u) => (
                      <Card key={u.id} className="bg-card/80 border-border/50">
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
              </>
            )}

            {/* IP Sub-tab */}
            {usersIpSubTab === 'ip' && (
              <>
                {participants.length === 0 ? (
                  <Card className="bg-card/80 border-border/50">
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
                        <Card key={participant.id} className="bg-card/80 border-border/50">
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
              </>
            )}
          </div>
        ) : activeTab === 'profile' ? (
          <div className="max-w-md mx-auto">
            <Card className="bg-background/95 border-border/30 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
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
                
                {/* Auto Record Settings */}
                <div className="pt-4 border-t border-border/50">
                  <AutoRecordSettings />
                </div>
                
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

      {/* Avatar Crop Dialog */}
      <AvatarCropDialog
        open={avatarCropOpen}
        imageFile={selectedAvatarFile}
        onClose={() => {
          setAvatarCropOpen(false);
          setSelectedAvatarFile(null);
        }}
        onSave={handleCroppedAvatarSave}
      />
    </div>
  );
};

export default AdminPanel;
