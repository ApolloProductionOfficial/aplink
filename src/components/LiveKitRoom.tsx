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
  ConnectionQualityIndicator,
  useLocalParticipant,
  VideoTrack,
  TrackToggle,
  DisconnectButton,
  usePersistentUserChoices,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, Room, RemoteParticipant, VideoPresets, LocalParticipant } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  VideoOff, 
  Maximize2, 
  Minimize2, 
  Settings, 
  Video, 
  Mic, 
  MonitorUp, 
  PhoneOff,
  ChevronUp,
  ChevronDown,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        />
      </LayoutContextProvider>
    </LKRoom>
  );
}

interface LiveKitContentProps {
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onRoomReady?: (room: Room) => void;
}

function LiveKitContent({ onParticipantJoined, onParticipantLeft, onRoomReady }: LiveKitContentProps) {
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
  const [showSettings, setShowSettings] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    // Show top panel when mouse is in top 80px
    if (y < 80) {
      setShowTopPanel(true);
    }
    
    // Show bottom panel when mouse is in bottom 80px
    if (y > height - 80) {
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
  const isCameraEnabled = localParticipant?.isCameraEnabled;
  const isScreenSharing = !!localScreenTrack;

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full livekit-room-container bg-background relative"
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

      {/* Self-view (Picture-in-Picture style) */}
      {isCameraEnabled && localVideoTrack && (
        <div className="absolute bottom-24 right-4 z-50 w-48 h-36 rounded-xl overflow-hidden border-2 border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.3)] bg-black">
          <VideoTrack 
            trackRef={{ 
              participant: localParticipant as LocalParticipant, 
              source: Track.Source.Camera,
              publication: localParticipant?.getTrackPublication(Track.Source.Camera)!
            }} 
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-1 left-2 text-xs text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
            Вы
          </div>
        </div>
      )}

      {/* Screen share self-view (when sharing) */}
      {isScreenSharing && localScreenTrack && (
        <div className="absolute top-24 right-4 z-50 w-64 h-40 rounded-xl overflow-hidden border-2 border-green-500/50 shadow-[0_0_20px_hsl(142,76%,36%,0.3)] bg-black">
          <VideoTrack 
            trackRef={{ 
              participant: localParticipant as LocalParticipant, 
              source: Track.Source.ScreenShare,
              publication: localParticipant?.getTrackPublication(Track.Source.ScreenShare)!
            }} 
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-1 left-2 text-xs text-white/80 bg-black/50 px-1.5 py-0.5 rounded flex items-center gap-1">
            <MonitorUp className="w-3 h-3" />
            Ваш экран
          </div>
        </div>
      )}

      {/* Main video grid */}
      <div className="flex-1 relative overflow-hidden">
        <GridLayout tracks={tracks} className="p-3 gap-3">
          <ParticipantTile className="rounded-xl overflow-hidden animate-cosmic-appear">
            <ConnectionQualityIndicator className="lk-connection-quality" />
          </ParticipantTile>
        </GridLayout>
      </div>

      {/* Bottom Control Bar - auto-hide */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
          showBottomPanel 
            ? "translate-y-0 opacity-100" 
            : "translate-y-full opacity-0 pointer-events-none"
        )}
      >
        <div className="glass-dark border-t border-border/50 p-3">
          <div className="flex items-center justify-center gap-3">
            {/* Camera toggle */}
            <TrackToggle 
              source={Track.Source.Camera}
              className="lk-button flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-card/80 border border-border/50 transition-all"
            >
              <Video className="w-5 h-5" />
            </TrackToggle>

            {/* Mic toggle */}
            <TrackToggle 
              source={Track.Source.Microphone}
              className="lk-button flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-card/80 border border-border/50 transition-all"
            >
              <Mic className="w-5 h-5" />
            </TrackToggle>

            {/* Screen share toggle */}
            <TrackToggle 
              source={Track.Source.ScreenShare}
              className="lk-button flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-card hover:bg-card/80 border border-border/50 transition-all"
            >
              <MonitorUp className="w-5 h-5" />
            </TrackToggle>

            {/* Settings button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "rounded-lg border-border/50",
                showSettings && "bg-primary/20 border-primary/50"
              )}
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* Fullscreen toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="rounded-lg border-border/50"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </Button>

            {/* Leave button */}
            <DisconnectButton className="lk-button flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all">
              <PhoneOff className="w-5 h-5" />
              <span className="text-sm font-medium">Выйти</span>
            </DisconnectButton>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 glass-dark rounded-xl p-4 border border-border/50 min-w-[300px] animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Настройки</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSettings(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Камера</span>
              <TrackToggle 
                source={Track.Source.Camera}
                className="lk-button px-3 py-1.5 rounded-md bg-card hover:bg-card/80 border border-border/50 text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Микрофон</span>
              <TrackToggle 
                source={Track.Source.Microphone}
                className="lk-button px-3 py-1.5 rounded-md bg-card hover:bg-card/80 border border-border/50 text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Демонстрация экрана</span>
              <TrackToggle 
                source={Track.Source.ScreenShare}
                className="lk-button px-3 py-1.5 rounded-md bg-card hover:bg-card/80 border border-border/50 text-sm"
              />
            </div>

            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Полный экран</span>
                <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? 'Выйти' : 'Включить'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RoomAudioRenderer />
    </div>
  );
}

export default LiveKitRoom;
