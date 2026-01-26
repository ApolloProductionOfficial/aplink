import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  LiveKitRoom as LKRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  useParticipants,
  GridLayout,
  ParticipantTile,
  LayoutContextProvider,
  useLocalParticipant,
  VideoTrack,
  DisconnectButton,
  useStartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, Room, RemoteParticipant, VideoPresets, LocalParticipant } from "livekit-client";
import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  VideoOff, 
  Video, 
  Mic, 
  MicOff,
  MonitorUp, 
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Hand,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Pencil,
  Mic2,
  Check,
  LayoutGrid,
  MonitorPlay,
  VolumeOff,
  User,
  Keyboard,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InCallChat } from "@/components/InCallChat";
import { VirtualBackgroundSelector } from "@/components/VirtualBackgroundSelector";
import { EmojiReactions } from "@/components/EmojiReactions";
import { CallTimer } from "@/components/CallTimer";
import { useRaiseHand } from "@/hooks/useRaiseHand";
import { useNoiseSuppression } from "@/hooks/useNoiseSuppression";
import { useVoiceNotifications } from "@/hooks/useVoiceNotifications";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { CollaborativeWhiteboard } from "@/components/CollaborativeWhiteboard";
import { DrawingOverlay } from "@/components/DrawingOverlay";
import { AudioProblemDetector } from "@/components/AudioProblemDetector";
import { FocusVideoLayout } from "@/components/FocusVideoLayout";
import { GalleryVideoLayout } from "@/components/GalleryVideoLayout";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "sonner";

interface LiveKitRoomProps {
  roomName: string;
  participantName: string;
  participantIdentity?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onError?: (error: Error) => void;
  /** Callback to get room reference for translator integration */
  onRoomReady?: (room: Room) => void;
  /** Header buttons passed from parent */
  headerButtons?: React.ReactNode;
  /** Room display name for header */
  roomDisplayName?: string;
  /** Callback when user clicks minimize (logo) */
  onMinimize?: () => void;
  /** Connection quality indicator element */
  connectionIndicator?: React.ReactNode;
  /** True when entering from minimized state - disables translate animations */
  isMaximizing?: boolean;
}

