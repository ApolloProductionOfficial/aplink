import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Room, RoomEvent, DataPacket_Kind } from "livekit-client";
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
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ParticipantsIPPanel from "@/components/ParticipantsIPPanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";
import { RealtimeTranslator } from "@/components/RealtimeTranslator";
import { useTranslation } from "@/hooks/useTranslation";
import { useLiveKitTranslationBroadcast } from "@/hooks/useLiveKitTranslationBroadcast";
import { MeetingEndSaveDialog, type MeetingSaveStatus } from "@/components/MeetingEndSaveDialog";
import { invokeBackendFunctionKeepalive } from "@/utils/invokeBackendFunctionKeepalive";
import LeaveCallDialog from "@/components/LeaveCallDialog";
import { LiveKitRoom } from "@/components/LiveKitRoom";
import { MinimizedCallWidget } from "@/components/MinimizedCallWidget";
import { cn } from "@/lib/utils";

const MeetingRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get("name");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegistrationHint, setShowRegistrationHint] = useState(false);
  const [participantIP, setParticipantIP] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showIPPanel, setShowIPPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const connectionStatusRef = useRef(connectionStatus);
  
  // Minimized call state
  const [isMinimized, setIsMinimized] = useState(false);
  
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
  const [connectionQuality, setConnectionQuality] = useState<number>(100);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation();
  
  // LiveKit room reference for translator integration
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null);
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
          
          toast({
            title: `🌐 ${message.senderName}`,
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
  }, [liveKitRoom, playTranslatedAudio, toast]);
  
  // Start/stop broadcast when translator is toggled
  useEffect(() => {
    if (showTranslator && liveKitRoom && !isBroadcasting) {
      startBroadcast();
    } else if (!showTranslator && isBroadcasting) {
      stopBroadcast();
    }
  }, [showTranslator, liveKitRoom, isBroadcasting, startBroadcast, stopBroadcast]);
  
  // Callback when LiveKit room is ready
  const handleRoomReady = useCallback((room: Room) => {
    console.log('[MeetingRoom] LiveKit room ready');
    setLiveKitRoom(room);
  }, []);

  // Prevent crashes on invalid / missing URL param
  if (!roomId) return null;

  const roomDisplayName = decodeURIComponent(roomId ?? '').replace(/-/g, ' ') || 'Meeting';
  const roomSlug = roomId ?? '';
  const safeUserName = userName ?? user?.email?.split('@')[0] ?? 'Guest';

  // Track presence in this room
  usePresence(roomDisplayName);

  // Block navigation when in a call
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const isInActiveCall = connectionStatus === 'connected' && !userInitiatedEndRef.current && !hasRedirectedRef.current;
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

  // Check if user is admin and fetch IP
  useEffect(() => {
    const checkAdminAndFetchIP = async () => {
      if (user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (roleData?.role === 'admin') {
          setIsAdmin(true);
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
    
    toast({
      title: '🎬 Сохранение записи...',
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
        duration: 30000,
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
        hasStartedRecordingRef.current = true;
        await startRecording();
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

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Build meeting save payload
  const buildMeetingSaveBasePayload = async (): Promise<PendingMeetingSaveBase | null> => {
    if (!hasStartedRecordingRef.current) return null;

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
    // Open apolloproduction.studio in new tab, return to dashboard
    window.open('https://apolloproduction.studio', '_blank');
    navigate(user ? '/dashboard' : '/', { replace: true });
  };

  const exitWithoutSaving = () => {
    clearPendingBaseFromStorage();
    setEndSaveDialogOpen(false);
    // Open apolloproduction.studio in new tab, return to dashboard
    window.open('https://apolloproduction.studio', '_blank');
    navigate(user ? '/dashboard' : '/', { replace: true });
  };

  // LiveKit event handlers
  const handleLiveKitConnected = useCallback(() => {
    console.log('LiveKit connected');
    setIsLoading(false);
    setConnectionStatus('connected');
    playConnectedSound();
    toast({
      title: "Подключено",
      description: "Вы успешно подключились к комнате",
    });
  }, [playConnectedSound, toast]);

  const handleLiveKitDisconnected = useCallback(() => {
    if (userInitiatedEndRef.current || hasRedirectedRef.current) {
      console.log('User initiated leave - no reconnection needed');
      return;
    }

    console.log('LiveKit disconnected');
    setConnectionStatus('disconnected');
    playDisconnectedSound();
    
    // Handle end call flow
    if (!hasRedirectedRef.current && hasStartedRecordingRef.current) {
      hasRedirectedRef.current = true;
      setEndSaveDialogOpen(true);
      setEndSaveStatus("saving");
      runMeetingSave();
    } else if (!hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      // Open apolloproduction.studio in new tab, return to dashboard
      window.open('https://apolloproduction.studio', '_blank');
      navigate(user ? '/dashboard' : '/', { replace: true });
    }
  }, [playDisconnectedSound]);

  const handleParticipantJoined = useCallback((identity: string, name: string) => {
    console.log('Participant joined:', identity, name);
    participantsRef.current.add(name || identity);
    
    sendNotification(`${name || identity} присоединился`, {
      body: `К комнате "${roomDisplayName}"`,
      tag: 'participant-joined',
    });
    
    toast({
      title: `${name || identity} присоединился`,
      description: 'Новый участник в комнате',
    });
  }, [sendNotification, roomDisplayName, toast]);

  const handleParticipantLeft = useCallback((identity: string) => {
    console.log('Participant left:', identity);
  }, []);

  const handleLiveKitError = useCallback((error: Error) => {
    console.error('LiveKit error:', error);
    toast({
      title: "Ошибка подключения",
      description: error.message || "Не удалось подключиться к комнате",
      variant: "destructive",
    });
  }, [toast]);

  // Handle manual end call
  const handleEndCall = useCallback(async () => {
    if (hasRedirectedRef.current) return;
    userInitiatedEndRef.current = true;
    hasRedirectedRef.current = true;

    if (!hasStartedRecordingRef.current) {
      // Open apolloproduction.studio in new tab, return to dashboard
      window.open('https://apolloproduction.studio', '_blank');
      navigate(user ? '/dashboard' : '/', { replace: true });
      return;
    }

    setEndSaveDialogOpen(true);
    setEndSaveStatus("saving");
    setEndSaveError(null);

    await runMeetingSave();
  }, []);

  // Handle minimize - navigate to dashboard
  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
    navigate(user ? '/dashboard' : '/');
  }, [navigate, user]);

  // Handle maximize (return from minimized)
  const handleMaximize = useCallback(() => {
    setIsMinimized(false);
    navigate(`/room/${roomId}?name=${encodeURIComponent(safeUserName)}`);
  }, [navigate, roomId, safeUserName]);

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

  // Header buttons for LiveKitRoom - matching soft rounded style
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
    </>
  );

  // If minimized, show the floating widget
  if (isMinimized) {
    return (
      <>
        {/* Minimized widget */}
        <MinimizedCallWidget
          roomName={roomDisplayName}
          onMaximize={handleMaximize}
          onEndCall={handleEndCall}
        />

        {/* Hidden LiveKit room - maintains connection */}
        <div className="fixed inset-0 pointer-events-none opacity-0" aria-hidden="true">
          <LiveKitRoom
            roomName={roomSlug}
            participantName={safeUserName}
            participantIdentity={user?.id}
            onConnected={handleLiveKitConnected}
            onDisconnected={handleLiveKitDisconnected}
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            onError={handleLiveKitError}
            onRoomReady={handleRoomReady}
          />
        </div>

        {/* Dialogs */}
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

        <LeaveCallDialog
          open={showLeaveConfirm}
          onStay={handleStayInCall}
          onLeave={handleLeaveCall}
        />
      </>
    );
  }

  // Connection indicator element to pass to LiveKitRoom - soft rounded style
  const connectionIndicator = connectionStatus === 'connected' ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30">
      <Wifi className="w-3 h-3 text-green-500" />
      <QualityIcon className={`w-3.5 h-3.5 ${qualityIndicator.color}`} />
    </div>
  ) : connectionStatus === 'disconnected' ? (
    <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/30">
      <WifiOff className="w-3 h-3 text-red-500" />
      <span className="text-xs text-red-500">Отключено</span>
    </div>
  ) : connectionStatus === 'reconnecting' ? (
    <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/30">
      <RefreshCw className="w-3 h-3 text-yellow-500 animate-spin" />
      <span className="text-xs text-yellow-500">Переподключение...</span>
    </div>
  ) : null;

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden relative cursor-default">
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

      {/* LiveKit Room Container - Full height */}
      <div className="flex-1 w-full z-10 relative" style={{ minHeight: 0 }}>
        <LiveKitRoom
          roomName={roomSlug}
          participantName={safeUserName}
          participantIdentity={user?.id}
          onConnected={handleLiveKitConnected}
          onDisconnected={handleLiveKitDisconnected}
          onParticipantJoined={handleParticipantJoined}
          onParticipantLeft={handleParticipantLeft}
          onError={handleLiveKitError}
          onRoomReady={handleRoomReady}
          headerButtons={headerButtons}
          roomDisplayName={roomDisplayName}
          onMinimize={handleMinimize}
          connectionIndicator={connectionIndicator}
        />
      </div>
    </div>
  );
};

export default MeetingRoom;
