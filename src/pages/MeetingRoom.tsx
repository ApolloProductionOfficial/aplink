import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Users, User, Sparkles, Mic, MicOff, Wifi, WifiOff, RefreshCw, Globe } from "lucide-react";
import ParticipantsIPPanel from "@/components/ParticipantsIPPanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/hooks/usePresence";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import logoVideo from "@/assets/logo-video.mov";
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
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegistrationHint, setShowRegistrationHint] = useState(false);
  const [participantIP, setParticipantIP] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showIPPanel, setShowIPPanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
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
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);

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
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-transcribe`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }
      
      const data = await response.json();
      console.log('Transcription result:', data.text?.substring(0, 100));
      return data.text || '';
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

  // Save meeting transcript and summary - only if recording was started
  const saveMeetingTranscript = async () => {
    // Only save if user started recording
    if (!hasStartedRecordingRef.current) {
      console.log('Recording was not started, skipping transcript save');
      return;
    }
    
    // Stop recording if active
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 0) {
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (transcript) {
            transcriptRef.current.push(`[Транскрипция] ${userName}: ${transcript}`);
          }
        } catch (error) {
          console.error('Final transcription failed:', error);
        }
      }
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
          userId: user.id
        }
      });
      
      if (error) throw error;
      
      console.log('Meeting saved:', data);
    } catch (error) {
      console.error('Failed to save meeting:', error);
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

  useEffect(() => {
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
            enableInsecureRoomNameWarning: false,
            defaultLanguage: "ru",
            // Enable transcription
            transcription: {
              enabled: true,
              autoTranscribeOnRecord: true,
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

        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
        setIsLoading(false);

        // Track connection status
        apiRef.current.addEventListener('videoConferenceJoined', () => {
          console.log('Connected to conference');
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          toast({
            title: "Подключено",
            description: "Вы успешно подключились к комнате",
          });
        });

        // Handle connection failures
        apiRef.current.addEventListener('videoConferenceLeft', () => {
          // Only show disconnection if user didn't initiate leave
          if (!userInitiatedEndRef.current && !hasRedirectedRef.current) {
            console.log('Disconnected from conference');
            setConnectionStatus('disconnected');
            
            // Attempt to reconnect
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current++;
              setConnectionStatus('reconnecting');
              toast({
                title: "Переподключение...",
                description: `Попытка ${reconnectAttemptsRef.current} из ${maxReconnectAttempts}`,
              });
              
              // Dispose current API and reinitialize
              setTimeout(() => {
                if (apiRef.current && !hasRedirectedRef.current) {
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

        // Inject custom CSS to style the toolbar to match site theme
        const injectCustomStyles = () => {
          const iframe = containerRef.current?.querySelector('iframe');
          if (iframe && iframe.contentDocument) {
            const style = iframe.contentDocument.createElement('style');
            style.textContent = `
              .new-toolbox {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), rgba(10, 10, 10, 0.8)) !important;
                border-top: 1px solid rgba(139, 92, 246, 0.2) !important;
              }
              .toolbox-background {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), transparent) !important;
              }
            `;
            iframe.contentDocument.head.appendChild(style);
          }
        };
        
        // Try to inject styles after iframe loads
        setTimeout(injectCustomStyles, 2000);
        setTimeout(injectCustomStyles, 4000);

        // Handle hangup button click - user initiated end
        apiRef.current.addEventListener("readyToClose", () => {
          userInitiatedEndRef.current = true;
          handleUserEndCall();
        });
        
        // Don't auto-redirect on videoConferenceLeft - this fires when switching tabs

      } catch (error) {
        console.error("Failed to initialize Jitsi:", error);
        toast({
          title: "Ошибка подключения",
          description: "Не удалось подключиться к комнате. Попробуйте обновить страницу.",
          variant: "destructive",
        });
      }
    };

    initJitsi();

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomId, userName, toast, user]);

  // Don't render if no username - redirecting
  if (!userName) {
    return null;
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden cursor-none">
      <CustomCursor />
      
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
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 sm:py-3 bg-card/80 backdrop-blur-xl border-b border-border/50 z-50 absolute top-0 left-0 right-0 gap-2"
      >
        {/* Mobile: Buttons on top */}
        <div className="flex sm:hidden w-full justify-center gap-2">
          {/* Mobile recording button */}
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            disabled={isTranscribing}
            className={isRecording ? "" : "border-primary/50 hover:bg-primary/10"}
          >
            {isTranscribing ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Button
            onClick={copyLink}
            variant="outline"
            size="sm"
            className="border-primary/50 hover:bg-primary/10 flex-1"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Ссылка
              </>
            )}
          </Button>
          {isAdmin && (
            <Button
              onClick={() => setShowIPPanel(!showIPPanel)}
              variant="outline"
              size="sm"
              className="border-primary/50 hover:bg-primary/10"
            >
              <Globe className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <video 
              src={logoVideo} 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-8 h-8 object-cover rounded-full"
            />
            <span className="hidden sm:inline font-semibold">APLink</span>
          </button>
          <div className="h-6 w-px bg-border/50 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate max-w-[120px] sm:max-w-[200px]">{roomDisplayName}</span>
          </div>
        </div>
        
        {/* Desktop: Buttons on right */}
        <div className="hidden sm:flex gap-2">
          {/* Recording button */}
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            disabled={isTranscribing}
            className={isRecording ? "" : "border-primary/50 hover:bg-primary/10"}
          >
            {isTranscribing ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Транскрибируем...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Остановить
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Записать
              </>
            )}
          </Button>
          
          {isAdmin && (
            <Button
              onClick={() => setShowIPPanel(!showIPPanel)}
              variant={showIPPanel ? "default" : "outline"}
              size="sm"
              className={showIPPanel ? "" : "border-primary/50 hover:bg-primary/10"}
            >
              <Globe className="w-4 h-4 mr-2" />
              IP Участников
            </Button>
          )}
          <Button
            onClick={copyLink}
            variant="outline"
            size="sm"
            className="border-primary/50 hover:bg-primary/10"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Скопировать ссылку
              </>
            )}
          </Button>
        </div>
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
      
      {/* Connected indicator (brief) */}
      {connectionStatus === 'connected' && (
        <div className="absolute top-20 right-4 z-40 flex items-center gap-2 glass rounded-full px-3 py-1 border border-green-500/30">
          <Wifi className="w-3 h-3 text-green-500" />
          <span className="text-xs text-green-500">Подключено</span>
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
        className="flex-1 w-full"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};

export default MeetingRoom;