export function LiveKitRoom({
  roomName,
  participantName,
  participantIdentity,
  onConnected,
  onDisconnected,
  onParticipantJoined,
  onParticipantLeft,
  onError,
  onRoomReady,
  headerButtons,
  roomDisplayName,
  onMinimize,
  connectionIndicator,
  isMaximizing = false,
}: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent re-fetching token on component updates
  const hasInitializedRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  
  // Stable token ref to prevent re-renders from triggering reconnection
  const tokenRef = useRef<string | null>(null);
  
  // Memoize token to prevent LKRoom from seeing "new" token on re-renders
  const memoizedToken = useMemo(() => tokenRef.current, [tokenRef.current]);

  useEffect(() => {
    // Skip if already initialized OR currently fetching
    if ((hasInitializedRef.current && currentRoomRef.current === roomName && tokenRef.current) || isFetchingRef.current) {
      if (!isFetchingRef.current) {
        console.log("[LiveKitRoom] Already have token for room, skipping re-fetch");
      }
      return;
    }

    const getToken = async () => {
      isFetchingRef.current = true;
      try {
        setLoading(true);
        setError(null);

        console.log("[LiveKitRoom] Requesting token for room:", roomName);

        const { data, error: fnError } = await supabase.functions.invoke(
          "livekit-token",
          {
            body: {
              roomName,
              participantName,
              participantIdentity,
            },
          }
        );

        if (fnError) {
          throw new Error(fnError.message || "Failed to get token");
        }

        if (!data?.token || !data?.url) {
          throw new Error("Invalid token response");
        }

        console.log("[LiveKitRoom] Token received, connecting to:", data.url);
        hasInitializedRef.current = true;
        currentRoomRef.current = roomName;
        // Store in ref BEFORE setState for memoization to work
        tokenRef.current = data.token;
        setToken(data.token);
        setServerUrl(data.url);
      } catch (err) {
        console.error("[LiveKitRoom] Error getting token:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to connect";
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    getToken();
  }, [roomName]); // Only depend on roomName to prevent unnecessary re-fetches

  const handleConnected = useCallback(() => {
    console.log("[LiveKitRoom] Connected to room");
    onConnected?.();
  }, [onConnected]);

  const handleDisconnected = useCallback(() => {
    console.log("[LiveKitRoom] Disconnected from room");
    onDisconnected?.();
  }, [onDisconnected]);

  // Rotating loading phrases
  const [phraseIndex, setPhraseIndex] = useState(0);
  const loadingPhrases = [
    "Инициализация портала связи...",
    "Открываем врата в новое измерение...",
    "Синхронизация квантовых частот...",
    "Настраиваем межпространственную связь...",
    "Готовьтесь к телепортации...",
    "Калибровка голографического канала...",
  ];

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background overflow-hidden">
        {/* Cosmic background effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/15 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/10 rounded-full animate-[spin_20s_linear_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
        </div>
        
        <div className="relative z-10 glass-dark rounded-3xl p-10 flex flex-col items-center gap-6 border border-white/10">
          {/* Animated portal rings */}
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-[ping_2s_ease-out_infinite]" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-[ping_2s_ease-out_infinite_0.5s]" />
            <div className="absolute inset-4 rounded-full border-2 border-primary/50 animate-[ping_2s_ease-out_infinite_1s]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-foreground text-xl font-medium bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent animate-[pulse_3s_ease-in-out_infinite] min-w-[280px] transition-all duration-500">
              {loadingPhrases[phraseIndex]}
            </p>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              Готовьтесь к погружению
              {/* Single neon star */}
              <svg viewBox="0 0 24 24" className="w-6 h-6 animate-pulse animate-[spin_8s_linear_infinite]">
                <defs>
                  <linearGradient id="star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6e4"/>
                    <stop offset="50%" stopColor="#fff"/>
                    <stop offset="100%" stopColor="#06b6e4"/>
                  </linearGradient>
                  <filter id="star-glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <path 
                  d="M12 2L14.5 9.5L22 10L16 15L18 22L12 18L6 22L8 15L2 10L9.5 9.5L12 2Z" 
                  fill="url(#star-gradient)" 
                  filter="url(#star-glow)"
                  className="drop-shadow-[0_0_12px_rgba(6,182,228,0.9)]"
                />
              </svg>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="glass-dark rounded-2xl p-8 flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <VideoOff className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive font-medium text-lg">Ошибка подключения</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!memoizedToken || !serverUrl) {
    return null;
  }

  return (
    <LKRoom
      serverUrl={serverUrl}
      token={memoizedToken}
      connect={true}
      audio={true}
      video={true}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={(err) => {
        console.error("[LiveKitRoom] Room error:", err);
        onError?.(err);
      }}
      options={{
        adaptiveStream: true,
        dynacast: true,
        // Maximum HD video quality: 1080p @ 30fps
        videoCaptureDefaults: {
          resolution: {
            width: 1920,
            height: 1080,
            frameRate: 30,
          },
        },
        // High-quality stereo audio with noise suppression
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2,
        },
        publishDefaults: {
          simulcast: true,
          videoCodec: 'vp9', // Best compression quality
          backupCodec: { codec: 'vp8' }, // Fallback for older browsers
          dtx: true, // Discontinuous transmission - saves bandwidth during silence
          red: true, // Audio redundancy for better reliability
          videoSimulcastLayers: [
            // Use VideoPresets for simulcast layers
            VideoPresets.h360,
            VideoPresets.h540,
            VideoPresets.h1080,
          ],
        },
      }}
      style={{ height: "100%" }}
    >
      <LayoutContextProvider>
        <LiveKitContent
          onParticipantJoined={onParticipantJoined}
          onParticipantLeft={onParticipantLeft}
          onRoomReady={onRoomReady}
          headerButtons={headerButtons}
          roomDisplayName={roomDisplayName}
          onMinimize={onMinimize}
          participantName={participantName}
          connectionIndicator={connectionIndicator}
          isMaximizing={isMaximizing}
        />
      </LayoutContextProvider>
    </LKRoom>
  );
}

interface LiveKitContentProps {
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onRoomReady?: (room: Room) => void;
  headerButtons?: React.ReactNode;
  roomDisplayName?: string;
  onMinimize?: () => void;
  participantName: string;
  connectionIndicator?: React.ReactNode;
  isMaximizing?: boolean;
}

function LiveKitContent({ 
  onParticipantJoined, 
  onParticipantLeft, 
  onRoomReady,
  headerButtons,
  roomDisplayName,
  onMinimize,
  participantName,
  connectionIndicator,
  isMaximizing = false,
}: LiveKitContentProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [newParticipants, setNewParticipants] = useState<Set<string>>(new Set());
  const roomReadyCalledRef = useRef(false);
  
  // Audio playback permission - handles browser autoplay blocking
  const { mergedProps: startAudioProps, canPlayAudio } = useStartAudio({ room, props: {} });
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);
  
  // Show audio prompt when audio is blocked
  useEffect(() => {
    if (canPlayAudio === false) {
      setShowAudioPrompt(true);
      console.log('[LiveKitRoom] Audio blocked by browser, showing prompt');
    } else if (canPlayAudio === true) {
      setShowAudioPrompt(false);
    }
  }, [canPlayAudio]);
  
  // Try to start audio automatically when room connects
  useEffect(() => {
    if (room && canPlayAudio === false) {
      // Attempt to start audio on any user interaction
      const handleInteraction = async () => {
        try {
          await room.startAudio();
          console.log('[LiveKitRoom] Audio started after user interaction');
          setShowAudioPrompt(false);
        } catch (err) {
          console.log('[LiveKitRoom] Could not auto-start audio:', err);
        }
      };
      
      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });
      
      return () => {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
      };
    }
  }, [room, canPlayAudio]);
  
  // Raise hand hook
  const { isHandRaised, raisedHands, toggleHand } = useRaiseHand(room, participantName);
  
  // Noise suppression hook
  const { isEnabled: isNoiseSuppressionEnabled, toggle: toggleNoiseSuppression } = useNoiseSuppression();
  
  // Voice notifications hook
  const { announceHandRaised, announceParticipantJoined, announceParticipantLeft } = useVoiceNotifications();
  
  // Auto-hide panels state
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showDrawingOverlay, setShowDrawingOverlay] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<'none' | 'blur-light' | 'blur-strong' | 'image'>('none');
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false);
  
  // Layout mode: 'focus' (1-on-1) or 'gallery' (grid)
  const [layoutMode, setLayoutMode] = useState<'focus' | 'gallery'>('focus');
  
  // Track speaking participant for indicators
  const [speakingParticipant, setSpeakingParticipant] = useState<string | undefined>(undefined);
  
  // Track if gallery mode was suggested
  const galleryModeSuggestedRef = useRef(false);
  
  // Call recording state (records participants directly without picker dialog)
  const [isCallRecording, setIsCallRecording] = useState(false);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callRecordingChunksRef = useRef<Blob[]>([]);
  const callRecordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const callRecordingAnimationRef = useRef<number | null>(null);
  
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local track states
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false;
  const isMicrophoneEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isScreenShareEnabled = localParticipant?.isScreenShareEnabled ?? false;

  // Check if there are remote participants (for self-view logic)
  const remoteParticipants = participants.filter(p => p.identity !== localParticipant?.identity);
  const hasRemoteParticipants = remoteParticipants.length > 0;
  const remoteParticipantCount = remoteParticipants.length;
  
  // Toggle layout mode
  const toggleLayoutMode = useCallback(() => {
    setLayoutMode(prev => {
      const newMode = prev === 'focus' ? 'gallery' : 'focus';
      toast.success(newMode === 'gallery' ? 'Галерейный режим' : 'Фокус-режим', {
        description: newMode === 'gallery' ? 'Все участники в сетке' : 'Один участник на весь экран',
        duration: 2000,
      });
      return newMode;
    });
  }, []);
  
  // Suggest gallery mode when 3+ participants join
  useEffect(() => {
    if (remoteParticipantCount >= 2 && layoutMode === 'focus' && !galleryModeSuggestedRef.current) {
      galleryModeSuggestedRef.current = true;
      toast.info('Много участников', {
        description: 'Переключитесь на галерейный режим для удобства',
        action: {
          label: 'Галерея',
          onClick: () => setLayoutMode('gallery'),
        },
        duration: 6000,
      });
    }
  }, [remoteParticipantCount, layoutMode]);
  
  // Auto-switch to focus mode when screen share starts
  useEffect(() => {
    if (isScreenShareEnabled && layoutMode === 'gallery') {
      setLayoutMode('focus');
      toast.info('Фокус-режим', {
        description: 'Автоматическое переключение для демонстрации экрана',
        duration: 2000,
      });
    }
  }, [isScreenShareEnabled, layoutMode]);
  
  // Track active speaker
  useEffect(() => {
    if (!room) return;
    
    const handleActiveSpeakerChange = (speakers: any[]) => {
      if (speakers.length > 0) {
        setSpeakingParticipant(speakers[0].identity);
      } else {
        setSpeakingParticipant(undefined);
      }
    };
    
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakerChange);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakerChange);
    };
  }, [room]);

  // Notify parent when room is ready and try to enable audio proactively
  useEffect(() => {
    if (room && onRoomReady && !roomReadyCalledRef.current) {
      roomReadyCalledRef.current = true;
      onRoomReady(room);
      
      // Proactively try to start audio when room connects
      // This will work if user has already interacted with the page
      room.startAudio().then(() => {
        console.log('[LiveKitRoom] Audio started on room ready');
        setShowAudioPrompt(false);
      }).catch(() => {
        // Expected to fail if no user interaction yet - that's ok
        console.log('[LiveKitRoom] Audio start on ready failed (expected if no interaction)');
      });
    }
  }, [room, onRoomReady]);

  // Hide onboarding after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOnboarding(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide panels after 3 seconds of inactivity
  useEffect(() => {
    const startHideTimer = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowTopPanel(false);
        setShowBottomPanel(false);
      }, 3000);
    };

    startHideTimer();

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse movement for panel visibility
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Show top panel when mouse is in top 100px
    if (y < 100) {
      setShowTopPanel(true);
    }
    
    // Show bottom panel when mouse is in bottom 100px
    if (y > height - 100) {
      setShowBottomPanel(true);
    }

    // Reset hide timer on any movement
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowTopPanel(false);
      setShowBottomPanel(false);
    }, 3000);
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    try {
      await localParticipant?.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error('Failed to toggle camera:', err);
    }
  }, [localParticipant, isCameraEnabled]);

  // Toggle microphone
  const toggleMicrophone = useCallback(async () => {
    try {
      await localParticipant?.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
    }
  }, [localParticipant, isMicrophoneEnabled]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant?.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.error('Failed to toggle screen share:', err);
    }
  }, [localParticipant, isScreenShareEnabled]);

  // Voice commands hook - must be after toggle functions are defined
  const { isListening: isVoiceCommandsActive, toggleListening: toggleVoiceCommands, isSupported: voiceCommandsSupported } = useVoiceCommands({
    onMuteToggle: toggleMicrophone,
    onCameraToggle: toggleCamera,
    onRaiseHand: toggleHand,
    onScreenShare: toggleScreenShare,
    onLeave: () => {},
    enabled: true,
  });
  
  // Keyboard shortcuts
  const { showShortcutsHelp } = useKeyboardShortcuts({
    onToggleMic: toggleMicrophone,
    onToggleCamera: toggleCamera,
    onToggleLayoutMode: toggleLayoutMode,
    onRaiseHand: toggleHand,
    onToggleChat: () => setShowChat(prev => !prev),
    enabled: true,
  });

  // Virtual background handlers
  const applyBlurBackground = useCallback(async (intensity: number) => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        const processor = BackgroundBlur(intensity);
        await track.setProcessor(processor);
        setCurrentBackground(intensity <= 5 ? 'blur-light' : 'blur-strong');
      }
    } catch (err) {
      console.error('Failed to apply blur background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  const applyImageBackground = useCallback(async (imageUrl: string) => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        const processor = VirtualBackground(imageUrl);
        await track.setProcessor(processor);
        setCurrentBackground('image');
      }
    } catch (err) {
      console.error('Failed to apply image background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  const removeBackground = useCallback(async () => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        await track.stopProcessor();
        setCurrentBackground('none');
      }
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  // Toggle call recording - records participants directly via canvas (no screen picker dialog)
  const toggleCallRecording = useCallback(() => {
    if (isCallRecording) {
      // Stop recording
      if (callRecorderRef.current) {
        callRecorderRef.current.stop();
        callRecorderRef.current = null;
      }
      if (callRecordingAnimationRef.current) {
        cancelAnimationFrame(callRecordingAnimationRef.current);
        callRecordingAnimationRef.current = null;
      }
      if (callRecordingCanvasRef.current) {
        callRecordingCanvasRef.current = null;
      }
      setIsCallRecording(false);
      return;
    }
    
    try {
      // Find all video elements in the call
      const videoElements = containerRef.current?.querySelectorAll('video') ?? [];
      if (videoElements.length === 0) {
        toast.error('Нет видео для записи');
        return;
      }
      
      // Create canvas to composite all videos
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      callRecordingCanvasRef.current = canvas;
      
      // Animation loop to draw all videos on canvas
      let isActive = true;
      const drawFrame = () => {
        if (!isActive) return;
        
        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Get current video elements (may change during call)
        const videos = Array.from(containerRef.current?.querySelectorAll('video') ?? []) as HTMLVideoElement[];
        const count = videos.length;
        
        if (count === 1) {
          // Single video - full screen
          ctx.drawImage(videos[0], 0, 0, canvas.width, canvas.height);
        } else if (count === 2) {
          // 2 videos - side by side
          const halfW = canvas.width / 2;
          ctx.drawImage(videos[0], 0, 0, halfW, canvas.height);
          ctx.drawImage(videos[1], halfW, 0, halfW, canvas.height);
        } else if (count <= 4) {
          // 2x2 grid
          const halfW = canvas.width / 2;
          const halfH = canvas.height / 2;
          videos.forEach((video, i) => {
            const x = (i % 2) * halfW;
            const y = Math.floor(i / 2) * halfH;
            ctx.drawImage(video, x, y, halfW, halfH);
          });
        } else {
          // 3x3 grid for more
          const thirdW = canvas.width / 3;
          const thirdH = canvas.height / 3;
          videos.slice(0, 9).forEach((video, i) => {
            const x = (i % 3) * thirdW;
            const y = Math.floor(i / 3) * thirdH;
            ctx.drawImage(video, x, y, thirdW, thirdH);
          });
        }
        
        callRecordingAnimationRef.current = requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
      
      // Capture canvas stream
      const stream = canvas.captureStream(30);
      
      // Try to get audio from participants
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      
      // Collect audio from all video elements
      videoElements.forEach(video => {
        try {
          if ((video as HTMLVideoElement).srcObject instanceof MediaStream) {
            const mediaStream = (video as HTMLVideoElement).srcObject as MediaStream;
            const audioTracks = mediaStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const source = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
              source.connect(destination);
            }
          }
        } catch {
          // Ignore cross-origin or unavailable audio
        }
      });
      
      // Merge audio into stream if available
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      
      // Create recorder
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm'
      });
      
      callRecordingChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          callRecordingChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        isActive = false;
        
        const blob = new Blob(callRecordingChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aplink-call-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        audioContext.close().catch(() => {});
        toast.success('Запись сохранена!');
      };
      
      recorder.start(100);
      callRecorderRef.current = recorder;
      setIsCallRecording(true);
      toast.success('Запись началась');
      
    } catch (err) {
      console.error('Failed to start call recording:', err);
      toast.error('Не удалось начать запись');
    }
  }, [isCallRecording]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Screenshot detection with shutter sound
  useEffect(() => {
    const playShutterSound = () => {
      const shutterSound = new Audio('/audio/camera-shutter.mp3');
      shutterSound.volume = 0.4;
      shutterSound.play().catch(() => {});
    };

    const triggerFlash = () => {
      setShowScreenshotFlash(true);
      playShutterSound();
      
      // Notify other participants
      if (room) {
        const message = {
          type: 'SCREENSHOT_TAKEN',
          participantName,
          participantIdentity: localParticipant?.identity,
        };
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message)),
          { reliable: true }
        );
      }
      
      setTimeout(() => setShowScreenshotFlash(false), 350);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen on Windows/Linux
      if (e.key === 'PrintScreen') {
        triggerFlash();
      }
      // Cmd+Shift+3 or Cmd+Shift+4 on Mac
      if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4')) {
        triggerFlash();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room, participantName, localParticipant]);

  // Listen for raise hand events for voice notifications + screenshot notifications
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'RAISE_HAND' && message.raised && message.participantIdentity !== localParticipant?.identity) {
          announceHandRaised(message.participantName);
        }
        // Screenshot notification from another participant
        if (message.type === 'SCREENSHOT_TAKEN' && message.participantIdentity !== localParticipant?.identity) {
          setShowScreenshotFlash(true);
          // Play shutter sound for remote screenshot too
          const shutterSound = new Audio('/audio/camera-shutter.mp3');
          shutterSound.volume = 0.35;
          shutterSound.play().catch(() => {});
          toast.info(`📸 ${message.participantName} сделал скриншот`);
          setTimeout(() => setShowScreenshotFlash(false), 350);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, announceHandRaised, localParticipant]);

  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log("[LiveKitRoom] Participant joined:", participant.identity, participant.name);
      
      // Add to new participants for animation
      setNewParticipants(prev => new Set(prev).add(participant.identity));
      
      // Voice notification
      announceParticipantJoined(participant.name || participant.identity);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        setNewParticipants(prev => {
          const next = new Set(prev);
          next.delete(participant.identity);
          return next;
        });
      }, 500);
      
      onParticipantJoined?.(participant.identity, participant.name || participant.identity);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log("[LiveKitRoom] Participant left:", participant.identity);
      announceParticipantLeft(participant.name || participant.identity);
      onParticipantLeft?.(participant.identity);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    
    // Log audio track status for debugging
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === 'audio') {
        console.log('[LiveKitRoom] Audio track subscribed:', {
          participant: participant.identity,
          trackSid: track.sid,
          isMuted: track.isMuted,
          isEnabled: publication.isEnabled,
        });
      }
    };
    
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, onParticipantJoined, onParticipantLeft, announceParticipantJoined, announceParticipantLeft]);

  // Get all tracks including screen shares
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Get local camera track for self-view
  const localVideoTrack = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
  const localScreenTrack = localParticipant?.getTrackPublication(Track.Source.ScreenShare)?.track;

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full livekit-room-container bg-background relative cursor-default"
      onMouseMove={handleMouseMove}
    >
      {/* Subtle onboarding arrow hints */}
      {showOnboarding && (
        <>
          {/* Top arrow - minimal */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60]">
            <ChevronUp className="w-5 h-5 text-white/40 animate-subtle-bounce-up" />
          </div>
          
          {/* Bottom arrow - minimal */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[60]">
            <ChevronDown className="w-5 h-5 text-white/40 animate-subtle-bounce-down" />
          </div>
        </>
      )}

      {/* Top Header Panel - soft ultra-rounded with slide animation */}
      {headerButtons && (
        <div 
          className={cn(
            "absolute top-4 left-1/2 -translate-x-1/2 z-50",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            showTopPanel 
              ? "translate-y-0 opacity-100 scale-100" 
              : isMaximizing 
                ? "opacity-0 scale-95" // No translate-y when maximizing to prevent "fly out"
                : "-translate-y-8 opacity-0 scale-90 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[2.5rem] bg-transparent backdrop-blur-[2px] border border-white/[0.1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
            {/* Minimize button - just minimize without PiP */}
            <button
              onClick={() => {
                // Exit any existing PiP first
                if (document.pictureInPictureElement) {
                  document.exitPictureInPicture().catch(() => {});
                }
                onMinimize?.();
              }}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/[0.08] transition-all hover:scale-105 hover:shadow-lg [&_svg]:stroke-[2.5]"
              title="Свернуть звонок"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Room name */}
            {roomDisplayName && (
              <span className="text-sm font-semibold truncate max-w-[120px] px-2">{roomDisplayName}</span>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* Header buttons from parent */}
            {headerButtons}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* Timer button */}
            <CallTimer room={room} isHost={true} />

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* Connection indicator - styled more beautifully */}
            {connectionIndicator}
          </div>
        </div>
      )}

      {/* Main video - Focus or Gallery layout */}
      <div className="flex-1 relative overflow-hidden">
        {layoutMode === 'focus' ? (
          <FocusVideoLayout
            localParticipant={localParticipant as LocalParticipant}
            isCameraEnabled={isCameraEnabled}
            showChat={showChat}
            isMaximizing={isMaximizing}
            speakingParticipant={speakingParticipant}
          />
        ) : (
          <GalleryVideoLayout
            localParticipant={localParticipant as LocalParticipant}
            isCameraEnabled={isCameraEnabled}
            speakingParticipant={speakingParticipant}
          />
        )}
        
        {/* Raised hand indicators - BIG fullscreen overlay */}
        {raisedHands.size > 0 && (
          <div className="fixed inset-0 pointer-events-none z-[99998] flex justify-center pt-20">
            <div className="flex flex-col gap-3">
              {Array.from(raisedHands.entries()).map(([identity, hand]) => (
                <div
                  key={identity}
                  className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-yellow-500/90 shadow-[0_0_40px_rgba(234,179,8,0.6),0_0_80px_rgba(234,179,8,0.3)] animate-bounce"
                >
                  <Hand className="w-7 h-7 text-white animate-pulse" />
                  <span className="text-white text-lg font-bold">{hand.participantName}</span>
                  <span className="text-yellow-100 text-sm">поднял руку</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Audio Problem Detector */}
      <AudioProblemDetector
        room={room}
        localParticipant={localParticipant as LocalParticipant}
      />

      {/* Screenshot flash overlay */}
      {showScreenshotFlash && <div className="screenshot-flash" />}

      {/* Audio blocked warning - prominent button to enable audio */}
      {showAudioPrompt && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <button
            {...startAudioProps}
            onClick={async () => {
              try {
                await room.startAudio();
                setShowAudioPrompt(false);
                console.log('[LiveKitRoom] Audio enabled by user click');
              } catch (err) {
                console.error('[LiveKitRoom] Failed to start audio:', err);
              }
            }}
            className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-primary/90 hover:bg-primary text-primary-foreground shadow-[0_0_60px_hsl(var(--primary)/0.5)] transition-all hover:scale-105 cursor-pointer"
          >
            <VolumeOff className="w-12 h-12" />
            <span className="text-xl font-bold">Нажмите для включения звука</span>
            <span className="text-sm opacity-80">Браузер заблокировал автовоспроизведение</span>
          </button>
        </div>
      )}

      {/* Bottom Control Bar - ПРОЗРАЧНАЯ панель, контраст только на иконках */}
      <div 
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 z-50",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          showBottomPanel 
            ? "translate-y-0 opacity-100 scale-100" 
            : isMaximizing
              ? "opacity-0 scale-95" // No translate-y when maximizing to prevent "fly out"
              : "translate-y-12 opacity-0 scale-90 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-[2.5rem] bg-transparent backdrop-blur-[2px] border border-white/[0.1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          {/* Camera toggle */}
          <Button
            onClick={toggleCamera}
            variant={isCameraEnabled ? "outline" : "secondary"}
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-white/20",
              isCameraEnabled 
                ? "bg-white/15 hover:bg-white/25" 
                : "bg-destructive/40 border-destructive/60 hover:bg-destructive/50"
            )}
          >
            {isCameraEnabled ? (
              <Video className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
            ) : (
              <VideoOff className="w-5 h-5 stroke-[1.8] text-destructive drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]" />
            )}
          </Button>

          {/* Mic toggle with popup menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={isMicrophoneEnabled ? "outline" : "secondary"}
                size="icon"
                className={cn(
                  "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-white/20",
                  isMicrophoneEnabled 
                    ? "bg-white/15 hover:bg-white/25" 
                    : "bg-destructive/40 border-destructive/60 hover:bg-destructive/50"
                )}
              >
                {isMicrophoneEnabled ? (
                  <Mic className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
                ) : (
                  <MicOff className="w-5 h-5 stroke-[1.8] text-destructive drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="p-3 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]"
            >
              <div className="flex flex-col items-center gap-3">
                {/* Main: Toggle Mic (centered on top) */}
                <button
                  onClick={toggleMicrophone}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-white/10 backdrop-blur-sm border border-white/[0.12]",
                    "hover:bg-white/20 transition-all hover:scale-110 hover:shadow-lg",
                    !isMicrophoneEnabled && "bg-destructive/30 border-destructive/50 shadow-[0_0_15px_rgba(220,50,50,0.2)]"
                  )}
                  title={isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                >
                  {isMicrophoneEnabled ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <span className="text-[10px] text-muted-foreground -mt-1">
                  {isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                </span>
                
                {/* Bottom row: Noise (left) + Voice (right) */}
                <div className="flex items-center gap-4">
                  {/* Noise Suppression */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={toggleNoiseSuppression}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        "bg-white/10 backdrop-blur-sm border border-white/[0.12]",
                        "hover:bg-white/20 transition-all hover:scale-110 hover:shadow-lg",
                        isNoiseSuppressionEnabled && "bg-primary/30 border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
                      )}
                      title={isNoiseSuppressionEnabled ? "Выкл. шумоподавление" : "Вкл. шумоподавление"}
                    >
                      {isNoiseSuppressionEnabled ? <VolumeX className="w-4 h-4 text-primary" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">Шумоподавление</span>
                  </div>
                  
                  {/* Voice Commands */}
                  {voiceCommandsSupported && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={toggleVoiceCommands}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          "bg-white/10 backdrop-blur-sm border border-white/[0.12]",
                          "hover:bg-white/20 transition-all hover:scale-110 hover:shadow-lg",
                          isVoiceCommandsActive && "bg-purple-500/30 border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                        )}
                        title={isVoiceCommandsActive ? "Выкл. голосовые команды" : "Голосовые команды"}
                      >
                        <Mic2 className={cn("w-4 h-4", isVoiceCommandsActive && "text-purple-400")} />
                      </button>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">Голос. команды</span>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Screen share toggle with menu */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={isScreenShareEnabled ? "default" : "outline"}
                size="icon"
                className={cn(
                  "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-white/20",
                  isScreenShareEnabled 
                    ? "bg-green-500/40 border-green-500/60 hover:bg-green-500/50" 
                    : "bg-white/15 hover:bg-white/25"
                )}
              >
                <MonitorUp className={cn(
                  "w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]",
                  isScreenShareEnabled && "text-green-400"
                )} />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="w-auto p-3 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground font-medium text-center mb-1">Демонстрация</span>
                <div className="flex items-center gap-3">
                  {/* Share screen */}
                  <button
                    onClick={toggleScreenShare}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                      isScreenShareEnabled 
                        ? "bg-green-500/20 border border-green-500/30" 
                        : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    <MonitorUp className={cn("w-5 h-5", isScreenShareEnabled ? "text-green-400" : "text-primary")} />
                    <span className="text-xs whitespace-nowrap">{isScreenShareEnabled ? "Остановить" : "Экран"}</span>
                  </button>
                  
                  {/* Direct call recording - records participants without dialog */}
                  <button
                    onClick={toggleCallRecording}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all relative",
                      isCallRecording 
                        ? "bg-red-500/20 border border-red-500/40" 
                        : "bg-white/5 hover:bg-white/10"
                    )}
                  >
                    {/* REC indicator when recording */}
                    {isCallRecording && (
                      <div className="absolute -top-1 -right-1 flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded-full animate-pulse">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        <span className="text-[8px] font-bold text-white">REC</span>
                      </div>
                    )}
                    <Video className={cn("w-5 h-5", isCallRecording ? "text-red-400" : "text-primary")} />
                    <span className="text-xs whitespace-nowrap">{isCallRecording ? "Остановить" : "Запись"}</span>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider */}
          <div className="w-px h-8 bg-white/10 mx-0.5" />

          {/* Layout mode toggle */}
          <Button
            onClick={toggleLayoutMode}
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-white/20",
              layoutMode === 'gallery' 
                ? "bg-primary/30 border-primary/50" 
                : "bg-white/15 hover:bg-white/25"
            )}
            title={layoutMode === 'focus' ? 'Галерейный режим (G)' : 'Фокус-режим (G)'}
          >
            {layoutMode === 'focus' ? (
              <LayoutGrid className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
            ) : (
              <User className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
            )}
          </Button>

          {/* Virtual Background selector (face filters removed) */}
          <VirtualBackgroundSelector
            onSelectBlur={applyBlurBackground}
            onSelectImage={applyImageBackground}
            onRemove={removeBackground}
            currentBackground={currentBackground}
            isProcessing={isProcessingBackground}
            onResetAllEffects={() => {
              if (isNoiseSuppressionEnabled) toggleNoiseSuppression();
            }}
          />

          {/* Drawing mode selector (Whiteboard / Screen Overlay) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 border-white/20 transition-all hover:scale-105 hover:shadow-lg",
                  (showWhiteboard || showDrawingOverlay) && "bg-primary/20 border-primary/50"
                )}
                title="Рисование"
              >
                <Pencil className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="w-auto p-3 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground font-medium text-center mb-1">Режим рисования</span>
                <div className="flex items-center gap-3">
                  {/* Whiteboard option */}
                  <button
                    onClick={() => {
                      setShowWhiteboard(true);
                      setShowDrawingOverlay(false);
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                      showWhiteboard 
                        ? "bg-primary/30 border-primary/50" 
                        : "bg-white/10 border-white/10 group-hover:border-white/20"
                    )}>
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">Доска</span>
                  </button>
                  
                  {/* Screen overlay option */}
                  <button
                    onClick={() => {
                      setShowDrawingOverlay(true);
                      setShowWhiteboard(false);
                    }}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/10 transition-all group"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border transition-all",
                      showDrawingOverlay 
                        ? "bg-primary/30 border-primary/50" 
                        : "bg-white/10 border-white/10 group-hover:border-white/20"
                    )}>
                      <MonitorPlay className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">На экране</span>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Emoji Reactions */}
          <EmojiReactions
            room={room}
            participantName={participantName}
          />

          {/* Raise Hand button */}
          <Button
            onClick={toggleHand}
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-white/20",
              isHandRaised 
                ? "bg-yellow-500/40 border-yellow-500/60 hover:bg-yellow-500/50 animate-pulse" 
                : "bg-white/15 hover:bg-white/25"
            )}
            title={isHandRaised ? "Опустить руку" : "Поднять руку"}
          >
            <Hand className={cn(
              "w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]", 
              isHandRaised && "text-yellow-400"
            )} />
          </Button>

          {/* Chat toggle button - buttonOnly mode for bottom panel */}
          <InCallChat
            room={room}
            participantName={participantName}
            isOpen={showChat}
            onToggle={() => setShowChat(!showChat)}
            buttonOnly
          />

          {/* Keyboard shortcuts help button */}
          <Button
            onClick={showShortcutsHelp}
            variant="outline"
            size="icon"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border-white/20 transition-all hover:scale-105"
            title="Горячие клавиши (?)"
          >
            <Keyboard className="w-4 h-4 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
          </Button>

          {/* Divider */}
          <div className="w-px h-8 bg-white/10 mx-0.5" />

          {/* Leave button */}
          <DisconnectButton className="flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground transition-all hover:scale-105 hover:shadow-lg border border-destructive/60 shadow-[0_0_15px_rgba(220,50,50,0.3)]">
            <PhoneOff className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_rgba(255,255,255,0.5)]" />
            <span className="text-sm font-medium tracking-wide">Выйти</span>
          </DisconnectButton>
        </div>
      </div>

      {/* Floating Chat Panel - separate instance for the panel */}
      {showChat && (
        <InCallChat
          room={room}
          participantName={participantName}
          isOpen={true}
          onToggle={() => setShowChat(false)}
        />
      )}

      {/* Collaborative Whiteboard */}
      <CollaborativeWhiteboard
        room={room}
        participantName={participantName}
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
      />

      {/* Drawing Overlay - for drawing on screen */}
      <DrawingOverlay
        room={room}
        participantName={participantName}
        isOpen={showDrawingOverlay}
        onClose={() => setShowDrawingOverlay(false)}
      />

      <RoomAudioRenderer />
    </div>
  );
}

export default LiveKitRoom;
