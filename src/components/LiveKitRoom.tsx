import { useEffect, useState, useCallback, useRef } from "react";
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
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, Room, RemoteParticipant, VideoPresets, LocalParticipant } from "livekit-client";
import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  VideoOff, 
  Maximize2, 
  Minimize2, 
  Video, 
  Mic, 
  MicOff,
  MonitorUp, 
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Minimize,
  Hand,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InCallChat } from "@/components/InCallChat";
import { VirtualBackgroundSelector } from "@/components/VirtualBackgroundSelector";
import { EmojiReactions } from "@/components/EmojiReactions";
import { useRaiseHand } from "@/hooks/useRaiseHand";
import { useNoiseSuppression } from "@/hooks/useNoiseSuppression";

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
}: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
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
        setToken(data.token);
        setServerUrl(data.url);
      } catch (err) {
        console.error("[LiveKitRoom] Error getting token:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to connect";
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    getToken();
  }, [roomName, participantName, participantIdentity, onError]);

  const handleConnected = useCallback(() => {
    console.log("[LiveKitRoom] Connected to room");
    onConnected?.();
  }, [onConnected]);

  const handleDisconnected = useCallback(() => {
    console.log("[LiveKitRoom] Disconnected from room");
    onDisconnected?.();
  }, [onDisconnected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="glass-dark rounded-2xl p-8 flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="absolute inset-0 w-10 h-10 rounded-full animate-pulse-glow" />
          </div>
          <p className="text-muted-foreground text-lg">Подключение к комнате...</p>
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

  if (!token || !serverUrl) {
    return null;
  }

  return (
    <LKRoom
      serverUrl={serverUrl}
      token={token}
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
}: LiveKitContentProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [newParticipants, setNewParticipants] = useState<Set<string>>(new Set());
  const roomReadyCalledRef = useRef(false);
  
  // Raise hand hook
  const { isHandRaised, raisedHands, toggleHand } = useRaiseHand(room, participantName);
  
  // Noise suppression hook
  const { isEnabled: isNoiseSuppressionEnabled, toggle: toggleNoiseSuppression } = useNoiseSuppression();
  
  // Auto-hide panels state
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<'none' | 'blur-light' | 'blur-strong' | 'image'>('none');
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Local track states
  const isCameraEnabled = localParticipant?.isCameraEnabled ?? false;
  const isMicrophoneEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isScreenShareEnabled = localParticipant?.isScreenShareEnabled ?? false;

  // Check if there are remote participants (for self-view logic)
  const remoteParticipants = participants.filter(p => p.identity !== localParticipant?.identity);
  const hasRemoteParticipants = remoteParticipants.length > 0;

  // Notify parent when room is ready
  useEffect(() => {
    if (room && onRoomReady && !roomReadyCalledRef.current) {
      roomReadyCalledRef.current = true;
      onRoomReady(room);
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

  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log("[LiveKitRoom] Participant joined:", participant.identity, participant.name);
      
      // Add to new participants for animation
      setNewParticipants(prev => new Set(prev).add(participant.identity));
      
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
      onParticipantLeft?.(participant.identity);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room, onParticipantJoined, onParticipantLeft]);

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
              : "-translate-y-8 opacity-0 scale-90 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-[2.5rem] bg-white/[0.02] backdrop-blur-3xl border border-white/[0.03] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
            {/* Minimize button */}
            <button
              onClick={onMinimize}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/[0.08] transition-all hover:scale-105 hover:shadow-lg"
              title="Свернуть звонок"
            >
              <Minimize className="w-4 h-4" />
            </button>

            {/* Room name */}
            {roomDisplayName && (
              <span className="text-sm font-medium truncate max-w-[120px] px-2">{roomDisplayName}</span>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* Header buttons from parent */}
            {headerButtons}

            {/* Divider */}
            <div className="w-px h-5 bg-white/10" />

            {/* Connection indicator - styled more beautifully */}
            {connectionIndicator}
          </div>
        </div>
      )}

      {/* Self-view (Picture-in-Picture style) - only when there are other participants and chat is closed */}
      {hasRemoteParticipants && isCameraEnabled && localVideoTrack && !showChat && (
        <div className="absolute bottom-28 right-4 z-40 w-48 h-36 rounded-xl overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)] bg-black">
          <VideoTrack 
            trackRef={{ 
              participant: localParticipant as LocalParticipant, 
              source: Track.Source.Camera,
              publication: localParticipant?.getTrackPublication(Track.Source.Camera)!
            }} 
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-1 left-2 text-xs text-white/90 px-1.5 py-0.5 rounded">
            Вы
          </div>
        </div>
      )}

      {/* Screen share self-view (when sharing) */}
      {isScreenShareEnabled && localScreenTrack && (
        <div className="absolute top-24 right-4 z-50 w-64 h-40 rounded-xl overflow-hidden border-2 border-green-500/50 shadow-[0_0_20px_hsl(142,76%,36%,0.3)] bg-black">
          <VideoTrack 
            trackRef={{ 
              participant: localParticipant as LocalParticipant, 
              source: Track.Source.ScreenShare,
              publication: localParticipant?.getTrackPublication(Track.Source.ScreenShare)!
            }} 
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-1 left-2 text-xs text-white/90 px-1.5 py-0.5 rounded flex items-center gap-1">
            <MonitorUp className="w-3 h-3" />
            Ваш экран
          </div>
        </div>
      )}

      {/* Main video grid - with screen share priority layout */}
      <div className="flex-1 relative overflow-hidden">
        {(() => {
          // Find screen share tracks
          const screenShareTracks = tracks.filter(t => t.source === Track.Source.ScreenShare);
          const cameraTracks = tracks.filter(t => t.source === Track.Source.Camera);
          
          // If there's a screen share - use focus layout
          if (screenShareTracks.length > 0) {
            return (
              <div className="flex h-full w-full gap-3 p-3">
                {/* Main screen share area */}
                <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/40 border border-white/10">
                  <GridLayout tracks={screenShareTracks} className="h-full">
                    <ParticipantTile className="rounded-xl overflow-hidden" />
                  </GridLayout>
                </div>
                
                {/* Side panel with camera feeds - vertical strip */}
                {cameraTracks.length > 0 && (
                  <div className="w-44 flex flex-col gap-2 overflow-y-auto">
                    <GridLayout tracks={cameraTracks} className="flex flex-col gap-2">
                      <ParticipantTile className="rounded-xl overflow-hidden aspect-video" />
                    </GridLayout>
                  </div>
                )}
              </div>
            );
          }
          
          // Default grid layout with raised hand indicators
          return (
            <div className="relative h-full">
              <GridLayout tracks={tracks} className="p-3 gap-3">
                <ParticipantTile className="rounded-xl overflow-hidden" />
              </GridLayout>
              
              {/* Raised hand indicators overlay */}
              {Array.from(raisedHands.entries()).map(([identity, hand]) => {
                const participant = participants.find(p => p.identity === identity);
                if (!participant) return null;
                
                return (
                  <div
                    key={identity}
                    className="absolute top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/90 shadow-lg animate-bounce-hand animate-hand-glow">
                      <Hand className="w-5 h-5 text-white" />
                      <span className="text-white text-sm font-medium">{hand.participantName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Bottom Control Bar - soft ultra-rounded with glass effect */}
      <div 
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 z-50",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          showBottomPanel 
            ? "translate-y-0 opacity-100 scale-100" 
            : "translate-y-12 opacity-0 scale-90 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 rounded-[2.5rem] bg-white/[0.02] backdrop-blur-3xl border border-white/[0.03] shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
          {/* Camera toggle */}
          <Button
            onClick={toggleCamera}
            variant={isCameraEnabled ? "outline" : "secondary"}
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
              isCameraEnabled 
                ? "bg-white/10 hover:bg-white/20" 
                : "bg-destructive/30 border-destructive/50 hover:bg-destructive/40"
            )}
          >
            {isCameraEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5 text-destructive" />
            )}
          </Button>

          {/* Mic toggle */}
          <Button
            onClick={toggleMicrophone}
            variant={isMicrophoneEnabled ? "outline" : "secondary"}
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
              isMicrophoneEnabled 
                ? "bg-white/10 hover:bg-white/20" 
                : "bg-destructive/30 border-destructive/50 hover:bg-destructive/40"
            )}
          >
            {isMicrophoneEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5 text-destructive" />
            )}
          </Button>

          {/* Screen share toggle */}
          <Button
            onClick={toggleScreenShare}
            variant={isScreenShareEnabled ? "default" : "outline"}
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
              isScreenShareEnabled 
                ? "bg-green-500/30 border-green-500/50 hover:bg-green-500/40" 
                : "bg-white/10 hover:bg-white/20"
            )}
          >
            <MonitorUp className={cn(
              "w-5 h-5",
              isScreenShareEnabled && "text-green-400"
            )} />
          </Button>

          {/* Divider */}
          <div className="w-px h-8 bg-white/10 mx-0.5" />

          {/* Virtual Background selector */}
          <VirtualBackgroundSelector
            onSelectBlur={applyBlurBackground}
            onSelectImage={applyImageBackground}
            onRemove={removeBackground}
            currentBackground={currentBackground}
            isProcessing={isProcessingBackground}
          />

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
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
              isHandRaised 
                ? "bg-yellow-500/30 border-yellow-500/50 hover:bg-yellow-500/40 animate-pulse" 
                : "bg-white/10 hover:bg-white/20"
            )}
            title={isHandRaised ? "Опустить руку" : "Поднять руку"}
          >
            <Hand className={cn("w-5 h-5", isHandRaised && "text-yellow-400")} />
          </Button>

          {/* Noise Suppression toggle */}
          <Button
            onClick={toggleNoiseSuppression}
            variant="outline"
            size="icon"
            className={cn(
              "w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
              isNoiseSuppressionEnabled 
                ? "bg-primary/30 border-primary/50 hover:bg-primary/40" 
                : "bg-white/10 hover:bg-white/20"
            )}
            title={isNoiseSuppressionEnabled ? "Выключить шумоподавление" : "Включить шумоподавление"}
          >
            {isNoiseSuppressionEnabled ? (
              <Volume2 className="w-5 h-5 text-primary" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>

          {/* Chat toggle button - buttonOnly mode for bottom panel */}
          <InCallChat
            room={room}
            participantName={participantName}
            isOpen={showChat}
            onToggle={() => setShowChat(!showChat)}
            buttonOnly
          />

          {/* Divider */}
          <div className="w-px h-8 bg-white/10 mx-0.5" />

          {/* Leave button */}
          <DisconnectButton className="flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-all hover:scale-105 hover:shadow-lg border border-destructive/50">
            <PhoneOff className="w-5 h-5" />
            <span className="text-sm font-medium">Выйти</span>
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

      <RoomAudioRenderer />
    </div>
  );
}

export default LiveKitRoom;
