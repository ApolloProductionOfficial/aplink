import { useMemo } from 'react';
import { Track, LocalParticipant, RemoteParticipant, Participant } from 'livekit-client';
import { VideoTrack, useParticipants, useTracks } from '@livekit/components-react';
import { User, VideoOff, Mic, MicOff, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface WebinarVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  speakingParticipant?: string;
  pinnedParticipant?: string;
  onPinParticipant?: (identity: string | null) => void;
}

/**
 * Webinar Video Layout
 * - One large speaker taking ~80% of the screen
 * - Horizontal strip of viewers at the bottom with scroll
 * - Speaker priority: pinned → speaking → first remote
 */
export function WebinarVideoLayout({
  localParticipant,
  isCameraEnabled,
  speakingParticipant,
  pinnedParticipant,
  onPinParticipant,
}: WebinarVideoLayoutProps) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  // Get remote participants
  const remoteParticipants = useMemo(() => {
    return participants.filter(p => !p.isLocal) as RemoteParticipant[];
  }, [participants]);

  // Determine who is the speaker (main video)
  const speaker = useMemo((): Participant | null => {
    // Priority 1: Pinned participant
    if (pinnedParticipant) {
      const pinned = participants.find(p => p.identity === pinnedParticipant);
      if (pinned) return pinned;
    }

    // Priority 2: Currently speaking participant (prefer remote)
    if (speakingParticipant) {
      const speaking = remoteParticipants.find(p => p.identity === speakingParticipant);
      if (speaking) return speaking;
    }

    // Priority 3: First remote participant with video
    const withVideo = remoteParticipants.find(p => {
      const camPub = p.getTrackPublication(Track.Source.Camera);
      return camPub && !camPub.isMuted;
    });
    if (withVideo) return withVideo;

    // Priority 4: First remote participant
    if (remoteParticipants.length > 0) return remoteParticipants[0];

    // Priority 5: Local participant (solo mode)
    return localParticipant;
  }, [participants, remoteParticipants, pinnedParticipant, speakingParticipant, localParticipant]);

  // Get viewers (everyone except the speaker)
  const viewers = useMemo(() => {
    return participants.filter(p => p.identity !== speaker?.identity);
  }, [participants, speaker]);

  // Get video track for a participant
  const getVideoTrack = (identity: string) => {
    return tracks.find(t => 
      t.participant.identity === identity && 
      t.source === Track.Source.Camera &&
      t.publication
    );
  };

  const speakerTrack = speaker ? getVideoTrack(speaker.identity) : null;
  const hasSpeakerVideo = speakerTrack?.publication && !speakerTrack.publication.isMuted;
  const isSpeakerSpeaking = speakingParticipant === speaker?.identity;
  const isSpeakerPinned = pinnedParticipant === speaker?.identity;
  const isSpeakerLocal = speaker?.isLocal;

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Main Speaker Area - 80% of height */}
      <div className="flex-1 relative min-h-0 p-4 pb-2">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className={cn(
              "h-full w-full rounded-2xl overflow-hidden relative bg-black/40 backdrop-blur-sm border transition-all",
              isSpeakerSpeaking 
                ? "ring-2 ring-green-500 ring-offset-2 ring-offset-background border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]" 
                : "border-white/10",
              isSpeakerPinned && "border-primary/50"
            )}>
              {/* Speaker video */}
              {speaker && hasSpeakerVideo && speakerTrack?.publication ? (
                <VideoTrack
                  trackRef={{
                    participant: speakerTrack.participant,
                    source: speakerTrack.source,
                    publication: speakerTrack.publication,
                  }}
                  className={cn(
                    "w-full h-full object-cover",
                    isSpeakerLocal && "mirror"
                  )}
                />
              ) : speaker ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  <div className="flex flex-col items-center gap-4">
                    <div className={cn(
                      "w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center border transition-all",
                      isSpeakerSpeaking ? "border-green-500 ring-4 ring-green-500/30" : "border-primary/30"
                    )}>
                      <User className="w-16 h-16 text-muted-foreground" />
                    </div>
                    <div className="text-xl font-medium text-foreground">
                      {isSpeakerLocal ? 'Вы' : (speaker.name || speaker.identity)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <VideoOff className="w-4 h-4" />
                      <span>Камера отключена</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center animate-pulse">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <div className="text-lg font-medium text-foreground">Ожидание спикера...</div>
                  </div>
                </div>
              )}

              {/* Speaker label */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-full bg-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1.5">
                  <span>🎤</span>
                  <span>СПИКЕР</span>
                </div>
                {isSpeakerPinned && (
                  <div className="w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center">
                    <Pin className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Speaking indicator */}
              {isSpeakerSpeaking && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/40">
                  <div className="flex gap-0.5">
                    {[1,2,3].map(i => (
                      <div 
                        key={i}
                        className="w-0.5 bg-green-500 rounded-full animate-pulse"
                        style={{ 
                          height: `${6 + i * 3}px`,
                          animationDelay: `${i * 100}ms`
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-green-400 font-medium">Говорит</span>
                </div>
              )}

              {/* Bottom info bar */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-white">
                      {isSpeakerLocal ? 'Вы' : (speaker?.name || speaker?.identity || 'Спикер')}
                    </span>
                  </div>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    speaker && !speaker.isMicrophoneEnabled ? "bg-destructive/60" : "bg-white/20"
                  )}>
                    {speaker && !speaker.isMicrophoneEnabled ? (
                      <MicOff className="w-4 h-4 text-white" />
                    ) : (
                      <Mic className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ContextMenuTrigger>
          
          {speaker && !speaker.isLocal && onPinParticipant && (
            <ContextMenuContent className="bg-background/95 backdrop-blur-xl border-white/10">
              <ContextMenuItem onClick={() => onPinParticipant(isSpeakerPinned ? null : speaker.identity)}>
                <Pin className="w-4 h-4 mr-2" />
                {isSpeakerPinned ? 'Открепить' : 'Закрепить как спикера'}
              </ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
      </div>

      {/* Viewers Strip - 20% of height */}
      {viewers.length > 0 && (
        <div className="h-[120px] px-4 pb-4">
          <ScrollArea className="w-full h-full">
            <div className="flex gap-3 h-full pb-2">
              {viewers.map((viewer) => {
                const viewerTrack = getVideoTrack(viewer.identity);
                const hasVideo = viewerTrack?.publication && !viewerTrack.publication.isMuted;
                const isSpeaking = speakingParticipant === viewer.identity;
                const isPinned = pinnedParticipant === viewer.identity;
                const isLocal = viewer.isLocal;
                const isMuted = !viewer.isMicrophoneEnabled;

                return (
                  <ContextMenu key={viewer.identity}>
                    <ContextMenuTrigger asChild>
                      <div 
                        className={cn(
                          "flex-shrink-0 w-[160px] h-full rounded-xl overflow-hidden relative bg-black/40 backdrop-blur-sm border transition-all cursor-pointer hover:border-white/30",
                          isSpeaking 
                            ? "ring-2 ring-green-500/60 border-green-500/50" 
                            : "border-white/10",
                          isPinned && "border-primary/50",
                          isLocal && "border-primary/30"
                        )}
                        onClick={() => !isLocal && onPinParticipant?.(isPinned ? null : viewer.identity)}
                      >
                        {/* Video or placeholder */}
                        {hasVideo && viewerTrack?.publication ? (
                          <VideoTrack
                            trackRef={{
                              participant: viewerTrack.participant,
                              source: viewerTrack.source,
                              publication: viewerTrack.publication,
                            }}
                            className={cn(
                              "w-full h-full object-cover",
                              isLocal && "mirror"
                            )}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}

                        {/* Pin indicator */}
                        {isPinned && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center">
                            <Pin className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}

                        {/* Speaking indicator */}
                        {isSpeaking && (
                          <div className="absolute top-1.5 left-1.5 flex gap-0.5">
                            {[1,2,3].map(i => (
                              <div 
                                key={i}
                                className="w-0.5 bg-green-500 rounded-full animate-pulse"
                                style={{ 
                                  height: `${4 + i * 2}px`,
                                  animationDelay: `${i * 100}ms`
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Bottom info */}
                        <div className="absolute bottom-0 inset-x-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[10px] font-medium text-white truncate max-w-[100px]",
                              isLocal && "text-primary"
                            )}>
                              {isLocal ? 'Вы' : (viewer.name || viewer.identity)}
                            </span>
                            <div className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center",
                              isMuted ? "bg-destructive/60" : "bg-white/20"
                            )}>
                              {isMuted ? (
                                <MicOff className="w-2 h-2 text-white" />
                              ) : (
                                <Mic className="w-2 h-2 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    
                    {!isLocal && onPinParticipant && (
                      <ContextMenuContent className="bg-background/95 backdrop-blur-xl border-white/10">
                        <ContextMenuItem onClick={() => onPinParticipant(isPinned ? null : viewer.identity)}>
                          <Pin className="w-4 h-4 mr-2" />
                          {isPinned ? 'Открепить' : 'Закрепить как спикера'}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  </ContextMenu>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
