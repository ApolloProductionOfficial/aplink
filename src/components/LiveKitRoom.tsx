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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InCallChat } from "@/components/InCallChat";

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
    // Redirect to apolloproduction.studio
    window.open('https://apolloproduction.studio', '_blank');
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
  
  // Auto-hide panels state
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
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
      {/* Onboarding hints */}
      {showOnboarding && (
        <>
          {/* Top hint */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
            <div className="flex flex-col items-center gap-2 glass rounded-xl px-4 py-2 border border-primary/30">
              <ChevronUp className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">Наведите сюда для панели</span>
            </div>
          </div>
          
          {/* Bottom hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-bounce" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col items-center gap-2 glass rounded-xl px-4 py-2 border border-primary/30">
              <span className="text-xs text-muted-foreground">Наведите сюда для управления</span>
              <ChevronDown className="w-5 h-5 text-primary" />
            </div>
          </div>
        </>
      )}

      {/* Top Header Panel - auto-hide */}
      {headerButtons && (
        <div 
          className={cn(
            "absolute top-0 left-0 right-0 z-50",
            "transition-all duration-300 ease-out",
            showTopPanel 
              ? "translate-y-0 opacity-100" 
              : "-translate-y-full opacity-0 pointer-events-none"
          )}
        >
          <div className="glass-dark border-b border-border/50 p-3">
            <div className="flex items-center justify-between">
              {/* Logo / Minimize button */}
              <button
                onClick={onMinimize}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
                title="Свернуть звонок"
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.5)] group-hover:shadow-[0_0_25px_hsl(var(--primary)/0.7)] transition-shadow">
                  <div className="absolute inset-0 bg-primary/30 animate-pulse" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-sm">APLink</span>
                  <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                    Свернуть
                  </span>
                </div>
              </button>

              {/* Room name + connection indicator */}
              <div className="flex items-center gap-3">
                {roomDisplayName && (
                  <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-border/30">
                    <span className="text-sm font-medium truncate max-w-[150px]">{roomDisplayName}</span>
                  </div>
                )}
                {connectionIndicator}
              </div>

              {/* Header buttons from parent */}
              <div className="flex items-center gap-2">
                {headerButtons}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Self-view (Picture-in-Picture style) - only when there are other participants */}
      {hasRemoteParticipants && isCameraEnabled && localVideoTrack && (
        <div className="absolute bottom-24 right-4 z-50 w-48 h-36 rounded-xl overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)] bg-black">
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

      {/* Main video grid */}
      <div className="flex-1 relative overflow-hidden">
        <GridLayout tracks={tracks} className="p-3 gap-3">
          <ParticipantTile className="rounded-xl overflow-hidden" />
        </GridLayout>
      </div>

      {/* In-call Chat */}
      <InCallChat
        room={room}
        participantName={participantName}
        isOpen={showChat}
        onToggle={() => setShowChat(!showChat)}
      />

      {/* Bottom Control Bar - auto-hide */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 z-50",
          "transition-all duration-300 ease-out",
          showBottomPanel 
            ? "translate-y-0 opacity-100" 
            : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="glass-dark border-t border-border/50 p-3">
          <div className="flex items-center justify-center gap-3">
            {/* Camera toggle - custom button */}
            <Button
              onClick={toggleCamera}
              variant={isCameraEnabled ? "outline" : "secondary"}
              size="icon"
              className={cn(
                "w-12 h-12 rounded-xl border-border/50 transition-all",
                isCameraEnabled 
                  ? "bg-card hover:bg-card/80" 
                  : "bg-destructive/20 border-destructive/50 hover:bg-destructive/30"
              )}
            >
              {isCameraEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5 text-destructive" />
              )}
            </Button>

            {/* Mic toggle - custom button */}
            <Button
              onClick={toggleMicrophone}
              variant={isMicrophoneEnabled ? "outline" : "secondary"}
              size="icon"
              className={cn(
                "w-12 h-12 rounded-xl border-border/50 transition-all",
                isMicrophoneEnabled 
                  ? "bg-card hover:bg-card/80" 
                  : "bg-destructive/20 border-destructive/50 hover:bg-destructive/30"
              )}
            >
              {isMicrophoneEnabled ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5 text-destructive" />
              )}
            </Button>

            {/* Screen share toggle - custom button */}
            <Button
              onClick={toggleScreenShare}
              variant={isScreenShareEnabled ? "default" : "outline"}
              size="icon"
              className={cn(
                "w-12 h-12 rounded-xl border-border/50 transition-all",
                isScreenShareEnabled 
                  ? "bg-green-500/20 border-green-500/50 hover:bg-green-500/30" 
                  : "bg-card hover:bg-card/80"
              )}
            >
              <MonitorUp className={cn(
                "w-5 h-5",
                isScreenShareEnabled && "text-green-500"
              )} />
            </Button>

            {/* Chat toggle */}
            <InCallChat
              room={room}
              participantName={participantName}
              isOpen={showChat}
              onToggle={() => setShowChat(!showChat)}
            />

            {/* Fullscreen toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="w-12 h-12 rounded-xl border-border/50 bg-card hover:bg-card/80"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>

            {/* Leave button */}
            <DisconnectButton className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all">
              <PhoneOff className="w-5 h-5" />
              <span className="text-sm font-medium">Завершить</span>
            </DisconnectButton>
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

export default LiveKitRoom;
