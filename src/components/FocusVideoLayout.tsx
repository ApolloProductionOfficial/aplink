import { useMemo } from 'react';
import { Track, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { VideoTrack, useParticipants, useTracks, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { User, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FocusVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  showChat: boolean;
  isMaximizing?: boolean;
}

/**
 * Focus Video Layout
 * - Remote participant fills the entire screen
 * - Local participant appears as a small PiP window in the corner
 * - Optimized for 1-on-1 calls
 */
export function FocusVideoLayout({ 
  localParticipant, 
  isCameraEnabled, 
  showChat,
  isMaximizing 
}: FocusVideoLayoutProps) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Get remote participants (exclude local)
  const remoteParticipants = useMemo(() => {
    return participants.filter(p => !p.isLocal) as RemoteParticipant[];
  }, [participants]);

  // Find the main remote participant (first one with video, or just first one)
  const mainRemoteParticipant = useMemo(() => {
    if (remoteParticipants.length === 0) return null;
    
    // Prefer participant with active video
    const withVideo = remoteParticipants.find(p => {
      const camPub = p.getTrackPublication(Track.Source.Camera);
      return camPub && !camPub.isMuted;
    });
    
    return withVideo || remoteParticipants[0];
  }, [remoteParticipants]);

  // Get screen share tracks
  const screenShareTracks = useMemo(() => {
    return tracks.filter(t => t.source === Track.Source.ScreenShare && t.publication);
  }, [tracks]);

  // Local video track reference
  const localVideoTrack = useMemo(() => {
    if (!localParticipant) return null;
    return localParticipant.getTrackPublication(Track.Source.Camera);
  }, [localParticipant]);

  // Remote video track reference
  const remoteVideoTrack = useMemo(() => {
    if (!mainRemoteParticipant) return null;
    return mainRemoteParticipant.getTrackPublication(Track.Source.Camera);
  }, [mainRemoteParticipant]);

  const hasRemoteVideo = remoteVideoTrack && !remoteVideoTrack.isMuted;
  const hasScreenShare = screenShareTracks.length > 0;

  // If screen share is active - show screen share layout
  if (hasScreenShare) {
    const screenTrack = screenShareTracks[0];
    // Only render if we have a valid publication
    if (!screenTrack.publication) return null;
    
    return (
      <div className="relative h-full w-full">
        {/* Full screen share */}
        <div className="absolute inset-0 bg-black">
          <VideoTrack
            trackRef={{
              participant: screenTrack.participant,
              source: screenTrack.source,
              publication: screenTrack.publication,
            }}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Participants strip on the right */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30">
          {/* Remote participant thumbnail */}
          {mainRemoteParticipant && (
            <div className="w-32 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg bg-black">
              {hasRemoteVideo ? (
                <VideoTrack
                  trackRef={{
                    participant: mainRemoteParticipant,
                    source: Track.Source.Camera,
                    publication: remoteVideoTrack!,
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/40 px-1 rounded">
                {mainRemoteParticipant.name || mainRemoteParticipant.identity}
              </div>
            </div>
          )}

          {/* Local participant thumbnail */}
          {isCameraEnabled && localVideoTrack && (
            <div className="w-32 h-24 rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg bg-black">
              <VideoTrack
                trackRef={{
                  participant: localParticipant as LocalParticipant,
                  source: Track.Source.Camera,
                  publication: localVideoTrack,
                }}
                className="w-full h-full object-cover mirror"
              />
              <div className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/40 px-1 rounded">
                Вы
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular 1-on-1 layout: remote fullscreen + local PiP
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Main video - Remote participant fills entire screen */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-primary/5">
        {mainRemoteParticipant && hasRemoteVideo ? (
          <VideoTrack
            trackRef={{
              participant: mainRemoteParticipant,
              source: Track.Source.Camera,
              publication: remoteVideoTrack!,
            }}
            className="w-full h-full object-cover"
          />
        ) : mainRemoteParticipant ? (
          // Remote participant without video
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
                <User className="w-16 h-16 text-muted-foreground" />
              </div>
              <div className="text-xl font-medium text-foreground">
                {mainRemoteParticipant.name || mainRemoteParticipant.identity}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <VideoOff className="w-4 h-4" />
                <span>Камера отключена</span>
              </div>
            </div>
          </div>
        ) : (
          // No remote participants yet - show waiting state
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center animate-pulse">
                  <User className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="absolute -inset-2 rounded-full border border-primary/20 animate-[ping_2s_ease-out_infinite]" />
              </div>
              <div>
                <div className="text-lg font-medium text-foreground mb-1">Ожидание участника...</div>
                <div className="text-sm text-muted-foreground">Отправьте ссылку на комнату</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PiP - Local participant in corner */}
      {isCameraEnabled && localVideoTrack && !showChat && (
        <div 
          className={cn(
            "absolute z-40 rounded-xl overflow-hidden border-2 border-primary/50 shadow-[0_0_25px_hsl(var(--primary)/0.35)] bg-black transition-all duration-300",
            // Larger PiP when alone, smaller when remote present
            mainRemoteParticipant 
              ? "bottom-28 right-4 w-44 h-32" 
              : "bottom-28 right-4 w-64 h-48"
          )}
        >
          <VideoTrack
            trackRef={{
              participant: localParticipant as LocalParticipant,
              source: Track.Source.Camera,
              publication: localVideoTrack,
            }}
            className="w-full h-full object-cover mirror"
          />
          <div className="absolute bottom-1.5 left-2.5 text-xs text-white/90 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm">
            Вы
          </div>
        </div>
      )}

      {/* Show self fullscreen when alone and no camera */}
      {!mainRemoteParticipant && !isCameraEnabled && localParticipant && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
            <div className="text-xl font-medium text-foreground">
              {localParticipant.name || localParticipant.identity}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <VideoOff className="w-4 h-4" />
              <span>Камера отключена</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
