import { useMemo } from 'react';
import { Track, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { VideoTrack, useParticipants, useTracks } from '@livekit/components-react';
import { User, VideoOff, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GalleryVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  speakingParticipant?: string; // identity of speaking participant
}

/**
 * Gallery Video Layout (Grid Mode)
 * - All participants displayed in equal-sized tiles
 * - Adaptive grid: 2 cols for 2-4, 3 cols for 5-9, 4 cols for 10+
 * - Speaking indicator (pulsing border)
 * - Local participant included in grid with "Вы" label
 */
export function GalleryVideoLayout({ 
  localParticipant, 
  isCameraEnabled,
  speakingParticipant,
}: GalleryVideoLayoutProps) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // All participants including local
  const allParticipants = useMemo(() => {
    return participants;
  }, [participants]);

  const participantCount = allParticipants.length;

  // Determine grid columns based on participant count
  const gridCols = useMemo(() => {
    if (participantCount <= 1) return 'grid-cols-1';
    if (participantCount <= 2) return 'grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-3';
    if (participantCount <= 9) return 'grid-cols-3';
    return 'grid-cols-4';
  }, [participantCount]);

  // Determine rows for better aspect ratios
  const gridRows = useMemo(() => {
    if (participantCount <= 2) return 'grid-rows-1';
    if (participantCount <= 4) return 'grid-rows-2';
    if (participantCount <= 6) return 'grid-rows-2';
    return 'auto-rows-fr';
  }, [participantCount]);

  // Get video track for a participant
  const getVideoTrack = (identity: string) => {
    return tracks.find(t => 
      t.participant.identity === identity && 
      t.source === Track.Source.Camera &&
      t.publication
    );
  };

  return (
    <div className="h-full w-full p-4 bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className={cn(
        "grid gap-3 h-full w-full",
        gridCols,
        gridRows
      )}>
        {allParticipants.map((participant) => {
          const isLocal = participant.isLocal;
          const isSpeaking = speakingParticipant === participant.identity;
          const videoTrack = getVideoTrack(participant.identity);
          const hasVideo = videoTrack?.publication && !videoTrack.publication.isMuted;
          const isMuted = !participant.isMicrophoneEnabled;
          
          return (
            <div
              key={participant.identity}
              className={cn(
                "relative rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm border transition-all duration-300",
                isSpeaking 
                  ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]" 
                  : "border-white/10",
                isLocal && "border-primary/30"
              )}
            >
              {/* Video or placeholder */}
              {hasVideo && videoTrack ? (
                <VideoTrack
                  trackRef={{
                    participant: videoTrack.participant,
                    source: videoTrack.source,
                    publication: videoTrack.publication!,
                  }}
                  className={cn(
                    "w-full h-full object-cover",
                    isLocal && "mirror"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <VideoOff className="w-4 h-4" />
                      <span>Камера выкл.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Speaking indicator overlay */}
              {isSpeaking && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-green-500/60 animate-pulse" />
                </div>
              )}

              {/* Bottom info bar */}
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-between">
                  {/* Name */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium text-white truncate max-w-[120px]",
                      isLocal && "text-primary"
                    )}>
                      {isLocal ? 'Вы' : (participant.name || participant.identity)}
                    </span>
                    {isSpeaking && (
                      <div className="flex gap-0.5">
                        {[1,2,3].map(i => (
                          <div 
                            key={i}
                            className="w-0.5 bg-green-500 rounded-full animate-pulse"
                            style={{ 
                              height: `${8 + i * 4}px`,
                              animationDelay: `${i * 100}ms`
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mic indicator */}
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    isMuted ? "bg-destructive/60" : "bg-white/20"
                  )}>
                    {isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Local indicator badge */}
              {isLocal && (
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/80 text-[10px] font-bold text-primary-foreground">
                  ВЫ
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
