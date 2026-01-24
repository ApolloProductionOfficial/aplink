import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Room, RoomEvent } from "livekit-client";
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
import ParticipantsIPPanel from "@/components/ParticipantsIPPanel";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";
import { RealtimeTranslator } from "@/components/RealtimeTranslator";
import { CaptionsOverlay } from "@/components/CaptionsOverlay";
import { useTranslation } from "@/hooks/useTranslation";
import { useLiveKitTranslationBroadcast } from "@/hooks/useLiveKitTranslationBroadcast";
import { MeetingEndSaveDialog, type MeetingSaveStatus } from "@/components/MeetingEndSaveDialog";
import { invokeBackendFunctionKeepalive } from "@/utils/invokeBackendFunctionKeepalive";
import LeaveCallDialog from "@/components/LeaveCallDialog";
import CallQualityWidget from "@/components/CallQualityWidget";
import { cn } from "@/lib/utils";
import { useActiveCall } from "@/contexts/ActiveCallContext";

/**
 * MeetingRoom is now a UI wrapper that:
 * 1. Registers the call with ActiveCallContext
 * 2. Provides headerButtons and connectionIndicator via context
 * 3. Renders overlays (translator, captions, IP panel, dialogs)
 * 
 * The actual LiveKitRoom is rendered by GlobalActiveCall
 */
const MeetingRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get("name");
  const [copied, setCopied] = useState(false);
  const [showRegistrationHint, setShowRegistrationHint] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showIPPanel, setShowIPPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const connectionStatusRef = useRef(connectionStatus);
  
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

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
  
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  
  const { playConnectedSound, playDisconnectedSound, playReconnectingSound } = useConnectionSounds();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranslator, setShowTranslator] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<number>(100);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();
  
  // Get room from context
  const { 
    startCall, 
    minimize, 
    liveKitRoom, 
    setHeaderButtons, 
    setConnectionIndicator,
    setEventHandlers,
  } = useActiveCall();
  
  const { 
    isBroadcasting, 
    startBroadcast, 
    stopBroadcast, 
    playTranslatedAudio,
    sendTranslationToParticipants 
  } = useLiveKitTranslationBroadcast(liveKitRoom);
  
  // Handle incoming translation data from other participants
  useEffect(() => {
    if (!liveKitRoom) return;
    
    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));
        
        if (message.type === 'translation_audio' && message.audioBase64) {
          console.log('[MeetingRoom] Received translation from:', message.senderName);
          
          // Play the translated audio
          const audioUrl = `data:audio/mpeg;base64,${message.audioBase64}`;
          playTranslatedAudio(audioUrl);
          
          toast.success(`🌐 ${message.senderName}`, {
            description: message.text?.substring(0, 100) || 'Перевод получен',
            duration: 3000,
          });
        }
      } catch {
        // Not a translation message
      }
    };
    
    liveKitRoom.on(RoomEvent.DataReceived, handleDataReceived);
    
    return () => {
      liveKitRoom.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [liveKitRoom, playTranslatedAudio]);
  
  // Start/stop broadcast when translator is toggled
  useEffect(() => {
    if (showTranslator && liveKitRoom && !isBroadcasting) {
      startBroadcast();
    } else if (!showTranslator && isBroadcasting) {
      stopBroadcast();
    }
  }, [showTranslator, liveKitRoom, isBroadcasting, startBroadcast, stopBroadcast]);

  // Prevent crashes on invalid / missing URL param
  if (!roomId) return null;

  const roomDisplayName = decodeURIComponent(roomId ?? '').replace(/-/g, ' ') || 'Meeting';
  const roomSlug = roomId ?? '';
  const safeUserName = userName ?? user?.email?.split('@')[0] ?? 'Guest';

  // Register active call in global context
  useEffect(() => {
    participantsRef.current.add(safeUserName);
    
    startCall({
      roomName: roomDisplayName,
      roomSlug,
      participantName: safeUserName,
      participantIdentity: user?.id,
      roomDisplayName,
    });
  }, [startCall, roomDisplayName, roomSlug, safeUserName, user?.id]);

  // Register event handlers with context
  useEffect(() => {
    setEventHandlers({
      onConnected: () => {
        console.log('[MeetingRoom] onConnected via context');
        setConnectionStatus('connected');
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
        console.error('[MeetingRoom] Error via context:', error);
      },
    });
  }, [setEventHandlers, roomDisplayName, sendNotification]);

  // Track presence in this room
  usePresence(roomDisplayName);

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
      navigate(user ? '/dashboard' : '/', { replace: true });
    }
  }, [user, navigate]);

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

  const handleStayInCall = () => {
    setShowLeaveConfirm(false);
  };

  const handleLeaveCall = () => {
    setShowLeaveConfirm(false);
    userInitiatedEndRef.current = true;
    navigate(-1);
  };

  // Check if user is admin
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
        }
      }
    };
    
    checkAdmin();
  }, [user]);

  // Save recovered recording to personal cabinet
  const saveRecoveredToProfile = async (audioBlob: Blob) => {
    if (!user) return;
    
    toast.loading('🎬 Сохранение записи...', {
      description: 'Транскрипция и сохранение в личный кабинет...',
      duration: 60000,
    });

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

      toast.success('✅ Запись сохранена!', {
        description: 'Конспект доступен в разделе "Созвоны" вашего личного кабинета.',
        duration: 5000,
      });
      
      clearRecoveredRecording();
    } catch (e) {
      console.error('Failed to save recovered recording:', e);
      toast.error('Ошибка сохранения', {
        description: 'Не удалось сохранить запись. Попробуйте ещё раз.',
      });
    }
  };

  // Check for recovered recording from crash
  useEffect(() => {
    const recovered = getRecoveredRecording();
    if (recovered && user) {
      toast.info('📼 Найдена незавершённая запись', {
        description: 'Запись предыдущего созвона была восстановлена после сбоя.',
        duration: 30000,
        action: {
          label: '💾 Сохранить',
          onClick: () => saveRecoveredToProfile(recovered),
        },
        cancel: {
          label: '🗑️ Удалить',
          onClick: () => {
            clearRecoveredRecording();
            toast.success('Запись удалена');
          },
        },
      });
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
    
    return () => {
      supabase.functions.invoke('track-participant', {
        body: { roomId: roomSlug, userName, action: 'leave', userId: user?.id || null }
      }).catch(console.error);
    };
  }, [userName, roomSlug, user?.id]);

  // Redirect to home page if no name provided
  useEffect(() => {
    if (!userName) {
      navigate(`/?room=${encodeURIComponent(roomSlug)}`);
    }
  }, [userName, roomSlug, navigate]);

  const roomLink = `${window.location.origin}/room/${roomSlug}`;

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

  // For authenticated users - save in background without dialog
  const runMeetingSaveBackground = async () => {
    if (!hasStartedRecordingRef.current || !user) return;

    const base = await buildMeetingSaveBasePayload();
    if (!base) return;

    try {
      const response = await invokeBackendFunctionKeepalive<{ success: boolean; meeting?: { id: string } }>(
        "summarize-meeting",
        { ...base, userId: user.id },
      );

      if (response?.success && response?.meeting?.id) {
        console.log("Meeting saved in background with ID:", response.meeting.id);
        clearPendingBaseFromStorage();
      } else {
        console.error("Background save failed - server did not confirm");
      }
    } catch (e: any) {
      console.error("Background meeting save error:", e);
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
    navigate(user ? '/dashboard' : '/', { replace: true });
  };

  const exitWithoutSaving = () => {
    clearPendingBaseFromStorage();
    setEndSaveDialogOpen(false);
    window.open('https://apolloproduction.studio', '_blank');
    navigate(user ? '/dashboard' : '/', { replace: true });
  };

  // Handle minimize - go to home page
  const handleMinimize = useCallback(() => {
    minimize();
    navigate('/', { replace: true });
  }, [minimize, navigate]);

  // Don't render if no username - redirecting
  if (!userName) {
    return null;
  }

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
  const headerButtons = (
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
      
      {/* Call Quality Widget */}
      {liveKitRoom && (
        <CallQualityWidget room={liveKitRoom} />
      )}
    </>
  );

  // Connection indicator element
  const connectionIndicator = connectionStatus === 'connected' ? (
    <div className="flex items-center gap-1.5">
      <span 
        className={cn(
          "w-2 h-2 rounded-full transition-colors duration-700",
          connectionQuality >= 80 && "bg-green-500 animate-pulse",
          connectionQuality >= 50 && connectionQuality < 80 && "bg-yellow-500 animate-pulse",
          connectionQuality >= 20 && connectionQuality < 50 && "bg-orange-500 animate-pulse",
          connectionQuality < 20 && "bg-red-500 animate-pulse"
        )}
        style={{ animationDuration: '2s' }}
      />
    </div>
  ) : connectionStatus === 'disconnected' ? (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500/15 via-red-400/10 to-transparent border border-red-500/25 backdrop-blur-sm">
      <WifiOff className="w-3.5 h-3.5 text-red-400" />
      <span className="text-xs text-red-400">Отключено</span>
    </div>
  ) : connectionStatus === 'reconnecting' ? (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-500/15 via-yellow-400/10 to-transparent border border-yellow-500/25 backdrop-blur-sm">
      <RefreshCw className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
      <span className="text-xs text-yellow-400">Переподключение...</span>
    </div>
  ) : null;

  // Update context with header buttons and connection indicator
  useEffect(() => {
    setHeaderButtons(headerButtons);
    setConnectionIndicator(connectionIndicator);
  }, [isRecording, recordingDuration, isTranscribing, showCaptions, showTranslator, copied, showIPPanel, isAdmin, connectionStatus, connectionQuality, liveKitRoom]);

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
      
      {/* Realtime Translator - integrated with LiveKit */}
      <RealtimeTranslator
        isActive={showTranslator}
        onToggle={() => setShowTranslator(false)}
        roomId={roomSlug}
        jitsiApi={null}
        liveKitRoom={liveKitRoom}
        onTranslatedAudio={(audioUrl) => {
          console.log('[MeetingRoom] Translation audio ready for broadcast');
        }}
        onSendTranslation={sendTranslationToParticipants}
      />
      
      {/* IP Panel for admins */}
      {isAdmin && (
        <ParticipantsIPPanel
          roomId={roomSlug}
          isOpen={showIPPanel}
          onClose={() => setShowIPPanel(false)}
        />
      )}
      
      {/* Real-time Captions Overlay */}
      <CaptionsOverlay
        room={liveKitRoom}
        participantName={safeUserName}
        isEnabled={showCaptions}
        onToggle={() => setShowCaptions(false)}
      />

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
    </>
  );
};

export default MeetingRoom;
