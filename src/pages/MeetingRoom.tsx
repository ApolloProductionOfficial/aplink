import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate, useBlocker } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  User,
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
  Bug,
  ClipboardCopy,
  Link2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ParticipantsIPPanel from "@/components/ParticipantsIPPanel";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";
import { RealtimeTranslator } from "@/components/RealtimeTranslator";
import { useTranslation } from "@/hooks/useTranslation";
import apolloLogo from "@/assets/apollo-logo.mp4";
import CustomCursor from "@/components/CustomCursor";
import { MeetingEndSaveDialog, type MeetingSaveStatus } from "@/components/MeetingEndSaveDialog";
import { invokeBackendFunctionKeepalive } from "@/utils/invokeBackendFunctionKeepalive";
import { useJitsiHealthMonitor } from "@/hooks/useJitsiHealthMonitor";
import LeaveCallDialog from "@/components/LeaveCallDialog";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const MeetingRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get("name");
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const translationAudioUnlockedRef = useRef(false);
  const initJitsiRef = useRef<null | (() => void)>(null);
  const pendingReconnectRef = useRef(false);
  const mediaStateOnHideRef = useRef<{ audioMuted: boolean; videoMuted: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegistrationHint, setShowRegistrationHint] = useState(false);
  const [participantIP, setParticipantIP] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showIPPanel, setShowIPPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const transcriptRef = useRef<string[]>([]);
  const participantsRef = useRef<Set<string>>(new Set());
  const hasRedirectedRef = useRef(false); // Prevent multiple redirects
  const userInitiatedEndRef = useRef(false); // Track if user clicked end call
  const hasStartedRecordingRef = useRef(false); // Track if recording was started

  // End-call save UI (explicit status + retry)
  const [endSaveDialogOpen, setEndSaveDialogOpen] = useState(false);
  const [endSaveStatus, setEndSaveStatus] = useState<MeetingSaveStatus>("saving");
  const [endSaveError, setEndSaveError] = useState<string | null>(null);
  const [endSaveNeedsLogin, setEndSaveNeedsLogin] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  type PendingMeetingSaveBase = {
    roomId: string;
    roomName: string;
    transcript: string;
    participants: string[];
  };

  const PENDING_MEETING_SAVE_KEY = "pending_meeting_save_v1";
  const pendingSaveBaseRef = useRef<PendingMeetingSaveBase | null>(null);

  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { sendNotification } = usePushNotifications();
  const { isRecording, startRecording, stopRecording, getAudioBlob, getRecoveredRecording, clearRecoveredRecording } = useAudioRecorder();
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  const { playConnectedSound, playDisconnectedSound, playReconnectingSound } = useConnectionSounds();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranslator, setShowTranslator] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<number>(100); // 0-100 percentage
  const diagnosticsLogRef = useRef<{ ts: string; event: string; data?: unknown }[]>([]);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();

  // Prevent crashes on invalid / missing URL param or auth still loading
  if (!roomId) return null;

  // Use room ID as-is for Jitsi (consistent room name)
  // Display with proper formatting (dashes to spaces)
  // Safe access with optional chaining and fallbacks
  const roomDisplayName = decodeURIComponent(roomId ?? '').replace(/-/g, ' ') || 'Meeting';
  const roomSlug = roomId ?? '';
  const safeUserName = userName ?? user?.email?.split('@')[0] ?? 'Guest';

  // Helper to log diagnostic events (capped at 100 entries)
  const logDiagnostic = useCallback((event: string, data?: unknown) => {
    const entry = {
      ts: new Date().toISOString(),
      event,
      data,
    };
    diagnosticsLogRef.current = [...diagnosticsLogRef.current.slice(-99), entry];
    console.log(`[DIAG:${event}]`, data ?? '');
  }, []);

  // Jitsi health monitoring with Telegram alerts
  useJitsiHealthMonitor({
    roomId: roomSlug,
    userName: userName || 'Unknown',
    jitsiApi: apiRef.current,
    enabled: connectionStatus === 'connected',
    onConnectionLost: () => {
      logDiagnostic('health-monitor-connection-lost', {});
    },
    onConnectionRestored: () => {
      logDiagnostic('health-monitor-connection-restored', {});
    },
  });

  // Block navigation when in a call - prevents accidental back button exits
  // This is key to preventing call disconnection on back button like Google Meet does
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      // Only block if user is in an active call and hasn't initiated end
      const isInActiveCall = connectionStatus === 'connected' && !userInitiatedEndRef.current && !hasRedirectedRef.current;
      const isNavigatingAway = currentLocation.pathname !== nextLocation.pathname;
      return isInActiveCall && isNavigatingAway;
    }
  );

  // Handle blocked navigation - show modal dialog
  useEffect(() => {
    if (blocker.state === 'blocked') {
      // Show the modal dialog
      setShowLeaveConfirm(true);
    }
  }, [blocker]);

  const handleStayInCall = () => {
    setShowLeaveConfirm(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };

  const handleLeaveCall = () => {
    setShowLeaveConfirm(false);
    userInitiatedEndRef.current = true;
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  };

  // Page Lifecycle & Browser events for extended diagnostics
  useEffect(() => {
    const onVisibilityChange = () => {
      logDiagnostic('visibilitychange', { hidden: document.hidden, state: document.visibilityState });
    };
    const onPageHide = (e: PageTransitionEvent) => {
      logDiagnostic('pagehide', { persisted: e.persisted });
    };
    const onPageShow = (e: PageTransitionEvent) => {
      logDiagnostic('pageshow', { persisted: e.persisted });
    };
    const onFreeze = () => {
      logDiagnostic('freeze', {});
    };
    const onResume = () => {
      logDiagnostic('resume', {});
    };
    const onFocus = () => {
      logDiagnostic('focus', {});
    };
    const onBlur = () => {
      logDiagnostic('blur', {});
    };
    const onOnline = () => {
      logDiagnostic('online', {});
    };
    const onOffline = () => {
      logDiagnostic('offline', {});
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    // freeze/resume are part of Page Lifecycle API (Chrome only)
    (document as any).addEventListener?.('freeze', onFreeze);
    (document as any).addEventListener?.('resume', onResume);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    logDiagnostic('diagnostics-init', { userAgent: navigator.userAgent });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      (document as any).removeEventListener?.('freeze', onFreeze);
      (document as any).removeEventListener?.('resume', onResume);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [logDiagnostic]);

  // Copy diagnostics to clipboard
  const copyDiagnostics = async () => {
    const report = {
      room: roomSlug,
      user: userName,
      connectionStatus,
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      events: diagnosticsLogRef.current,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setDiagnosticsCopied(true);
      toast({ title: t.meetingRoom.diagnosticsCopied, description: t.meetingRoom.diagnosticsCopiedDesc });
      setTimeout(() => setDiagnosticsCopied(false), 2000);
    } catch {
      toast({ title: t.meetingRoom.error, description: t.meetingRoom.copyLinkError, variant: "destructive" });
    }
  };
  
  // Track presence in this room
  usePresence(roomDisplayName);

  // Check if user is admin and fetch IP
  useEffect(() => {
    const checkAdminAndFetchIP = async () => {
      if (user) {
        // Check admin role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData?.role === 'admin') {
          setIsAdmin(true);
          // Fetch IP for admins
          try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            setParticipantIP(data.ip);
          } catch (error) {
            console.error('Failed to fetch IP:', error);
          }
        }
      }
    };
    
    checkAdminAndFetchIP();
  }, [user]);

  // Save recovered recording to personal cabinet
  const saveRecoveredToProfile = async (audioBlob: Blob) => {
    if (!user) return;
    
    const toastId = toast({
      title: '🎬 Сохранение записи...',
      description: 'Транскрипция и сохранение в личный кабинет...',
      duration: 60000,
    });

    try {
      // Transcribe the audio
      const transcript = await transcribeAudio(audioBlob);
      
      // Save to meeting_transcripts
      const { data, error } = await supabase.functions.invoke('summarize-meeting', {
        body: {
          roomId: `recovered-${Date.now()}`,
          roomName: 'Восстановленная запись',
          transcript: transcript ? `[Восстановленная запись]: ${transcript}` : '[Аудио без транскрипции]',
          participants: [userName || 'Участник'],
          userId: user.id,
        },
      });

      if (error) throw error;

      toast({
        title: '✅ Запись сохранена!',
        description: 'Конспект доступен в разделе "Созвоны" вашего личного кабинета.',
        duration: 5000,
      });
      
      clearRecoveredRecording();
    } catch (e) {
      console.error('Failed to save recovered recording:', e);
      toast({
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить запись. Попробуйте ещё раз.',
        variant: 'destructive',
      });
    }
  };

  // Check for recovered recording from crash
  useEffect(() => {
    const recovered = getRecoveredRecording();
    if (recovered && user) {
      toast({
        title: '📼 Найдена незавершённая запись',
        description: 'Запись предыдущего созвона была восстановлена после сбоя.',
        action: (
          <div className="flex gap-2 mt-2">
            <Button 
              size="sm" 
              onClick={() => saveRecoveredToProfile(recovered)}
            >
              💾 Сохранить
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                clearRecoveredRecording();
                toast({
                  title: 'Запись удалена',
                  description: 'Восстановленная запись была удалена.',
                });
              }}
            >
              🗑️ Удалить
            </Button>
          </div>
        ),
        duration: 30000, // 30 seconds to decide
      });
    }
  }, [user, getRecoveredRecording, clearRecoveredRecording]);

  // Show registration hint for non-authenticated users
  useEffect(() => {
    if (!authLoading && !user) {
      const timer = setTimeout(() => {
        setShowRegistrationHint(true);
        // Auto-hide after 8 seconds
        setTimeout(() => setShowRegistrationHint(false), 8000);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, user]);

  // Track participant join
  useEffect(() => {
    if (!userName || !roomSlug) return;
    
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
    
    // Track leave on unmount
    return () => {
      supabase.functions.invoke('track-participant', {
        body: { roomId: roomSlug, userName, action: 'leave', userId: user?.id || null }
      }).catch(console.error);
    };
  }, [userName, roomSlug, user?.id]);

  // Redirect to home page if no name provided - user must introduce themselves
  useEffect(() => {
    if (!userName) {
      navigate(`/?room=${encodeURIComponent(roomSlug)}`);
    }
  }, [userName, roomSlug, navigate]);

  // Clean room link for sharing
  const roomLink = `${window.location.origin}/room/${roomSlug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      toast({
        title: t.meetingRoom.linkCopied,
        description: t.meetingRoom.linkCopiedDesc,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: t.meetingRoom.error,
        description: t.meetingRoom.copyLinkError,
        variant: "destructive",
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

      if (error) {
        throw error;
      }

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

  // Toggle recording - using microphone instead of screen capture to prevent call exit
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 0) {
        toast({
          title: t.meetingRoom.recordStopped,
          description: t.meetingRoom.transcribing,
        });
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript) {
            transcriptRef.current.push(`[Транскрипция созвона]: ${transcript}`);
            toast({
              title: t.meetingRoom.transcriptionReady,
              description: transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript,
            });
          }
        } catch (error) {
          toast({
            title: t.meetingRoom.transcriptionError,
            description: t.meetingRoom.transcriptionErrorDesc,
            variant: "destructive",
          });
        }
      }
      setRecordingDuration(0);
    } else {
      try {
        hasStartedRecordingRef.current = true; // Mark that recording was started
        await startRecording();
        // Start recording timer
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        toast({
          title: t.meetingRoom.recordStarted,
          description: t.meetingRoom.recordStartedDesc,
        });
      } catch (error) {
        hasStartedRecordingRef.current = false;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        toast({
          title: t.meetingRoom.error,
          description: t.meetingRoom.recordError,
          variant: "destructive",
        });
      }
    }
  };

  // Format recording duration
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Save meeting transcript and summary in background
  const saveMeetingTranscriptBackground = async () => {
    // If recording was started, try to get audio even if the recorder already stopped
    let audioBlob: Blob | null = null;

    if (isRecordingRef.current) {
      console.log('Recording is active, stopping...');
      audioBlob = await stopRecording();
    } else if (hasStartedRecordingRef.current) {
      audioBlob = getAudioBlob();
      // Also check for recovered recording
      if (!audioBlob || audioBlob.size === 0) {
        audioBlob = getRecoveredRecording();
      }
    }

    // Only save if user started recording at some point
    if (!hasStartedRecordingRef.current) {
      console.log('Recording was not started, skipping transcript save');
      return;
    }

    // Only save if user is authenticated
    if (!user) {
      console.log('User not authenticated, skipping transcript save');
      return;
    }

    // Show processing toast
    const toastId = toast({
      title: '🎬 Обработка записи...',
      description: 'Транскрипция и анализ созвона. Примерное время: 30-60 сек.',
      duration: 60000, // Keep it visible for a long time
    });

    let transcriptText = transcriptRef.current.join('\n');

    // Transcribe audio if available
    if (audioBlob && audioBlob.size > 0) {
      try {
        console.log('Transcribing audio, size:', audioBlob.size);
        const transcript = await transcribeAudio(audioBlob);
        if (transcript) {
          transcriptText += `\n[Транскрипция] ${userName}: ${transcript}`;
        }
      } catch (error) {
        console.error('Transcription failed:', error);
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('summarize-meeting', {
        body: {
          roomId: roomSlug,
          roomName: roomDisplayName,
          transcript: transcriptText,
          participants: Array.from(participantsRef.current),
          userId: user.id,
        },
      });

      if (error) throw error;

      console.log('Meeting saved:', data);
      
      // Update toast to success
      toast({
        title: '✅ Запись сохранена!',
        description: 'Конспект доступен в разделе "Созвоны" вашего личного кабинета.',
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to save meeting:', error);
      toast({
        title: 'Ошибка сохранения',
        description: 'Не удалось сохранить созвон. Попробуйте ещё раз.',
        variant: 'destructive',
      });
    }
  };

  const buildMeetingSaveBasePayload = async (): Promise<
    | {
        roomId: string;
        roomName: string;
        transcript: string;
        participants: string[];
      }
    | null
  > => {
    // Only save if recording was started at some point
    if (!hasStartedRecordingRef.current) return null;

    // Make sure recorder is stopped so we don't lose chunks on unload
    if (isRecordingRef.current) {
      await stopRecording();
    }

    const transcriptText = transcriptRef.current.join("\n") || "[Транскрипция отсутствует]";

    return {
      roomId: roomSlug,
      roomName: roomDisplayName,
      transcript: transcriptText,
      participants: Array.from(participantsRef.current),
    };
  };

  const buildMeetingSavePayload = async () => {
    const base = await buildMeetingSaveBasePayload();
    if (!base) return null;
    if (!user) return null;

    return {
      ...base,
      userId: user.id,
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
    } catch {
      // ignore
    }
  };

  const clearPendingBaseFromStorage = () => {
    try {
      sessionStorage.removeItem(PENDING_MEETING_SAVE_KEY);
    } catch {
      // ignore
    }
  };

  const runMeetingSave = async () => {
    // Не показываем «успех», если сохранять нечего
    if (!hasStartedRecordingRef.current) {
      setEndSaveNeedsLogin(false);
      setEndSaveStatus("error");
      setEndSaveError("Запись не была включена — нечего сохранять.");
      return;
    }

    // Если пользователь не вошёл — сохраняем данные локально и предлагаем авторизацию
    if (!user) {
      const base = await buildMeetingSaveBasePayload();
      if (base) {
        pendingSaveBaseRef.current = base;
        savePendingBaseToStorage(base);
      }

      setEndSaveNeedsLogin(true);
      setEndSaveStatus("error");
      setEndSaveError(
        "Для сохранения созвона нужно войти в аккаунт. Данные сохранены на этом устройстве — войдите и нажмите «Повторить».",
      );
      return;
    }

    const payload = await buildMeetingSavePayload();
    if (!payload) {
      setEndSaveNeedsLogin(false);
      setEndSaveStatus("error");
      setEndSaveError("Не удалось подготовить данные для сохранения.");
      return;
    }

    // Keep base payload for retry flow
    pendingSaveBaseRef.current = {
      roomId: payload.roomId,
      roomName: payload.roomName,
      transcript: payload.transcript,
      participants: payload.participants,
    };

    try {
      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        payload,
      );

      // Verify the meeting was actually saved
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
        // Still not logged in
        pendingSaveBaseRef.current = base;
        savePendingBaseToStorage(base);
        setEndSaveNeedsLogin(true);
        setEndSaveStatus("error");
        setEndSaveError("Для сохранения созвона нужно войти в аккаунт.");
        return;
      }

      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        {
          ...base,
          userId: user.id,
        },
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
    navigate("/dashboard");
  };

  const exitWithoutSaving = () => {
    clearPendingBaseFromStorage();
    setEndSaveDialogOpen(false);
    navigate("/");
  };

  // Logic executed when user explicitly ends the call
  const handleUserEndCall = async () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    logDiagnostic("user-end-call", { hasRecording: hasStartedRecordingRef.current });

    // No need to save -> just go home
    if (!hasStartedRecordingRef.current) {
      navigate("/");
      return;
    }

    // Open save dialog
    setEndSaveDialogOpen(true);
    setEndSaveStatus("saving");
    setEndSaveError(null);

    await runMeetingSave();
  };

  // Handle Jitsi events - only redirect if user initiated end
  const handleJitsiClose = () => {
    // Only process if user clicked hangup button
    if (!userInitiatedEndRef.current) {
      console.log('Ignoring automatic close event - user did not initiate');
      return;
    }
    handleUserEndCall();
  };

  // Prevent call from disconnecting when tab is minimized or hidden
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
    let audioContextKeepAlive: AudioContext | null = null;
    let silentAudioInterval: ReturnType<typeof setInterval> | null = null;
    let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

    // Request Wake Lock to prevent screen from sleeping
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('Wake Lock acquired');
          
          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released, re-acquiring...');
            // Try to re-acquire when released
            if (!userInitiatedEndRef.current) {
              requestWakeLock();
            }
          });
        }
      } catch (err) {
        console.log('Wake Lock not available:', err);
      }
    };

    // Create silent audio to prevent browser from suspending WebRTC
    const startSilentAudio = () => {
      try {
        audioContextKeepAlive = new AudioContext();
        const oscillator = audioContextKeepAlive.createOscillator();
        const gainNode = audioContextKeepAlive.createGain();

        // IMPORTANT: keep it *almost* silent (not zero), so Chrome treats the tab as "playing audio"
        // and throttles it less aggressively in background.
        gainNode.gain.value = 0.00001;

        oscillator.connect(gainNode);
        gainNode.connect(audioContextKeepAlive.destination);
        oscillator.start();

        const resumeIfSuspended = async () => {
          if (audioContextKeepAlive?.state === 'suspended') {
            try {
              await audioContextKeepAlive.resume();
            } catch {
              // Silently ignore - audio context may not be available
            }
          }
        };

        // Try to resume on first user gesture (autoplay policies can suspend AudioContext)
        const resumeOnGesture = () => {
          console.log('User gesture detected - resuming audio keep-alive');
          audioContextKeepAlive?.resume().catch(() => {});
        };
        window.addEventListener('pointerdown', resumeOnGesture, { once: true, passive: true });
        window.addEventListener('keydown', resumeOnGesture, { once: true });

        // Periodically resume audio context to prevent suspension
        silentAudioInterval = setInterval(resumeIfSuspended, 5000);

        console.log('Silent audio started for connection keep-alive');
      } catch (e) {
        console.log('Silent audio not available:', e);
      }
    };

    // Keep WebSocket connections alive with periodic activity
    const startKeepAlive = () => {
      keepAliveInterval = setInterval(() => {
        if (apiRef.current && !userInitiatedEndRef.current) {
          // Send a small message to keep the connection alive
          try {
            // Get Jitsi connection and send a ping
            apiRef.current.executeCommand('sendEndpointTextMessage', '', 'keep-alive');
          } catch (e) {
            // Fallback: just log that we're still alive
            console.log('Keep-alive ping at', new Date().toISOString());
          }
        }
      }, 10000); // Every 10 seconds (more frequent)
    };

    // Periodically check connection status
    const startConnectionCheck = () => {
      connectionCheckInterval = setInterval(() => {
        if (apiRef.current && !userInitiatedEndRef.current) {
          try {
            const participants = apiRef.current.getParticipantsInfo();
            if (participants) {
              console.log('Connection check OK, participants:', participants.length);
            }
          } catch (e) {
            console.log('Connection check failed:', e);
          }
        }
      }, 20000); // Every 20 seconds
    };

    const handleVisibilityChange = async () => {
      console.log('Visibility changed:', document.hidden ? 'hidden' : 'visible');

      // Resume audio context immediately when visibility changes
      if (audioContextKeepAlive?.state === 'suspended') {
        audioContextKeepAlive.resume().catch(() => {});
      }

      if (!document.hidden) {
        // Tab became visible again - immediately try to restore connection
        await requestWakeLock();

        // Restore media state if we muted video on hide
        if (apiRef.current && mediaStateOnHideRef.current) {
          try {
            const prev = mediaStateOnHideRef.current;
            const isVideoMuted = (await apiRef.current.isVideoMuted?.()) ?? true;
            if (prev.videoMuted === false && isVideoMuted === true) {
              console.log('Restoring video state after background');
              logDiagnostic('background-video-restore', { action: 'toggleVideo' });
              apiRef.current.executeCommand('toggleVideo');
            }
          } catch (e) {
            console.log('Could not restore media state:', e);
          } finally {
            mediaStateOnHideRef.current = null;
          }
        }

        const reinitJitsiIfPossible = () => {
          if (!initJitsiRef.current) return;
          if (apiRef.current) {
            logDiagnostic('jitsi-api-disposing', { reason: 'reinit' });
            apiRef.current.dispose();
            apiRef.current = null;
          }
          initJitsiRef.current();
        };

        // If conference was dropped while hidden, rejoin immediately on return
        if (pendingReconnectRef.current && !userInitiatedEndRef.current) {
          console.log('Pending reconnect detected - rejoining now');
          pendingReconnectRef.current = false;
          setConnectionStatus('reconnecting');
          reinitJitsiIfPossible();
          return;
        }

        // Check if Jitsi is still connected
        if (apiRef.current && !userInitiatedEndRef.current) {
          try {
            // Trigger a check to ensure connection is active
            apiRef.current.executeCommand('sendEndpointTextMessage', '', 'visibility-restore');
          } catch (e) {
            console.log('Could not send restore message:', e);
          }
        }

        // If we know we are disconnected, reinitialize immediately
        if (connectionStatusRef.current === 'disconnected' && !userInitiatedEndRef.current) {
          console.log('Visible and disconnected - reinitializing Jitsi');
          setConnectionStatus('reconnecting');
          playReconnectingSound();
          reinitJitsiIfPossible();
        }
      } else {
        // Tab is being hidden - reduce load proactively (helps prevent disconnect on some browsers)
        if (apiRef.current && !userInitiatedEndRef.current) {
          try {
            const [audioMuted, videoMuted] = await Promise.all([
              (apiRef.current.isAudioMuted?.() as Promise<boolean> | undefined) ?? Promise.resolve(false),
              (apiRef.current.isVideoMuted?.() as Promise<boolean> | undefined) ?? Promise.resolve(false),
            ]);

            mediaStateOnHideRef.current = { audioMuted, videoMuted };

            // NOTE: Do NOT auto-mute video on background.
            // It makes the user experience feel like the video "disappears" when minimizing.
            // We only keep a snapshot of current mute state for diagnostics / future restore logic.
            logDiagnostic('background-state-captured', { audioMuted, videoMuted });

            // Send a keep-alive immediately
            apiRef.current.executeCommand('sendEndpointTextMessage', '', 'pre-hide-keepalive');
          } catch (e) {
            // Ignore
          }
        }
      }
    };

    // Handle focus/blur at window level (catches app switching on macOS)
    const handleWindowBlur = () => {
      console.log('Window lost focus (app switch)');
      // Resume audio context to prevent suspension
      if (audioContextKeepAlive?.state === 'suspended') {
        audioContextKeepAlive.resume().catch(() => {});
      }
      // Send immediate keep-alive
      if (apiRef.current && !userInitiatedEndRef.current) {
        try {
          apiRef.current.executeCommand('sendEndpointTextMessage', '', 'blur-keepalive');
        } catch (e) {
          // Ignore
        }
      }
    };

    const handleWindowFocus = async () => {
      console.log('Window gained focus (app switch back)');
      // Resume audio context
      if (audioContextKeepAlive?.state === 'suspended') {
        audioContextKeepAlive.resume().catch(() => {});
      }
      // Re-acquire wake lock
      await requestWakeLock();

      // If conference dropped while app was in background, rejoin immediately
      if (pendingReconnectRef.current && !userInitiatedEndRef.current) {
        console.log('Focus restored with pending reconnect - rejoining now');
        pendingReconnectRef.current = false;
        setConnectionStatus('reconnecting');
        if (apiRef.current) {
          logDiagnostic('jitsi-api-disposing', { reason: 'focus-reconnect' });
          apiRef.current.dispose();
          apiRef.current = null;
        }
        initJitsiRef.current?.();
        return;
      }

      // Check connection
      if (apiRef.current && !userInitiatedEndRef.current) {
        try {
          const participants = apiRef.current.getParticipantsInfo();
          console.log('Focus restored, participants:', participants?.length);
        } catch (e) {
          console.log('Focus restored but connection may need refresh');
        }
      }
    };

    // Handle freeze/resume events for mobile browsers
    const handleFreeze = () => {
      console.log('Page frozen');
      // Store state if needed
    };

    const handleResume = async () => {
      console.log('Page resumed');
      await requestWakeLock();
      
      // Resume audio context
      if (audioContextKeepAlive?.state === 'suspended') {
        audioContextKeepAlive.resume().catch(() => {});
      }
      
      // Check if still connected
      if (apiRef.current && !userInitiatedEndRef.current) {
        try {
          const participants = apiRef.current.getParticipantsInfo();
          console.log('Resuming - participants:', participants?.length);
        } catch (e) {
          console.log('Connection may need refresh after resume');
        }
      }
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      // Don't prevent normal navigation, but log the event
      if (!userInitiatedEndRef.current && !event.persisted) {
        console.log('Page hide - persisted:', event.persisted);
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only warn if user didn't initiate leave
      if (!userInitiatedEndRef.current && connectionStatus === 'connected') {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    // Initialize all keep-alive mechanisms
    requestWakeLock();
    startKeepAlive();
    startSilentAudio();
    startConnectionCheck();

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleFreeze);
    document.addEventListener('resume', handleResume);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      // Cleanup
      if (wakeLock) {
        wakeLock.release();
      }
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
      if (silentAudioInterval) {
        clearInterval(silentAudioInterval);
      }
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      if (audioContextKeepAlive) {
        audioContextKeepAlive.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handleFreeze);
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [playReconnectingSound]);

  // Store stable refs to avoid re-running useEffect on object identity changes
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user?.id]);

  const jitsiInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent re-initialization if already done for this room+user combo
    if (jitsiInitializedRef.current) {
      logDiagnostic('jitsi-init-skipped', { reason: 'already-initialized' });
      return;
    }

    let qualityInterval: ReturnType<typeof setInterval> | null = null;

    const initJitsi = () => {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) {
        // Retry if API not loaded yet
        setTimeout(initJitsi, 500);
        return;
      }

      try {
        const domain = "8x8.vc";
        const options = {
          roomName: `vpaas-magic-cookie-0dd6b184ec7a4883bb89cbfc8c186c8a/${roomSlug}`,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName: userName,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: true,
            prejoinPageEnabled: false,
            prejoinConfig: {
              enabled: false,
            },
            disableDeepLinking: true,
            disableAudioLevels: false,
            enableNoisyMicDetection: true,
            enableInsecureRoomNameWarning: false,
            defaultLanguage: "ru",
            // Enable transcription
            transcription: {
              enabled: true,
              autoTranscribeOnRecord: true,
            },
            // Background-friendly defaults (closer to "обычный" Jitsi)
            disableSuspendVideo: false,
            enableLayerSuspension: true,
            channelLastN: 8,
            // Audio settings
            audioQuality: {
              stereo: false,
              opusMaxAverageBitrate: 20000,
            },
            toolbarButtons: [
              'camera',
              'chat',
              'closedcaptions',
              'desktop',
              'download',
              'embedmeeting',
              'etherpad',
              'feedback',
              'filmstrip',
              'fullscreen',
              'hangup',
              'help',
              'highlight',
              'invite',
              'linktosalesforce',
              'livestreaming',
              'microphone',
              'noisesuppression',
              'participants-pane',
              'profile',
              'raisehand',
              'recording',
              'security',
              'select-background',
              'settings',
              'shareaudio',
              'sharedvideo',
              'shortcuts',
              'stats',
              'tileview',
              'toggle-camera',
              'videoquality',
              'whiteboard',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: "",
            DEFAULT_BACKGROUND: "#050505",
            TOOLBAR_ALWAYS_VISIBLE: true,
            MOBILE_APP_PROMO: false,
            TOOLBAR_BACKGROUND: "#0a0a0a",
          },
        };

        logDiagnostic('jitsi-api-creating', { domain, roomName: options.roomName });
        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
        logDiagnostic('jitsi-api-created', {});
        setIsLoading(false);

        const logJitsiEvent = (name: string, payload?: unknown) => {
          const entry = {
            hidden: document.hidden,
            visibilityState: document.visibilityState,
            payload,
          };
          console.log(`[JITSI:${name}]`, entry);
          logDiagnostic(`JITSI:${name}`, entry);
        };

        // Listen for error messages from Jitsi
        apiRef.current.addEventListener('errorOccurred', (error: { error: { name: string; message: string } }) => {
          console.error('Jitsi error:', error);
          logJitsiEvent('errorOccurred', error);

          // Handle permission/access denied errors
          if (error?.error?.name === 'conference.connectionError.accessDenied' || 
              error?.error?.message?.includes('not allowed') ||
              error?.error?.message?.includes('denied')) {
            toast({
              title: "Ошибка доступа",
              description: "Не удалось подключиться к комнате. Попробуйте обновить страницу или создать новую комнату.",
              variant: "destructive",
            });
          }
        });

        // Extra diagnostics for background disconnects
        apiRef.current.addEventListener('conferenceFailed', (e: unknown) => logJitsiEvent('conferenceFailed', e));
        apiRef.current.addEventListener('connectionInterrupted', (e: unknown) => logJitsiEvent('connectionInterrupted', e));
        apiRef.current.addEventListener('connectionRestored', (e: unknown) => logJitsiEvent('connectionRestored', e));
        apiRef.current.addEventListener('videoConferenceJoined', (e: unknown) => logJitsiEvent('videoConferenceJoined', e));
        apiRef.current.addEventListener('videoConferenceLeft', (e: unknown) => logJitsiEvent('videoConferenceLeft', e));

        // Track connection status
        apiRef.current.addEventListener('videoConferenceJoined', () => {
          console.log('Connected to conference');
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          playConnectedSound();
          toast({
            title: "Подключено",
            description: "Вы успешно подключились к комнате",
          });
        });

        // Handle connection failures - but ignore if tab is just hidden or user ended call
        apiRef.current.addEventListener('videoConferenceLeft', () => {
          // If user initiated leave, don't try to reconnect or show notifications
          if (userInitiatedEndRef.current || hasRedirectedRef.current) {
            console.log('User initiated leave - no reconnection needed');
            return;
          }

          // If the page became hidden (app switch / background), we can't reliably keep WebRTC alive.
          // Mark a pending reconnect and rejoin immediately once the user returns.
          if (document.hidden) {
            console.log('Conference left while hidden - will rejoin on focus/visibility');
            pendingReconnectRef.current = true;
            setConnectionStatus('reconnecting');
            return;
          }

          // Only show disconnection if user didn't initiate leave
          console.log('Disconnected from conference');
          setConnectionStatus('disconnected');
          playDisconnectedSound();
          
          // Attempt to reconnect
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            setConnectionStatus('reconnecting');
            playReconnectingSound();
            toast({
              title: t.meetingRoom.reconnecting || "Переподключение...",
              description: (t.meetingRoom.reconnectingAttempt || "Попытка {attempt} из {max}")
                .replace('{attempt}', String(reconnectAttemptsRef.current))
                .replace('{max}', String(maxReconnectAttempts)),
            });
            
            // Dispose current API and reinitialize
            setTimeout(() => {
              if (apiRef.current && !hasRedirectedRef.current && !userInitiatedEndRef.current) {
                logDiagnostic('jitsi-api-disposing', { reason: 'auto-reconnect' });
                apiRef.current.dispose();
                apiRef.current = null;
                initJitsi();
              }
            }, 2000);
          } else {
            toast({
              title: t.meetingRoom.disconnected || "Соединение потеряно",
              description: t.meetingRoom.reconnect ? `${t.meetingRoom.reconnect}` : "Нажмите кнопку переподключения или обновите страницу",
              variant: "destructive",
            });
          }
        });

        // Track participants
        participantsRef.current.add(userName || 'Unknown');
        
        apiRef.current.addEventListener('participantJoined', (participant: { displayName: string }) => {
          console.log('Participant joined:', participant);
          if (participant.displayName) {
            participantsRef.current.add(participant.displayName);
            
            // Send push notification when someone joins
            sendNotification(`${participant.displayName} присоединился`, {
              body: `К комнате "${roomDisplayName}"`,
              tag: 'participant-joined',
            });
            
            toast({
              title: `${participant.displayName} присоединился`,
              description: 'Новый участник в комнате',
            });
          }
        });

        // Track connection quality - best effort
        const updateConnectionQuality = () => {
          if (!apiRef.current) return;
          try {
            const participants = apiRef.current.getParticipantsInfo();
            const localParticipant = participants?.find((p: any) => p.local);

            if (localParticipant) {
              const audioLevel = localParticipant.audioLevel || 0;
              const hasVideo = !localParticipant.videoMuted;
              const hasAudio = !localParticipant.audioMuted;

              let quality = 100;
              if (!hasAudio && !hasVideo) quality -= 30;
              if (audioLevel < 0.01 && hasAudio) quality -= 20;

              setConnectionQuality(quality);
            }
          } catch (e) {
            // ignore
          }
        };

        // Update quality every 5 seconds
        if (qualityInterval) {
          clearInterval(qualityInterval);
        }
        qualityInterval = setInterval(updateConnectionQuality, 5000);
        updateConnectionQuality();

        // Listen for transcription messages
        apiRef.current.addEventListener('transcriptionChunkReceived', (data: { text: string; participant: { name: string } }) => {
          console.log('Transcription:', data);
          if (data.text) {
            transcriptRef.current.push(`${data.participant?.name || 'Unknown'}: ${data.text}`);
          }
        });

        // Also try endpoint messages for transcription
        apiRef.current.addEventListener('endpointTextMessageReceived', (data: { text: string; participant: { displayName: string } }) => {
          console.log('Endpoint message:', data);
          if (data.text) {
            transcriptRef.current.push(`${data.participant?.displayName || 'Unknown'}: ${data.text}`);
          }
        });

        // Capture chat messages as part of transcript and send notification
        // Also handle translation broadcasts from other participants
        apiRef.current.addEventListener('incomingMessage', (data: { from: string; message: string }) => {
          console.log('Chat message:', data);
          if (!data.message) return;
          
          // Check if this is a translation broadcast
          try {
            if (data.message.startsWith('{') && data.message.includes('translation_audio')) {
              const payload = JSON.parse(data.message);
              if (payload.type === 'translation_audio' && payload.audioBase64) {
                console.log('Received translation broadcast from:', data.from);
                
                // Play the translated audio for this participant
                const audioUrl = `data:audio/mpeg;base64,${payload.audioBase64}`;
                
                // Helper function to play audio
                const tryPlayAudio = async () => {
                  const audio = new Audio(audioUrl);
                  audio.volume = 0.9;
                  
                  try {
                    await audio.play();
                    // Mark as unlocked for future plays
                    translationAudioUnlockedRef.current = true;
                  } catch (e) {
                    console.log("Could not autoplay translation:", e);
                    
                    // iOS Safari блокирует autoplay — показываем toast с кнопкой
                    if (!translationAudioUnlockedRef.current) {
                      toast({
                        title: "Включите звук перевода",
                        description: "Нажмите кнопку, чтобы разрешить воспроизведение перевода на этом устройстве.",
                        duration: 15000,
                        action: (
                          <ToastAction
                            altText="Включить звук"
                            onClick={async () => {
                              try {
                                // Разблокируем аудио с помощью user gesture
                                const silentAudio = new Audio(
                                  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
                                );
                                await silentAudio.play();
                                silentAudio.pause();
                                
                                // Теперь пробуем воспроизвести перевод
                                const retryAudio = new Audio(audioUrl);
                                retryAudio.volume = 0.9;
                                await retryAudio.play();
                                
                                translationAudioUnlockedRef.current = true;
                                toast({
                                  title: "Звук включён",
                                  description: "Переводы теперь будут воспроизводиться автоматически.",
                                });
                              } catch (err) {
                                console.log("Audio unlock failed:", err);
                                toast({
                                  title: "Ошибка",
                                  description: "Не удалось включить звук. Попробуйте ещё раз.",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            Включить звук
                          </ToastAction>
                        ),
                      });
                    }
                  }
                };
                
                tryPlayAudio();

                // Show notification about incoming translation
                toast({
                  title: `Перевод от ${data.from}`,
                  description: payload.text?.substring(0, 80) || "Аудио-перевод",
                });
                return; // Don't add to transcript as regular chat
              }
            }
          } catch {
            // Not a translation payload, treat as regular chat
          }
          
          transcriptRef.current.push(`[Чат] ${data.from || 'Unknown'}: ${data.message}`);
          
          // Send push notification for new chat message
          sendNotification(`Сообщение от ${data.from || 'Участник'}`, {
            body: data.message.length > 50 ? data.message.substring(0, 50) + '...' : data.message,
            tag: 'chat-message',
          });
        });

        // Capture subtitles/closed captions
        apiRef.current.addEventListener('subtitlesReceived', (data: { text: string; participant: { name: string } }) => {
          console.log('Subtitles:', data);
          if (data.text) {
            transcriptRef.current.push(`${data.participant?.name || 'Unknown'}: ${data.text}`);
          }
        });

        // Handle hangup button click - user initiated end
        apiRef.current.addEventListener("readyToClose", () => {
          userInitiatedEndRef.current = true;
          handleUserEndCall();
        });

        // Inject custom CSS if same-origin (8x8 iframe is cross-origin, so this is best-effort)
        const injectCustomStyles = () => {
          try {
            const iframe = containerRef.current?.querySelector('iframe');
            const doc = iframe?.contentDocument;
            if (!iframe || !doc) return;

            const style = doc.createElement('style');
            style.textContent = `
              .new-toolbox {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), rgba(10, 10, 10, 0.8)) !important;
                border-top: 1px solid rgba(139, 92, 246, 0.2) !important;
              }
              .toolbox-background {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), transparent) !important;
              }
            `;
            doc.head.appendChild(style);
          } catch {
            // Cross-origin access will throw; ignore.
          }
        };

        setTimeout(injectCustomStyles, 2000);
        setTimeout(injectCustomStyles, 4000);

      } catch (error) {
        console.error("Failed to initialize Jitsi:", error);
        toast({
          title: "Ошибка подключения",
          description: "Не удалось подключиться к комнате. Попробуйте обновить страницу.",
          variant: "destructive",
        });
      }
    };

    initJitsiRef.current = initJitsi;
    jitsiInitializedRef.current = true;
    initJitsi();

    return () => {
      if (qualityInterval) {
        clearInterval(qualityInterval);
      }
      if (apiRef.current) {
        logDiagnostic('jitsi-api-disposing', { reason: 'cleanup' });
        apiRef.current.dispose();
        apiRef.current = null;
      }
      jitsiInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userName]);

  // Don't render if no username - redirecting
  if (!userName) {
    return null;
  }

  // Get connection quality icon and color
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

  const qualityIndicator = getQualityIndicator();
  const QualityIcon = qualityIndicator.icon;

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden cursor-none relative">
      <CustomCursor />

      {/* Recording Indicator - Fixed top-left */}
      {isRecording && (
        <div className="fixed top-20 left-4 z-[100] flex items-center gap-2 bg-destructive/90 backdrop-blur-sm text-destructive-foreground px-3 py-1.5 rounded-full shadow-lg animate-fade-in">
          <span className="relative w-3 h-3">
            <span className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
            <span className="absolute inset-0 bg-white rounded-full" />
          </span>
          <span className="text-xs font-bold tracking-wide">REC</span>
          <span className="text-xs font-mono font-bold">{formatRecordingTime(recordingDuration)}</span>
        </div>
      )}

      {/* Meeting End Save Dialog with status + retry */}
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
      
      {/* Realtime Translator */}
      <RealtimeTranslator
        isActive={showTranslator}
        onToggle={() => setShowTranslator(false)}
        roomId={roomSlug}
        jitsiApi={apiRef.current}
        onTranslatedAudio={(audioUrl) => {
          // In broadcast mode, the translator plays audio loudly
          // so the microphone can pick it up for the partner to hear
          console.log('Broadcast translation audio ready');
        }}
      />
      
      {/* IP Panel for admins */}
      {isAdmin && (
        <ParticipantsIPPanel
          roomId={roomSlug}
          isOpen={showIPPanel}
          onClose={() => setShowIPPanel(false)}
        />
      )}
      {/* Header - auto-hides */}
      <header 
        className="flex flex-col px-3 sm:px-4 py-2 sm:py-3 bg-card/90 backdrop-blur-xl border-b border-border/50 z-50 absolute top-0 left-0 right-0 gap-3"
      >
        {/* Top row: Logo and room name */}
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <div className="relative w-10 h-10 sm:w-12 sm:h-12">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                <video 
                  src={apolloLogo} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  preload="auto"
                  poster=""
                  className="absolute inset-0 w-full h-full object-cover scale-[1.3] origin-center"
                  style={{ willChange: 'transform' }}
                />
              </div>
            </div>
            <span className="font-semibold text-sm sm:text-base">APLink</span>
          </button>
          
          <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/30">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate max-w-[100px] sm:max-w-[200px]">{roomDisplayName}</span>
          </div>
        </div>
        
        {/* Bottom row: Control buttons with labels - improved mobile layout */}
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap sm:justify-center gap-2 w-full">
            {/* Recording button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  disabled={isTranscribing}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 focus-visible:ring-0 ring-0 transition-all duration-300 ${isRecording ? "scale-105 shadow-lg shadow-destructive/30" : "border-primary/50 hover:bg-primary/10"}`}
                >
                  {isTranscribing ? (
                    <>
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span className="text-[10px] sm:text-xs">...</span>
                    </>
                  ) : isRecording ? (
                    <>
                      <div className="relative animate-fade-in flex items-center gap-1">
                        <span className="relative w-2.5 h-2.5 bg-red-500 rounded-full">
                          <span className="absolute inset-0 w-full h-full bg-red-500 rounded-full animate-ping opacity-75" />
                        </span>
                        <MicOff className="w-5 h-5 animate-pulse" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-bold font-mono animate-fade-in text-red-100">
                        {formatRecordingTime(recordingDuration)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 transition-transform duration-200" />
                      <span className="text-[10px] sm:text-xs font-medium">{t.meetingRoom.record}</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">{isRecording ? t.meetingRoom.stopRecordTooltip : t.meetingRoom.recordTooltip}</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Translator button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowTranslator(!showTranslator)}
                  variant={showTranslator ? "default" : "outline"}
                  size="sm"
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 focus-visible:ring-0 ${showTranslator ? "ring-0" : "border-primary/50 hover:bg-primary/10"}`}
                >
                  <Languages className="w-5 h-5" />
                  <span className="text-[10px] sm:text-xs font-medium">{t.meetingRoom.translate}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
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
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 border-primary/50 hover:bg-primary/10 focus-visible:ring-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="text-[10px] sm:text-xs font-medium text-green-500">{t.meetingRoom.done}</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-5 h-5" />
                      <span className="text-[10px] sm:text-xs font-medium">{t.meetingRoom.link}</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
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
                    className="flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 focus-visible:ring-0 border-primary/50 hover:bg-primary/10"
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-[10px] sm:text-xs font-medium">{t.meetingRoom.ip}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px]">
                  <p className="text-xs">{t.meetingRoom.ipTooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Report/Diagnostics button - for everyone (including admins) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={copyDiagnostics}
                  variant="outline"
                  size="sm"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 focus-visible:ring-0 border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-500"
                >
                  {diagnosticsCopied ? <Check className="w-5 h-5" /> : <Bug className="w-5 h-5" />}
                  <span className="text-[10px] sm:text-xs font-medium">{t.meetingRoom.report}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">{t.meetingRoom.reportTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </div>
      </header>

      {/* Registration hint for non-authenticated users */}
      {showRegistrationHint && !user && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-4 py-3 border border-primary/30 animate-slide-up max-w-sm">
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

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{t.meetingRoom.connectingToRoom || "Подключение к комнате..."}</p>
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      {connectionStatus !== 'connected' && !isLoading && (
        <div className={`absolute top-20 right-4 z-40 flex items-center gap-2 glass rounded-full px-4 py-2 border animate-fade-in ${
          connectionStatus === 'disconnected' ? 'border-red-500/50' : 
          connectionStatus === 'reconnecting' ? 'border-yellow-500/50' : 
          'border-primary/50'
        }`}>
          {connectionStatus === 'disconnected' ? (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">{t.meetingRoom.disconnected || "Отключено"}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 ml-2"
                onClick={() => {
                  reconnectAttemptsRef.current = 0;
                  if (apiRef.current) {
                    logDiagnostic('jitsi-api-disposing', { reason: 'manual-reconnect' });
                    apiRef.current.dispose();
                    apiRef.current = null;
                  }
                  setConnectionStatus('reconnecting');
                  setIsLoading(true);
                  // Will trigger useEffect to reinitialize
                  window.location.reload();
                }}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t.meetingRoom.reconnect || "Переподключить"}
              </Button>
            </>
          ) : connectionStatus === 'reconnecting' ? (
            <>
              <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
              <span className="text-sm font-medium text-yellow-500">{t.meetingRoom.reconnecting || "Переподключение..."}</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">{t.meetingRoom.connecting || "Подключение..."}</span>
            </>
          )}
        </div>
      )}
      
      {/* Connected indicator with quality */}
      {connectionStatus === 'connected' && (
        <div className="absolute top-20 right-4 z-40 flex items-center gap-3 glass rounded-full px-4 py-2 border border-green-500/30">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">{t.meetingRoom.done || "Подключено"}</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-1.5">
            <QualityIcon className={`w-4 h-4 ${qualityIndicator.color}`} />
            <span className={`text-xs ${qualityIndicator.color}`}>{qualityIndicator.label}</span>
          </div>
        </div>
      )}

      {/* Recording Indicator Overlay - left side next to mic button */}
      {(isRecording || isTranscribing) && (
        <div className="absolute top-20 left-4 z-40 flex items-center gap-2 glass rounded-full px-4 py-2 border border-red-500/50 animate-fade-in">
          {isTranscribing ? (
            <>
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-yellow-500">{t.meetingRoom.transcribing}</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">REC</span>
              <span className="text-xs text-muted-foreground">{t.meetingRoom.recording}</span>
            </>
          )}
        </div>
      )}

      {/* Jitsi Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full z-10 relative"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};

export default MeetingRoom;
