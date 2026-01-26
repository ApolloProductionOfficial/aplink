import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, User, Camera, Loader2, Check, Globe, Shield, Trash2, Download, Share2, Search, X, Link2, Copy, Link2Off, AlertTriangle, BarChart3, Sparkles, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from "sonner";
import CustomCursor from '@/components/CustomCursor';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import CallStatistics from '@/components/CallStatistics';
import MissedCallsHistory from '@/components/MissedCallsHistory';
import apolloLogo from '@/assets/apollo-logo.mp4';
import { generateMeetingDocx } from '@/utils/generateMeetingDocx';
import { invokeBackendFunctionKeepalive } from '@/utils/invokeBackendFunctionKeepalive';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';

// Saving indicator component for header
const SavingIndicator = () => (
  <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-2.5 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full shadow-lg animate-fade-in">
    <svg viewBox="0 0 24 24" className="w-5 h-5 animate-spin flex-shrink-0">
      <defs>
        <linearGradient id="saving-spin-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6e4"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#saving-spin-gradient)" strokeWidth="2" fill="none" strokeDasharray="50 30"/>
    </svg>
    <span className="text-sm font-medium text-white">Сохраняем запись...</span>
  </div>
);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading, signOut, isAdmin } = useAuth();
  // Removed useToast - using sonner directly

  const PENDING_MEETING_SAVE_KEY = "pending_meeting_save_v1";
  type PendingMeetingSaveBase = {
    roomId: string;
    roomName: string;
    transcript: string;
    participants: string[];
  };

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
  
  // Avatar crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  
  // Background saving indicator
  const [showSavingIndicator, setShowSavingIndicator] = useState(false);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [sharingMeetingId, setSharingMeetingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkActive, setShareLinkActive] = useState(true);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Check for saving=true query param
  useEffect(() => {
    if (searchParams.get('saving') === 'true') {
      setShowSavingIndicator(true);
      // Remove query param
      searchParams.delete('saving');
      setSearchParams(searchParams, { replace: true });
      
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setShowSavingIndicator(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  // Custom save icon component for toasts
  const SaveIcon = () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6 animate-pulse flex-shrink-0">
      <defs>
        <linearGradient id="save-gradient-dash" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6e4"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
        <filter id="save-glow-dash">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#save-gradient-dash)" strokeWidth="2" fill="none" filter="url(#save-glow-dash)"/>
      <path d="M8 12l3 3 5-5" stroke="url(#save-gradient-dash)" strokeWidth="2.5" fill="none" strokeLinecap="round" filter="url(#save-glow-dash)"/>
    </svg>
  );

  // If a meeting couldn't be saved (guest ended call), auto-save it silently after login
  useEffect(() => {
    if (!user) return;

    const raw = sessionStorage.getItem(PENDING_MEETING_SAVE_KEY);
    if (!raw) return;

    let base: PendingMeetingSaveBase | null = null;
    try {
      base = JSON.parse(raw) as PendingMeetingSaveBase;
    } catch {
      sessionStorage.removeItem(PENDING_MEETING_SAVE_KEY);
      return;
    }

    // Auto-save silently without dialog
    const autoSavePendingMeeting = async () => {
      toast.info(
        <div className="flex items-center gap-3">
          <SaveIcon />
          <div>
            <div className="font-medium">Восстанавливаем запись...</div>
            <div className="text-xs text-muted-foreground">Пожалуйста, подождите</div>
          </div>
        </div>,
        { duration: 10000 }
      );

      try {
        const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
          'summarize-meeting',
          { ...base!, userId: user.id },
        );

        if (!response?.success || !response?.meeting?.id) {
          throw new Error('Сервер не подтвердил сохранение');
        }

        sessionStorage.removeItem(PENDING_MEETING_SAVE_KEY);
        await fetchTranscripts();
        
        toast.success(
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0">
              <defs>
                <linearGradient id="success-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/>
                  <stop offset="100%" stopColor="#06b6e4"/>
                </linearGradient>
                <filter id="success-glow">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <circle cx="12" cy="12" r="10" stroke="url(#success-gradient)" strokeWidth="2" fill="none" filter="url(#success-glow)"/>
              <path d="M8 12l3 3 5-5" stroke="url(#success-gradient)" strokeWidth="2.5" fill="none" strokeLinecap="round" filter="url(#success-glow)"/>
            </svg>
            <div>
              <div className="font-medium">Запись восстановлена</div>
              <div className="text-xs text-muted-foreground">Доступна в «Мои созвоны»</div>
            </div>
          </div>,
          { duration: 5000 }
        );
      } catch (e: any) {
        console.error('Auto-save pending meeting failed:', e);
        toast.error('Ошибка восстановления записи', {
          description: e?.message || 'Не удалось сохранить созвон',
        });
      }
    };

    autoSavePendingMeeting();
  }, [user]);

  const fetchTranscripts = async () => {
    if (!user) return;
    
    const { data: transcriptsData } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (transcriptsData) {
      setTranscripts(transcriptsData as MeetingTranscript[]);
    }
  };

  // Initial data load
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

      // Fetch transcripts
      await fetchTranscripts();

      setLoading(false);
    };

    fetchData();
  }, [user]);

  // Auto-refresh: refetch transcripts on window focus (after returning from call)
  useEffect(() => {
    if (!user) return;

    const handleFocus = () => {
      fetchTranscripts();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // Also subscribe to realtime inserts so new meetings appear instantly
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('meeting_transcripts_inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_transcripts',
        },
        (payload) => {
          const newMeeting = payload.new as MeetingTranscript;
          setTranscripts((prev) => [newMeeting, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        toast.success('Успешно', {
          description: '2FA отключена',
        });
      }
    } catch (err: any) {
      toast.error('Ошибка', {
        description: err.message || 'Не удалось отключить 2FA',
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
      toast.error('Ошибка', {
        description: 'Username должен содержать 3-20 символов (a-z, 0-9, _)',
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
          toast.error('Ошибка', {
            description: 'Этот @username уже занят',
          });
          return;
        }
        throw error;
      }
      
      setProfile(prev => prev ? { ...prev, display_name: editedName.trim(), username: editedUsername || null } : null);
      setIsEditingName(false);
      toast.success('Профиль сохранён', {
        description: 'Ваши данные успешно обновлены',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Ошибка', {
        description: 'Не удалось сохранить профиль',
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

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

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

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
    setSelectedImageFile(null);
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

  // Filter transcripts based on search and date
  const filteredTranscripts = transcripts.filter((t) => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      t.room_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Date filter
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

  // Share meeting function
  const handleShareMeeting = async (meetingId: string) => {
    if (!user) return;
    
    setSharingMeetingId(meetingId);
    setShareLink(null);
    setShareLinkActive(true);
    
    try {
      // Check if link already exists
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
      
      // Create new share link with 7 days expiration
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
      toast.error('Ошибка', {
        description: 'Не удалось создать ссылку',
      });
      setSharingMeetingId(null);
    }
  };

  // Deactivate share link
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
      toast.success(shareLinkActive ? 'Ссылка деактивирована' : 'Ссылка активирована', {
        description: shareLinkActive 
          ? 'Ссылка больше не работает' 
          : 'Ссылка снова доступна',
      });
    } catch (error) {
      console.error('Error toggling share link:', error);
      toast.error('Ошибка', {
        description: 'Не удалось изменить статус ссылки',
      });
    }
  };

  // Delete meeting
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!user) return;
    
    try {
      // First delete share links
      await supabase
        .from('shared_meeting_links')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('created_by', user.id);
      
      // Then delete the meeting transcript
      const { error } = await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('id', meetingId)
        .eq('owner_user_id', user.id);
      
      if (error) throw error;
      
      // Remove from local state
      setTranscripts(prev => prev.filter(t => t.id !== meetingId));
      setDeletingMeetingId(null);
      
      toast.success('Созвон удалён', {
        description: 'Запись созвона удалена',
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Ошибка', {
        description: 'Не удалось удалить созвон',
      });
    }
  };

  // Download Word handler
  const handleDownloadPdf = async (transcript: MeetingTranscript) => {
    setDownloadingPdf(transcript.id);
    try {
      await generateMeetingDocx(transcript);
    } catch (error) {
      console.error('Error generating Word:', error);
      toast.error('Ошибка', {
        description: 'Не удалось создать Word документ',
      });
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
      
      {/* Background saving indicator */}
      {showSavingIndicator && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="flex items-center gap-3 bg-primary/20 backdrop-blur-2xl border border-primary/30 rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="relative">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div className="absolute inset-0 w-5 h-5 rounded-full bg-primary/30 animate-ping" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Ваша запись сохраняется...</span>
              <span className="text-xs text-muted-foreground">Скоро она появится в списке ✨</span>
            </div>
            <button 
              onClick={() => setShowSavingIndicator(false)}
              className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Saving indicator in header area */}
      {showSavingIndicator && <SavingIndicator />}
      
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
              variant={activeTab === 'stats' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('stats')}
              className="gap-2 focus-visible:ring-0 ring-0"
            >
              <BarChart3 className="w-4 h-4" />
              Статистика
            </Button>
            <Button
              variant={activeTab === 'calls' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('calls')}
              className="gap-2 focus-visible:ring-0 ring-0"
            >
              <FileText className="w-4 h-4" />
              Записи
            </Button>
            <Button
              variant={activeTab === 'profile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('profile')}
              className="gap-2 focus-visible:ring-0 ring-0"
            >
              <User className="w-4 h-4" />
              Профиль
            </Button>
            {isAdmin && (
              <Button
                variant={activeTab === 'ip-checker' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('ip-checker')}
                className="gap-2 focus-visible:ring-0 ring-0"
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

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Статистика звонков
            </h1>
            <div className="grid gap-6 lg:grid-cols-2">
              <CallStatistics />
              <MissedCallsHistory />
            </div>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Мои созвоны
              </h1>
              
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 w-full sm:w-64 bg-background/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                    <Button
                      key={filter}
                      variant={dateFilter === filter ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDateFilter(filter)}
                      className="text-xs"
                    >
                      {filter === 'all' && 'Все'}
                      {filter === 'today' && 'Сегодня'}
                      {filter === 'week' && 'Неделя'}
                      {filter === 'month' && 'Месяц'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
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
            ) : filteredTranscripts.length === 0 ? (
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Ничего не найдено</p>
                  <p className="text-sm mt-2">Попробуйте изменить параметры поиска</p>
                  <Button
                    variant="outline"
                    onClick={() => { setSearchQuery(''); setDateFilter('all'); }}
                    className="mt-4"
                  >
                    Сбросить фильтры
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredTranscripts.map((transcript) => (
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
                    {/* Подсказка убрана */}
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

export default Dashboard;
