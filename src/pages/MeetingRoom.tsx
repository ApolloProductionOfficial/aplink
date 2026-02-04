import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, Navigate } from "react-router-dom";
import {
  Copy,
  Check,
  Users,
  Sparkles,
  Mic,
  MicOff,
  Wifi,
  WifiOff,
  RefreshCw,
  Globe,
  Languages,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Link2,
  Subtitles,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";
import { useTranslation } from "@/hooks/useTranslation";
import { MeetingEndSaveDialog, type MeetingSaveStatus } from "@/components/MeetingEndSaveDialog";
import { invokeBackendFunctionKeepalive } from "@/utils/invokeBackendFunctionKeepalive";
import LeaveCallDialog from "@/components/LeaveCallDialog";
import CallQualityWidget from "@/components/CallQualityWidget";
import RecordingSaveIndicator, { type SaveStatus } from "@/components/RecordingSaveIndicator";
import { cn } from "@/lib/utils";
import { useActiveCall } from "@/contexts/ActiveCallContext";

/**
 * MeetingRoomGuard validates URL params BEFORE rendering MeetingRoomContent.
 * This ensures all hooks in MeetingRoomContent are called consistently.
 * 
 * REACT HOOK SAFETY: Early returns here are SAFE because this component
 * only uses useParams, useSearchParams, useNavigate - no conditional hooks.
 */
const MeetingRoomGuard = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get("name");

  // If no roomId, redirect to home
  if (!roomId) {
    console.warn('[MeetingRoomGuard] No roomId, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // If no userName, redirect to home with room param so user can enter name
  if (!userName) {
    console.warn('[MeetingRoomGuard] No userName, redirecting to /?room=...');
    return <Navigate to={`/?room=${encodeURIComponent(roomId)}`} replace />;
  }

  // Both params are valid - render the actual meeting room
  return <MeetingRoomContent roomId={roomId} userName={userName} />;
};

interface MeetingRoomContentProps {
  roomId: string;
  userName: string;
}

/**
 * MeetingRoomContent is the main meeting room UI.
 * 
 * IMPORTANT: This component receives validated props (roomId, userName are guaranteed strings).
 * ALL hooks are called unconditionally at the top - NO early returns between hooks!
 */
const MeetingRoomContent = ({ roomId, userName }: MeetingRoomContentProps) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showRegistrationHint, setShowRegistrationHint] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const connectionStatusRef = useRef(connectionStatus);

  const transcriptRef = useRef<string[]>([]);
  const participantsRef = useRef<Set<string>>(new Set());
  const hasRedirectedRef = useRef(false);
  const userInitiatedEndRef = useRef(false);
  const hasStartedRecordingRef = useRef(false);

  // End-call save UI
  const [endSaveDialogOpen, setEndSaveDialogOpen] = useState(false);
  const [endSaveStatus, setEndSaveStatus] = useState<MeetingSaveStatus>("saving");
  const [endSaveError, setEndSaveError] = useState<string | null>(null);
  const [endSaveNeedsLogin, setEndSaveNeedsLogin] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // Recording save indicator state
  const [recordingSaveStatus, setRecordingSaveStatus] = useState<SaveStatus>('idle');
  const [recordingSaveProgress, setRecordingSaveProgress] = useState(0);
  const [recordingSaveError, setRecordingSaveError] = useState<string | undefined>();

  type PendingMeetingSaveBase = {
    roomId: string;
    roomName: string;
    transcript: string;
    participants: string[];
  };

  const PENDING_MEETING_SAVE_KEY = "pending_meeting_save_v1";
  const pendingSaveBaseRef = useRef<PendingMeetingSaveBase | null>(null);

  const { user, isLoading: authLoading } = useAuth();
  const { sendNotification } = usePushNotifications();
  const { isRecording, startRecording, stopRecording, getAudioBlob, getRecoveredRecording, clearRecoveredRecording } = useAudioRecorder();
  const isRecordingRef = useRef(false);
  
  const { playConnectedSound, playDisconnectedSound, playReconnectingSound } = useConnectionSounds();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<number>(100);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();
  
  // Get room and panel states from context
  const { 
    isActive,
    roomSlug: activeRoomSlug,
    startCall, 
    minimize, 
    liveKitRoom, 
    setHeaderButtons, 
    setEventHandlers,
    // Panel visibility from context
    showTranslator,
    showCaptions,
    showIPPanel,
    isAdmin,
    setShowTranslator,
    setShowCaptions,
    setShowIPPanel,
    setIsAdmin,
  } = useActiveCall();

  // Derived values - safe to compute, no hooks
  const roomDisplayName = decodeURIComponent(roomId).replace(/-/g, ' ') || 'Meeting';
  const roomSlug = roomId;
  const safeUserName = userName || user?.email?.split('@')[0] || 'Guest';

  // =========================================
  // ALL useEffect hooks MUST be here - before any conditional logic
  // =========================================

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Track presence in this room
  usePresence(roomDisplayName);

  // Register active call in global context
  useEffect(() => {
    if (isActive && activeRoomSlug === roomSlug) {
      console.log('[MeetingRoom] Call already active for room:', roomSlug, '- skipping startCall');
      return;
    }
    
    participantsRef.current.add(safeUserName);
    
    startCall({
      roomName: roomDisplayName,
      roomSlug,
      participantName: safeUserName,
      participantIdentity: user?.id,
      roomDisplayName,
    });
  }, [isActive, activeRoomSlug, startCall, roomDisplayName, roomSlug, safeUserName, user?.id]);

  // Handle disconnected logic
  const handleDisconnectedLogic = useCallback(() => {
    if (userInitiatedEndRef.current || hasRedirectedRef.current) {
      return;
    }

    if (!hasRedirectedRef.current && hasStartedRecordingRef.current) {
      hasRedirectedRef.current = true;
      
      if (user) {
        navigate('/dashboard?saving=true', { replace: true });
        runMeetingSaveBackground();
      } else {
        setEndSaveDialogOpen(true);
        setEndSaveStatus("saving");
        runMeetingSave();
      }
    } else if (!hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      window.open('https://apolloproduction.studio', '_blank');
      // Route through /__refresh to force cache-busting after call end
      navigate(`/__refresh?to=${encodeURIComponent(user ? '/dashboard' : '/')}&t=${Date.now()}`, { replace: true });
    }
  }, [user, navigate]);

  // State for manual recording prompt
  const [showManualRecordPrompt, setShowManualRecordPrompt] = useState(false);
  // Prevent showing prompt multiple times on iOS reconnect
  const hasShownManualPromptRef = useRef(false);

  // Auto-start recording for authenticated users (if enabled in settings)
  const autoStartRecording = useCallback(async () => {
    if (user && !isRecordingRef.current && !hasStartedRecordingRef.current) {
      try {
        // Check if auto-record is enabled in user's profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('auto_record_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        const autoRecordEnabled = profileData?.auto_record_enabled ?? false;
        
        if (!autoRecordEnabled) {
          console.log('[MeetingRoom] Auto-recording disabled in profile settings');
          // Show prompt only once per session (prevents duplicate on iOS reconnect)
          if (!hasShownManualPromptRef.current) {
            hasShownManualPromptRef.current = true;
            setShowManualRecordPrompt(true);
            // Auto-hide after 15 seconds (longer for mobile users)
            setTimeout(() => setShowManualRecordPrompt(false), 15000);
          }
          return;
        }

        console.log('[MeetingRoom] Auto-starting recording for authenticated user');
        hasStartedRecordingRef.current = true;
        await startRecording();
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        toast.success('Автозапись включена', {
          description: 'Запись будет автоматически сохранена при выходе',
          duration: 3000,
        });
      } catch (error) {
        console.error('[MeetingRoom] Failed to auto-start recording:', error);
        hasStartedRecordingRef.current = false;
      }
    }
  }, [user, startRecording]);

  // Handle manual recording start from prompt
  const handleManualRecordStart = async () => {
    setShowManualRecordPrompt(false);
    if (!isRecordingRef.current && !hasStartedRecordingRef.current) {
      try {
        hasStartedRecordingRef.current = true;
        await startRecording();
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        toast.success('Запись началась', {
          description: 'Нажмите REC для остановки',
        });
      } catch (error) {
        console.error('[MeetingRoom] Failed to start manual recording:', error);
        hasStartedRecordingRef.current = false;
        toast.error('Не удалось начать запись');
      }
    }
  };

  // Register event handlers with context
  useEffect(() => {
    setEventHandlers({
      onConnected: () => {
        console.log('[MeetingRoom] onConnected via context');
        setConnectionStatus('connected');
        // Auto-start recording after connection for authenticated users
        autoStartRecording();
      },
      onDisconnected: () => {
        console.log('[MeetingRoom] onDisconnected via context');
        setConnectionStatus('disconnected');
        handleDisconnectedLogic();
      },
      onParticipantJoined: (identity: string, name: string) => {
        participantsRef.current.add(name || identity);
        sendNotification(`${name || identity} присоединился`, {
          body: `К комнате "${roomDisplayName}"`,
          tag: 'participant-joined',
        });
        toast.info(`${name || identity} присоединился`, {
          description: 'Новый участник в комнате',
        });
      },
      onParticipantLeft: (identity: string) => {
        console.log('Participant left:', identity);
      },
      onError: (error: Error) => {
        // Serialize error properly for logging (Error objects serialize to {} by default)
        const errorDetails = {
          message: error?.message || 'Unknown error',
          name: error?.name || 'Error',
          ...(error as any)?.code && { code: (error as any).code },
          ...(error as any)?.reason && { reason: (error as any).reason },
        };
        console.warn('[MeetingRoom] Error via context:', JSON.stringify(errorDetails));
      },
    });
  }, [setEventHandlers, roomDisplayName, sendNotification, handleDisconnectedLogic, autoStartRecording]);

  // Block navigation when in a call + warn about recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isInActiveCall = connectionStatus === 'connected' && !userInitiatedEndRef.current && !hasRedirectedRef.current;
      
      if (isRecordingRef.current && !hasRedirectedRef.current) {
        e.preventDefault();
        e.returnValue = 'У вас есть активная запись. Если вы уйдёте, запись будет сохранена автоматически.';
        return e.returnValue;
      }
      
      if (isInActiveCall) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [connectionStatus]);

  // Handle back button with popstate event
  useEffect(() => {
    const handlePopState = () => {
      const isInActiveCall = connectionStatus === 'connected' && !userInitiatedEndRef.current && !hasRedirectedRef.current;
      if (isInActiveCall) {
        window.history.pushState(null, '', window.location.href);
        setShowLeaveConfirm(true);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    
    return () => window.removeEventListener('popstate', handlePopState);
  }, [connectionStatus]);

  // Check if user is admin and update context
  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData?.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    };
    
    checkAdmin();
  }, [user, setIsAdmin]);

  // Check for recovered recording from crash - auto-save silently
  useEffect(() => {
    const recovered = getRecoveredRecording();
    if (recovered && user) {
      toast.info(
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 animate-pulse flex-shrink-0">
            <defs>
              <linearGradient id="recover-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6e4"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
              <filter id="recover-glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#recover-gradient)" strokeWidth="2" fill="none" filter="url(#recover-glow)"/>
            <path d="M12 8v8M8 12h8" stroke="url(#recover-gradient)" strokeWidth="2" strokeLinecap="round" filter="url(#recover-glow)"/>
          </svg>
          <div>
            <div className="font-medium">Восстанавливаем запись...</div>
            <div className="text-xs text-muted-foreground">Пожалуйста, подождите</div>
          </div>
        </div>,
        { duration: 15000 }
      );
      saveRecoveredToProfile(recovered);
    }
  }, [user, getRecoveredRecording, clearRecoveredRecording]);

  // Show registration hint for non-authenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      const timer = setTimeout(() => {
        setShowRegistrationHint(true);
        setTimeout(() => setShowRegistrationHint(false), 8000);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user]);

  // Track participant join
  useEffect(() => {
    const trackJoin = async () => {
      try {
        await supabase.functions.invoke('track-participant', {
          body: { roomId: roomSlug, userName, action: 'join', userId: user?.id || null }
        });
        console.log('Participant tracked:', userName);
      } catch (error) {
        console.error('Failed to track participant:', error);
      }
    };
    
    trackJoin();
    
    return () => {
      supabase.functions.invoke('track-participant', {
        body: { roomId: roomSlug, userName, action: 'leave', userId: user?.id || null }
      }).catch(console.error);
    };
  }, [userName, roomSlug, user?.id]);

  // Update context with header buttons (connection indicator removed - quality shown elsewhere)
  useEffect(() => {
    setHeaderButtons(headerButtonsElement);
  }, [isRecording, recordingDuration, isTranscribing, showCaptions, showTranslator, copied, showIPPanel, isAdmin, liveKitRoom, setHeaderButtons]);

  // =========================================
  // Helper functions - defined after all hooks
  // =========================================

  const handleStayInCall = () => {
    setShowLeaveConfirm(false);
  };

  const handleLeaveCall = async () => {
    setShowLeaveConfirm(false);
    userInitiatedEndRef.current = true;
    
    if (hasStartedRecordingRef.current && user) {
      navigate('/dashboard?saving=true', { replace: true });
      await runMeetingSaveBackground();
    } else if (hasStartedRecordingRef.current && !user) {
      setEndSaveDialogOpen(true);
      setEndSaveStatus("saving");
      await runMeetingSave();
    } else {
      // Route through /__refresh to force cache-busting after call end
      navigate(`/__refresh?to=${encodeURIComponent(user ? '/dashboard' : '/')}&t=${Date.now()}`, { replace: true });
    }
  };

  // Save recovered recording to personal cabinet
  const saveRecoveredToProfile = async (audioBlob: Blob) => {
    if (!user) return;

    try {
      const transcript = await transcribeAudio(audioBlob);
      
      const { error } = await supabase.functions.invoke('summarize-meeting', {
        body: {
          roomId: `recovered-${Date.now()}`,
          roomName: 'Восстановленная запись',
          transcript: transcript ? `[Восстановленная запись]: ${transcript}` : '[Аудио без транскрипции]',
          participants: [userName || 'Участник'],
          userId: user.id,
        },
      });

      if (error) throw error;

      toast.success(
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0">
            <defs>
              <linearGradient id="success-save-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="100%" stopColor="#06b6e4"/>
              </linearGradient>
              <filter id="success-save-glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#success-save-gradient)" strokeWidth="2" fill="none" filter="url(#success-save-glow)"/>
            <path d="M8 12l3 3 5-5" stroke="url(#success-save-gradient)" strokeWidth="2.5" fill="none" strokeLinecap="round" filter="url(#success-save-glow)"/>
          </svg>
          <div>
            <div className="font-medium">Запись сохранена</div>
            <div className="text-xs text-muted-foreground">Доступна в «Мои созвоны»</div>
          </div>
        </div>,
        { duration: 5000 }
      );
      
      clearRecoveredRecording();
    } catch (e) {
      console.error('Failed to save recovered recording:', e);
      toast.error('Ошибка сохранения', {
        description: 'Не удалось сохранить запись.',
      });
    }
  };

  // Use production URL for sharing, not preview URL
  const productionUrl = 'https://aplink.live';
  const roomLink = `${productionUrl}/room/${roomSlug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      toast.success(t.meetingRoom.linkCopied, {
        description: t.meetingRoom.linkCopiedDesc,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(t.meetingRoom.error, {
        description: t.meetingRoom.copyLinkError,
      });
    }
  };

  // Transcribe audio using ElevenLabs
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      setIsTranscribing(true);
      console.log('Transcribing audio, size:', audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-transcribe', {
        body: formData,
      });

      if (error) throw error;

      const text = (data as any)?.text || '';
      console.log('Transcription result:', text?.substring(0, 100));
      return text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  };

  // Toggle recording
  const toggleRecording = async () => {
    if (isRecording) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 0) {
        toast.info(t.meetingRoom.recordStopped, {
          description: t.meetingRoom.transcribing,
        });
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript) {
            transcriptRef.current.push(`[Транскрипция созвона]: ${transcript}`);
            toast.success(t.meetingRoom.transcriptionReady, {
              description: transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript,
            });
          }
        } catch (error) {
          toast.error(t.meetingRoom.transcriptionError, {
            description: t.meetingRoom.transcriptionErrorDesc,
          });
        }
      }
      setRecordingDuration(0);
    } else {
      try {
        hasStartedRecordingRef.current = true;
        await startRecording();
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        toast.success(t.meetingRoom.recordStarted, {
          description: t.meetingRoom.recordStartedDesc,
        });
      } catch (error) {
        hasStartedRecordingRef.current = false;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        toast.error(t.meetingRoom.error, {
          description: t.meetingRoom.recordError,
        });
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Build meeting save payload
  const buildMeetingSaveBasePayload = async (): Promise<PendingMeetingSaveBase | null> => {
    if (!hasStartedRecordingRef.current && participantsRef.current.size === 0) return null;

    if (isRecordingRef.current) {
      await stopRecording();
    }

    const transcriptText = transcriptRef.current.join("\n") || "[Транскрипция отсутствует]";
    
    const participants = Array.from(participantsRef.current);
    if (!participants.includes(safeUserName)) {
      participants.push(safeUserName);
    }

    return {
      roomId: roomSlug,
      roomName: roomDisplayName,
      transcript: transcriptText,
      participants,
    };
  };

  const loadPendingSaveBaseFromStorage = (): PendingMeetingSaveBase | null => {
    try {
      const raw = sessionStorage.getItem(PENDING_MEETING_SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as PendingMeetingSaveBase;
    } catch {
      return null;
    }
  };

  const savePendingBaseToStorage = (base: PendingMeetingSaveBase) => {
    try {
      sessionStorage.setItem(PENDING_MEETING_SAVE_KEY, JSON.stringify(base));
    } catch { /* ignore */ }
  };

  const clearPendingBaseFromStorage = () => {
    try {
      sessionStorage.removeItem(PENDING_MEETING_SAVE_KEY);
    } catch { /* ignore */ }
  };

  // For authenticated users - save in background with progress indicator
  const runMeetingSaveBackground = async () => {
    if (!hasStartedRecordingRef.current || !user) return;

    setRecordingSaveStatus('preparing');
    setRecordingSaveProgress(10);

    const base = await buildMeetingSaveBasePayload();
    if (!base) {
      setRecordingSaveStatus('error');
      setRecordingSaveError('Не удалось подготовить данные');
      return;
    }

    setRecordingSaveStatus('uploading');
    setRecordingSaveProgress(30);

    try {
      // Simulate progress during API call
      const progressInterval = setInterval(() => {
        setRecordingSaveProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      setRecordingSaveStatus('saving');
      setRecordingSaveProgress(50);

      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        { ...base, userId: user.id },
      );

      clearInterval(progressInterval);

      if (response?.success && response?.meeting?.id) {
        console.log("Meeting saved in background with ID:", response.meeting.id);
        clearPendingBaseFromStorage();
        setRecordingSaveProgress(100);
        setRecordingSaveStatus('success');
        setRecordingSaveError(undefined);
      } else {
        console.error("Background save failed - server did not confirm");
        setRecordingSaveStatus('error');
        setRecordingSaveError('Сервер не подтвердил сохранение');
      }
    } catch (e: any) {
      console.error("Background meeting save error:", e);
      setRecordingSaveStatus('error');
      setRecordingSaveError(e?.message || 'Ошибка при сохранении');
    }
  };

  const runMeetingSave = async () => {
    if (!hasStartedRecordingRef.current) {
      setEndSaveNeedsLogin(false);
      setEndSaveStatus("error");
      setEndSaveError("Запись не была включена — нечего сохранять.");
      return;
    }

    if (!user) {
      const base = await buildMeetingSaveBasePayload();
      if (base) {
        pendingSaveBaseRef.current = base;
        savePendingBaseToStorage(base);
      }

      setEndSaveNeedsLogin(true);
      setEndSaveStatus("error");
      setEndSaveError("Для сохранения созвона нужно войти в аккаунт.");
      return;
    }

    const base = await buildMeetingSaveBasePayload();
    if (!base) {
      setEndSaveNeedsLogin(false);
      setEndSaveStatus("error");
      setEndSaveError("Не удалось подготовить данные для сохранения.");
      return;
    }

    pendingSaveBaseRef.current = base;

    try {
      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        { ...base, userId: user.id },
      );

      if (response?.success && response?.meeting?.id) {
        console.log("Meeting saved successfully with ID:", response.meeting.id);
        clearPendingBaseFromStorage();
        setEndSaveNeedsLogin(false);
        setEndSaveStatus("success");
        setEndSaveError(null);
      } else {
        throw new Error("Сервер не подтвердил сохранение созвона");
      }
    } catch (e: any) {
      const msg = e?.message || "Не удалось сохранить созвон";
      console.error("Meeting save error:", e);
      setEndSaveStatus("error");
      setEndSaveError(msg);
    }
  };

  const retryEndSave = async () => {
    setEndSaveStatus("saving");
    setEndSaveError(null);

    try {
      const base = pendingSaveBaseRef.current ?? loadPendingSaveBaseFromStorage();
      if (!base) {
        throw new Error("Не удалось найти данные для повторного сохранения");
      }

      if (!user) {
        pendingSaveBaseRef.current = base;
        savePendingBaseToStorage(base);
        setEndSaveNeedsLogin(true);
        setEndSaveStatus("error");
        setEndSaveError("Для сохранения созвона нужно войти в аккаунт.");
        return;
      }

      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        { ...base, userId: user.id },
      );

      if (response?.success && response?.meeting?.id) {
        clearPendingBaseFromStorage();
        setEndSaveNeedsLogin(false);
        setEndSaveStatus("success");
      } else {
        throw new Error("Сервер не подтвердил сохранение");
      }
    } catch (e: any) {
      setEndSaveStatus("error");
      setEndSaveError(e?.message || "Не удалось сохранить созвон");
    }
  };

  const goToCallsAfterSave = () => {
    setEndSaveDialogOpen(false);
    window.open('https://apolloproduction.studio', '_blank');
    // Route through /__refresh to force cache-busting after call end
    navigate(`/__refresh?to=${encodeURIComponent(user ? '/dashboard' : '/')}&t=${Date.now()}`, { replace: true });
  };

  const exitWithoutSaving = () => {
    clearPendingBaseFromStorage();
    setEndSaveDialogOpen(false);
    window.open('https://apolloproduction.studio', '_blank');
    // Route through /__refresh to force cache-busting after call end
    navigate(`/__refresh?to=${encodeURIComponent(user ? '/dashboard' : '/')}&t=${Date.now()}`, { replace: true });
  };

  // Handle minimize - go to home page
  const handleMinimize = useCallback(() => {
    minimize();
    navigate('/', { replace: true });
  }, [minimize, navigate]);

  // Get connection quality icon
  const getQualityIndicator = () => {
    if (connectionQuality >= 80) {
      return { icon: SignalHigh, color: 'text-green-500', label: 'Отличное' };
    } else if (connectionQuality >= 50) {
      return { icon: SignalMedium, color: 'text-yellow-500', label: 'Среднее' };
    } else if (connectionQuality >= 20) {
      return { icon: SignalLow, color: 'text-orange-500', label: 'Слабое' };
    } else {
      return { icon: Signal, color: 'text-red-500', label: 'Плохое' };
    }
  };

  // Header buttons - passed to GlobalActiveCall via context
  const headerButtonsElement = (
    <>
      {/* Recording button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            disabled={isTranscribing}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-full transition-all",
              isRecording 
                ? "scale-105 shadow-lg shadow-destructive/30" 
                : "border-white/20 bg-white/10 hover:bg-white/20"
            )}
          >
            {isTranscribing ? (
              <div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isRecording ? (
              <>
                <span className="relative w-2 h-2 bg-white rounded-full">
                  <span className="absolute inset-0 w-full h-full bg-white rounded-full animate-ping opacity-75" />
                </span>
                <span className="text-xs font-mono">{formatRecordingTime(recordingDuration)}</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span className="text-xs hidden sm:inline">REC</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{isRecording ? t.meetingRoom.stopRecordTooltip : t.meetingRoom.recordTooltip}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Captions button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setShowCaptions(!showCaptions)}
            variant={showCaptions ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-full transition-all",
              showCaptions 
                ? "bg-primary/30 border-primary/50" 
                : "border-white/20 bg-white/10 hover:bg-white/20"
            )}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">CC</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Субтитры с AI-переводом</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Translator button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setShowTranslator(!showTranslator)}
            variant={showTranslator ? "default" : "outline"}
            size="sm"
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-full transition-all",
              showTranslator 
                ? "bg-primary/30 border-primary/50" 
                : "border-white/20 bg-white/10 hover:bg-white/20"
            )}
          >
            <Languages className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t.meetingRoom.translateTooltip}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* Copy link button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={copyLink}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 h-8 px-3 rounded-full border-white/20 bg-white/10 hover:bg-white/20 transition-all"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{t.meetingRoom.linkTooltip}</p>
        </TooltipContent>
      </Tooltip>
      
      {/* IP Panel button - only for admins */}
      {isAdmin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setShowIPPanel(!showIPPanel)}
              variant={showIPPanel ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-full transition-all",
                showIPPanel 
                  ? "bg-primary/30 border-primary/50" 
                  : "border-white/20 bg-white/10 hover:bg-white/20"
              )}
            >
              <Globe className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{t.meetingRoom.ipTooltip}</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {/* Call Quality Widget - removed, integrated into CallDiagnosticsPanel */}
    </>
  );

  // Connection indicator element removed - quality is shown on participant tiles in Gallery mode
  // and in the CallTimer component via the colored dot

  return (
    <>
      {/* Recording Indicator - Fixed top-left */}
      {isRecording && (
        <div className="fixed top-4 left-4 z-[100] flex items-center gap-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground px-3 py-1.5 rounded-full shadow-lg animate-fade-in">
          <span className="relative w-3 h-3">
            <span className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
            <span className="absolute inset-0 bg-white rounded-full" />
          </span>
          <span className="text-xs font-bold tracking-wide">REC</span>
          <span className="text-xs font-mono font-bold">{formatRecordingTime(recordingDuration)}</span>
        </div>
      )}

      {/* Meeting End Save Dialog */}
      <MeetingEndSaveDialog
        open={endSaveDialogOpen}
        status={endSaveStatus}
        errorMessage={endSaveError}
        onRetry={retryEndSave}
        onGoToCalls={goToCallsAfterSave}
        onExitWithoutSaving={exitWithoutSaving}
        onLoginToSave={
          endSaveNeedsLogin
            ? () => {
                navigate(`/auth?redirect=${encodeURIComponent("/dashboard")}`);
              }
            : undefined
        }
      />

      {/* Leave Call Confirmation Dialog */}
      <LeaveCallDialog
        open={showLeaveConfirm}
        onStay={handleStayInCall}
        onLeave={handleLeaveCall}
      />
      
      {/* NOTE: Translator, IP Panel, and Captions are now rendered in GlobalActiveCall.tsx */}

      {/* Manual Recording Prompt - positioned top-right to not obstruct */}
      {showManualRecordPrompt && user && !isRecording && (
        <div className="fixed top-4 right-4 z-[60] glass rounded-xl px-4 py-3 border border-primary/30 animate-slide-up max-w-sm">
          <div className="flex items-start gap-3">
            <Mic className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Начать запись?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Автозапись отключена. Нажмите чтобы записать созвон.
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleManualRecordStart}
                >
                  <Mic className="w-3 h-3 mr-1" />
                  Начать
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowManualRecordPrompt(false)}
                >
                  Позже
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowManualRecordPrompt(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Registration hint for non-authenticated users */}
      {showRegistrationHint && !user && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] glass rounded-xl px-4 py-3 border border-primary/30 animate-slide-up max-w-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t.meetingRoom.registerHint}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.meetingRoom.registerHintDesc}
              </p>
              <Button
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  setShowRegistrationHint(false);
                  navigate('/auth?mode=register');
                }}
              >
                {t.meetingRoom.register}
              </Button>
            </div>
            <button
              onClick={() => setShowRegistrationHint(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Recording Save Progress Indicator */}
      <RecordingSaveIndicator
        status={recordingSaveStatus}
        progress={recordingSaveProgress}
        error={recordingSaveError}
        onClose={() => setRecordingSaveStatus('idle')}
      />
    </>
  );
};

export default MeetingRoomGuard;
