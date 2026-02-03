import { useMemo } from 'react';
import { Track, LocalParticipant, RemoteParticipant, ConnectionQuality } from 'livekit-client';
import { VideoTrack, useParticipants, useTracks } from '@livekit/components-react';
import { User, VideoOff, Mic, MicOff, Pin, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/** Get color class for connection quality indicator */
const getConnectionColor = (quality: ConnectionQuality) => {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]';
    case ConnectionQuality.Good:
      return 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.6)]';
    case ConnectionQuality.Poor:
      return 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse';
    default:
      return 'bg-gray-500';
  }
};

/** Get text label for connection quality */
const getConnectionLabel = (quality: ConnectionQuality) => {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'Отличная связь';
    case ConnectionQuality.Good:
      return 'Хорошая связь';
    case ConnectionQuality.Poor:
      return 'Плохая связь';
    default:
      return 'Проверка связи...';
  }
};

interface GalleryVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  speakingParticipant?: string;
  pinnedParticipant?: string;
  onPinParticipant?: (identity: string | null) => void;
}

/**
 * Gallery Video Layout (Grid Mode)
 * - All participants displayed in equal-sized tiles
 * - Adaptive grid: 2 cols for 2-4, 3 cols for 5-9, 4 cols for 10+
 * - Speaking indicator (pulsing border)
 * - Local participant included in grid with "Вы" label
 * - Pin participant with context menu or hover button
 */
export function GalleryVideoLayout({ 
  localParticipant, 
  isCameraEnabled,
  speakingParticipant,
  pinnedParticipant,
  onPinParticipant,
}: GalleryVideoLayoutProps) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // All participants - pinned first, then others
  const sortedParticipants = useMemo(() => {
    const sorted = [...participants];
    if (pinnedParticipant) {
      sorted.sort((a, b) => {
        if (a.identity === pinnedParticipant) return -1;
        if (b.identity === pinnedParticipant) return 1;
        return 0;
      });
    }
    return sorted;
  }, [participants, pinnedParticipant]);

  const participantCount = sortedParticipants.length;

  // Determine grid columns based on participant count - mobile responsive
  const gridCols = useMemo(() => {
    if (participantCount <= 1) return 'grid-cols-1';
    if (participantCount <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (participantCount <= 4) return 'grid-cols-2';
    if (participantCount <= 6) return 'grid-cols-2 md:grid-cols-3';
    if (participantCount <= 9) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }, [participantCount]);

  // Determine rows for better aspect ratios
  const gridRows = useMemo(() => {
    if (participantCount <= 2) return 'grid-rows-1 sm:grid-rows-1';
    if (participantCount <= 4) return 'grid-rows-2';
    if (participantCount <= 6) return 'grid-rows-2 md:grid-rows-2';
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
    <div className="h-full w-full p-2 sm:p-4 bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className={cn(
        "grid gap-2 sm:gap-3 h-full w-full",
        gridCols,
        gridRows
      )}>
        {sortedParticipants.map((participant) => {
          const isLocal = participant.isLocal;
          const isSpeaking = speakingParticipant === participant.identity;
          const isPinned = pinnedParticipant === participant.identity;
          const videoTrack = getVideoTrack(participant.identity);
          const hasVideo = videoTrack?.publication && !videoTrack.publication.isMuted;
          const isMuted = !participant.isMicrophoneEnabled;
          
          return (
            <ContextMenu key={participant.identity}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    "relative rounded-2xl overflow-hidden bg-black/40 backdrop-blur-sm border transition-all duration-300 group",
                    isSpeaking 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary/50 shadow-[0_0_30px_hsl(var(--primary)/0.3)]" 
                      : "border-white/10",
                    isPinned && "border-primary/50 ring-1 ring-primary/30",
                    isLocal && !isPinned && "border-primary/30"
                  )}
                >
                  {/* Video or placeholder */}
                  {hasVideo && videoTrack?.publication ? (
                    <VideoTrack
                      trackRef={{
                        participant: videoTrack.participant,
                        source: videoTrack.source,
                        publication: videoTrack.publication,
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

                  {/* Connection quality indicator - just a colored dot with tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="absolute top-2 left-2 flex items-center justify-center w-5 h-5 rounded-full bg-black/50 backdrop-blur-sm z-10 cursor-help"
                        title={getConnectionLabel(participant.connectionQuality)}
                      >
                        <div className={cn("w-2.5 h-2.5 rounded-full transition-all", getConnectionColor(participant.connectionQuality))} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-black/80 border-white/10">
                      <div className="flex items-center gap-2">
                        {participant.connectionQuality === ConnectionQuality.Poor ? (
                          <WifiOff className="w-4 h-4 text-red-400" />
                        ) : (
                          <Wifi className="w-4 h-4 text-green-400" />
                        )}
                        <span>{getConnectionLabel(participant.connectionQuality)}</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  {/* Pin indicator */}
                  {isPinned && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center z-10">
                      <Pin className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}

                  {/* Pin button on hover (for non-local participants) */}
                  {!isLocal && onPinParticipant && !isPinned && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinParticipant(participant.identity);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/80"
                      title="Закрепить"
                    >
                      <Pin className="w-3 h-3 text-white" />
                    </button>
                  )}

                  {/* Speaking indicator overlay */}
                  {isSpeaking && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/60 animate-pulse" />
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
                                className="w-0.5 bg-primary rounded-full animate-pulse"
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
              </ContextMenuTrigger>
              
              {/* Context menu for non-local participants */}
              {!isLocal && onPinParticipant && (
                <ContextMenuContent className="bg-background/95 backdrop-blur-xl border-white/10">
                  <ContextMenuItem onClick={() => onPinParticipant(isPinned ? null : participant.identity)}>
                    <Pin className="w-4 h-4 mr-2" />
                    {isPinned ? 'Открепить' : 'Закрепить'}
                  </ContextMenuItem>
                </ContextMenuContent>
              )}
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
}
