import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Users, User, Sparkles, Mic, MicOff, Wifi, WifiOff, RefreshCw, Globe, Languages, Signal, SignalLow, SignalMedium, SignalHigh, Bug, ClipboardCopy, Link2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import apolloLogo from "@/assets/apollo-logo.mp4";
import CustomCursor from "@/components/CustomCursor";

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
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { sendNotification } = usePushNotifications();
  const { isRecording, startRecording, stopRecording, getAudioBlob } = useAudioRecorder();
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

  // Helper to log diagnostic events (capped at 100 entries)
  const logDiagnostic = (event: string, data?: unknown) => {
    const entry = {
      ts: new Date().toISOString(),
      event,
      data,
    };
    diagnosticsLogRef.current = [...diagnosticsLogRef.current.slice(-99), entry];
    console.log(`[DIAG:${event}]`, data ?? '');
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
  }, []);

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
      toast({ title: "Отчёт скопирован", description: "Отправьте его разработчику" });
      setTimeout(() => setDiagnosticsCopied(false), 2000);
    } catch {
      toast({ title: "Ошибка", description: "Не удалось скопировать", variant: "destructive" });
    }
  };

  // Use room ID as-is for Jitsi (consistent room name)
  // Display with proper formatting (dashes to spaces)
  const roomDisplayName = decodeURIComponent(roomId || '').replace(/-/g, ' ');
  const roomSlug = roomId || '';
  
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
        title: "Ссылка скопирована!",
        description: "Отправьте её участникам для подключения",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
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
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 0) {
        toast({
          title: "Запись остановлена",
          description: "Транскрибируем созвон...",
        });
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript) {
            transcriptRef.current.push(`[Транскрипция созвона]: ${transcript}`);
            toast({
              title: "Транскрипция готова",
              description: transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript,
            });
          }
        } catch (error) {
          toast({
            title: "Ошибка транскрипции",
            description: "Не удалось транскрибировать аудио",
            variant: "destructive",
          });
        }
      }
    } else {
      try {
        hasStartedRecordingRef.current = true; // Mark that recording was started
        await startRecording();
        toast({
          title: "Запись начата",
          description: "Записываем звук созвона",
        });
      } catch (error) {
        hasStartedRecordingRef.current = false;
        toast({
          title: "Ошибка",
          description: "Не удалось начать запись",
          variant: "destructive",
        });
      }
    }
  };

  // Save meeting transcript and summary - always stop recording if active
  const saveMeetingTranscript = async () => {
    // If recording was started, try to get audio even if the recorder already stopped (e.g., hangup ends tracks)
    let audioBlob: Blob | null = null;

    if (isRecordingRef.current) {
      console.log('Recording is active, stopping and transcribing...');
      audioBlob = await stopRecording();
    } else if (hasStartedRecordingRef.current) {
      audioBlob = getAudioBlob();
    }

    if (audioBlob && audioBlob.size > 0) {
      toast({
        title: 'Запись обрабатывается',
        description: 'Транскрибируем созвон...',
      });

      try {
        const transcript = await transcribeAudio(audioBlob);
        if (transcript) {
          transcriptRef.current.push(`[Транскрипция] ${userName}: ${transcript}`);
        }
      } catch (error) {
        console.error('Final transcription failed:', error);
        toast({
          title: 'Ошибка транскрипции',
          description: 'Не удалось транскрибировать аудио',
          variant: 'destructive',
        });
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

    // Only save if there's actual transcript content
    if (transcriptRef.current.length === 0) {
      console.log('No transcript content, skipping save');
      return;
    }

    const transcriptText = transcriptRef.current.join('\n');

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
      toast({
        title: 'Встреча сохранена',
        description: 'Конспект доступен в личном кабинете',
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

  // Handle user-initiated call end - redirect only once
  const handleUserEndCall = async () => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    userInitiatedEndRef.current = true;
    
    await saveMeetingTranscript();
    
    // Open apolloproduction.studio in new tab
    window.open('https://apolloproduction.studio', '_blank');
    
    // Navigate to dashboard
    navigate(user ? '/dashboard' : '/');
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

        const resumeIfSuspended = () => {
          if (audioContextKeepAlive?.state === 'suspended') {
            audioContextKeepAlive.resume().catch(() => {});
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

        // Handle connection failures - but ignore if tab is just hidden
        apiRef.current.addEventListener('videoConferenceLeft', () => {
        // If the page became hidden (app switch / background), we can't reliably keep WebRTC alive.
        // Mark a pending reconnect and rejoin immediately once the user returns.
        if (document.hidden) {
          console.log('Conference left while hidden - will rejoin on focus/visibility');
          pendingReconnectRef.current = true;
          setConnectionStatus('reconnecting');
          return;
        }

          // Only show disconnection if user didn't initiate leave
          if (!userInitiatedEndRef.current && !hasRedirectedRef.current) {
            console.log('Disconnected from conference');
            setConnectionStatus('disconnected');
            playDisconnectedSound();
            
            // Attempt to reconnect
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              setConnectionStatus('reconnecting');
              playReconnectingSound();
              toast({
                title: "Переподключение...",
                description: `Попытка ${reconnectAttemptsRef.current} из ${maxReconnectAttempts}`,
              });
              
              // Dispose current API and reinitialize
              setTimeout(() => {
                if (apiRef.current && !hasRedirectedRef.current) {
                  logDiagnostic('jitsi-api-disposing', { reason: 'auto-reconnect' });
                  apiRef.current.dispose();
                  apiRef.current = null;
                  initJitsi();
                }
              }, 2000);
            } else {
              toast({
                title: "Соединение потеряно",
                description: "Нажмите кнопку переподключения или обновите страницу",
                variant: "destructive",
              });
            }
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

        // Capture chat messages as part of transcript
        apiRef.current.addEventListener('incomingMessage', (data: { from: string; message: string }) => {
          console.log('Chat message:', data);
          if (data.message) {
            transcriptRef.current.push(`[Чат] ${data.from || 'Unknown'}: ${data.message}`);
          }
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
      
      {/* Realtime Translator */}
      <RealtimeTranslator
        isActive={showTranslator}
        onToggle={() => setShowTranslator(false)}
        roomId={roomSlug}
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
                  preload="metadata"
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
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-4 sm:flex sm:flex-wrap sm:justify-center gap-2 w-full">
            {/* Recording button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  disabled={isTranscribing}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 ${isRecording ? "animate-pulse" : "border-primary/50 hover:bg-primary/10"}`}
                >
                  {isTranscribing ? (
                    <>
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span className="text-[10px] sm:text-xs">...</span>
                    </>
                  ) : isRecording ? (
                    <>
                      <div className="relative">
                        <MicOff className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      </div>
                      <span className="text-[10px] sm:text-xs font-medium">Стоп</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span className="text-[10px] sm:text-xs font-medium">Запись</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">{isRecording ? "Остановить запись и сохранить транскрипцию" : "Начать запись звонка с AI-транскрипцией"}</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Translator button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowTranslator(!showTranslator)}
                  variant={showTranslator ? "default" : "outline"}
                  size="sm"
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 ${showTranslator ? "ring-2 ring-primary/50" : "border-primary/50 hover:bg-primary/10"}`}
                >
                  <Languages className="w-5 h-5" />
                  <span className="text-[10px] sm:text-xs font-medium">Перевод</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">Переводчик в реальном времени на 100+ языков</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Copy link button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={copyLink}
                  variant="outline"
                  size="sm"
                  className="flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 border-primary/50 hover:bg-primary/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="text-[10px] sm:text-xs font-medium text-green-500">Готово</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-5 h-5" />
                      <span className="text-[10px] sm:text-xs font-medium">Ссылка</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">Скопировать ссылку для приглашения участников</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Diagnostics / Admin button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={isAdmin ? () => setShowIPPanel(!showIPPanel) : copyDiagnostics}
                  variant={showIPPanel && isAdmin ? "default" : "outline"}
                  size="sm"
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 h-auto py-2 px-2 sm:px-3 ${isAdmin ? (showIPPanel ? "" : "border-primary/50 hover:bg-primary/10") : "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-500"}`}
                >
                  {isAdmin ? (
                    <>
                      <Globe className="w-5 h-5" />
                      <span className="text-[10px] sm:text-xs font-medium">IP</span>
                    </>
                  ) : (
                    <>
                      {diagnosticsCopied ? <Check className="w-5 h-5" /> : <Bug className="w-5 h-5" />}
                      <span className="text-[10px] sm:text-xs font-medium">Отчёт</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="text-xs">{isAdmin ? "Показать IP-адреса участников" : "Скопировать диагностику для поддержки"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </header>

      {/* Registration hint for non-authenticated users */}
      {showRegistrationHint && !user && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-4 py-3 border border-primary/30 animate-slide-up max-w-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Записывайте созвоны!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Зарегистрируйтесь, чтобы получать AI-конспект после каждого звонка
              </p>
              <Button
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => {
                  setShowRegistrationHint(false);
                  window.open('/auth', '_blank');
                }}
              >
                Регистрация
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
            <p className="text-muted-foreground">Подключение к комнате...</p>
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
              <span className="text-sm font-medium text-red-500">Отключено</span>
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
                Переподключить
              </Button>
            </>
          ) : connectionStatus === 'reconnecting' ? (
            <>
              <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
              <span className="text-sm font-medium text-yellow-500">Переподключение...</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">Подключение...</span>
            </>
          )}
        </div>
      )}
      
      {/* Connected indicator with quality */}
      {connectionStatus === 'connected' && (
        <div className="absolute top-20 right-4 z-40 flex items-center gap-3 glass rounded-full px-4 py-2 border border-green-500/30">
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-500">Подключено</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-1.5">
            <QualityIcon className={`w-4 h-4 ${qualityIndicator.color}`} />
            <span className={`text-xs ${qualityIndicator.color}`}>{qualityIndicator.label}</span>
          </div>
        </div>
      )}

      {/* Recording Indicator Overlay */}
      {(isRecording || isTranscribing) && (
        <div className="absolute top-20 left-4 z-40 flex items-center gap-2 glass rounded-full px-4 py-2 border border-red-500/50 animate-fade-in">
          {isTranscribing ? (
            <>
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm font-medium text-yellow-500">Транскрибируем...</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-500">REC</span>
              <span className="text-xs text-muted-foreground">Идёт запись созвона</span>
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
