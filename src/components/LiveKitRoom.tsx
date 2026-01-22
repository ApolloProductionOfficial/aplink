import { useEffect, useState, useCallback } from "react";
import {
  LiveKitRoom as LKRoom,
  RoomAudioRenderer,
  ControlBar,
  useRoomContext,
  useTracks,
  useParticipants,
  GridLayout,
  ParticipantTile,
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
  usePinnedTracks,
  LayoutContextProvider,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent } from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Video, VideoOff, Mic, MicOff, MonitorUp, Phone, Settings } from "lucide-react";

interface LiveKitRoomProps {
  roomName: string;
  participantName: string;
  participantIdentity?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onError?: (error: Error) => void;
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
        publishDefaults: {
          simulcast: true,
        },
      }}
      style={{ height: "100%" }}
    >
      <LiveKitContent
        onParticipantJoined={onParticipantJoined}
        onParticipantLeft={onParticipantLeft}
      />
    </LKRoom>
  );
}

interface LiveKitContentProps {
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
}

function LiveKitContent({ onParticipantJoined, onParticipantLeft }: LiveKitContentProps) {
  const room = useRoomContext();
  const participants = useParticipants();

  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: any) => {
      console.log("[LiveKitRoom] Participant joined:", participant.identity, participant.name);
      onParticipantJoined?.(participant.identity, participant.name || participant.identity);
    };

    const handleParticipantDisconnected = (participant: any) => {
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

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const pinnedTracks = usePinnedTracks();
  const hasPinned = pinnedTracks.length > 0;

  return (
    <LayoutContextProvider>
      <div className="flex flex-col h-full livekit-room-container bg-background">
        <div className="flex-1 relative overflow-hidden">
          {hasPinned ? (
            <FocusLayoutContainer>
              <FocusLayout trackRef={pinnedTracks[0]} />
              <CarouselLayout tracks={tracks.filter(t => !pinnedTracks.includes(t))}>
                <ParticipantTile />
              </CarouselLayout>
            </FocusLayoutContainer>
          ) : (
            <GridLayout tracks={tracks} className="p-3 gap-3">
              <ParticipantTile className="rounded-xl overflow-hidden" />
            </GridLayout>
          )}
        </div>
        <ControlBar 
          variation="minimal" 
          controls={{
            camera: true,
            microphone: true,
            screenShare: true,
            leave: true,
            chat: false,
            settings: true,
          }}
          className="glass-dark border-t border-border/50"
        />
        <RoomAudioRenderer />
      </div>
    </LayoutContextProvider>
  );
}

export default LiveKitRoom;
