import { useMemo, useState, useCallback } from 'react';
import { Track, LocalParticipant, RemoteParticipant } from 'livekit-client';
import { VideoTrack, useParticipants, useTracks, TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { User, VideoOff, Mic, MicOff, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DraggablePiP } from '@/components/DraggablePiP';
import { useAudioLevelMeter } from '@/hooks/useAudioLevelMeter';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface FocusVideoLayoutProps {
  localParticipant: LocalParticipant | null;
  isCameraEnabled: boolean;
  isMicrophoneEnabled: boolean;
  showChat: boolean;
  isMaximizing?: boolean;
  speakingParticipant?: string;
  pinnedParticipant?: string;
  onPinParticipant?: (identity: string | null) => void;
}

/**
 * Focus Video Layout
 * - Remote participant fills the entire screen
 * - Local participant appears as a draggable PiP window in the corner
 * - Optimized for 1-on-1 calls
 * - Supports pinning participants
 */
export function FocusVideoLayout({ 
  localParticipant, 
  isCameraEnabled, 
  isMicrophoneEnabled,
  showChat,
  isMaximizing,
  speakingParticipant,
  pinnedParticipant,
  onPinParticipant,
}: FocusVideoLayoutProps) {
  const participants = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // State for swapping main/pip view - store identity instead of boolean
  const [swappedToIdentity, setSwappedToIdentity] = useState<string | null>(null);

  // Get remote participants (exclude local)
  const remoteParticipants = useMemo(() => {
    return participants.filter(p => !p.isLocal) as RemoteParticipant[];
  }, [participants]);

  // Find the main remote participant based on pinned, then video, then first
  const mainRemoteParticipant = useMemo(() => {
    if (remoteParticipants.length === 0) return null;
    
    // Priority 1: Pinned participant (if remote)
    if (pinnedParticipant) {
      const pinned = remoteParticipants.find(p => p.identity === pinnedParticipant);
      if (pinned) return pinned;
    }
    
    // Priority 2: Participant with active video
    const withVideo = remoteParticipants.find(p => {
      const camPub = p.getTrackPublication(Track.Source.Camera);
      return camPub && !camPub.isMuted;
    });
    
    return withVideo || remoteParticipants[0];
  }, [remoteParticipants, pinnedParticipant]);

  // Get screen share tracks
  const screenShareTracks = useMemo(() => {
    return tracks.filter(t => t.source === Track.Source.ScreenShare && t.publication);
  }, [tracks]);

  // Local video track reference - use tracks from hook for reactivity
  const localVideoTrackRef = useMemo(() => {
    if (!localParticipant) return null;
    // First try to find from useTracks (more reactive)
    const fromTracks = tracks.find(t => 
      t.participant.identity === localParticipant.identity && 
      t.source === Track.Source.Camera
    );
    if (fromTracks?.publication) return fromTracks.publication;
    // Fallback to getTrackPublication
    return localParticipant.getTrackPublication(Track.Source.Camera);
  }, [localParticipant, tracks]);
  
  const localVideoTrack = localVideoTrackRef;

  // Remote video track reference
  const remoteVideoTrack = useMemo(() => {
    if (!mainRemoteParticipant) return null;
    return mainRemoteParticipant.getTrackPublication(Track.Source.Camera);
  }, [mainRemoteParticipant]);

  const hasRemoteVideo = remoteVideoTrack && !remoteVideoTrack.isMuted;
  const hasScreenShare = screenShareTracks.length > 0;

  // Determine if view is swapped (check if swapped identity still exists)
  const isSwapped = useMemo(() => {
    if (!swappedToIdentity) return false;
    // Verify the swapped participant still exists
    return participants.some(p => p.identity === swappedToIdentity);
  }, [swappedToIdentity, participants]);

  // Double-click handler to swap main/pip
  const handlePipDoubleClick = useCallback(() => {
    if (mainRemoteParticipant) {
      setSwappedToIdentity(prev => 
        prev === mainRemoteParticipant.identity ? null : mainRemoteParticipant.identity
      );
    }
  }, [mainRemoteParticipant]);

  // Check if participants are speaking
  const isLocalSpeaking = speakingParticipant === localParticipant?.identity;
  const isRemoteSpeaking = speakingParticipant === mainRemoteParticipant?.identity;
  const isRemotePinned = pinnedParticipant === mainRemoteParticipant?.identity;

  // Call-level speaking state (so indicators don't disappear when the local user speaks in PiP)
  const isCallSpeaking = isLocalSpeaking || isRemoteSpeaking;

  // Real-time audio level tracking for equalizer visualization
  const localAudioLevel = useAudioLevelMeter(localParticipant);
  const remoteAudioLevel = useAudioLevelMeter(mainRemoteParticipant);
  
  // Combined audio levels - use whoever is speaking
  const activeAudioLevel = isLocalSpeaking ? localAudioLevel : (isRemoteSpeaking ? remoteAudioLevel : localAudioLevel);
  const hasActiveAudio = activeAudioLevel.isActive || isCallSpeaking;

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
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className={cn(
                  "w-32 h-24 rounded-xl overflow-hidden border-2 shadow-lg bg-black transition-all cursor-pointer group",
                  isRemoteSpeaking ? "border-primary ring-2 ring-primary/50" : "border-white/20",
                  isRemotePinned && "border-primary/50"
                )}>
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
                  {isRemotePinned && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center">
                      <Pin className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-1 left-2 text-[10px] text-white/80 bg-black/40 px-1 rounded">
                    {mainRemoteParticipant.name || mainRemoteParticipant.identity}
                  </div>
                </div>
              </ContextMenuTrigger>
              {onPinParticipant && (
                <ContextMenuContent className="bg-background/95 backdrop-blur-xl border-white/10">
                  <ContextMenuItem onClick={() => onPinParticipant(isRemotePinned ? null : mainRemoteParticipant.identity)}>
                    <Pin className="w-4 h-4 mr-2" />
                    {isRemotePinned ? 'Открепить' : 'Закрепить'}
                  </ContextMenuItem>
                </ContextMenuContent>
              )}
            </ContextMenu>
          )}

          {/* Local participant thumbnail */}
          {isCameraEnabled && localVideoTrack && (
            <div className={cn(
              "w-32 h-24 rounded-xl overflow-hidden border-2 shadow-lg bg-black transition-all",
              isLocalSpeaking ? "border-primary ring-2 ring-primary/50" : "border-primary/50"
            )}>
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

  // Determine what to show in main vs PiP based on swapped state
  const showLocalInMain = isSwapped && mainRemoteParticipant;
  const mainParticipant = showLocalInMain ? localParticipant : mainRemoteParticipant;
  const mainVideoTrack = showLocalInMain ? localVideoTrack : remoteVideoTrack;
  const hasMainVideo = showLocalInMain ? (isCameraEnabled && localVideoTrack) : hasRemoteVideo;
  const isMainSpeaking = showLocalInMain ? isLocalSpeaking : isRemoteSpeaking;
  const isMainPinned = !showLocalInMain && isRemotePinned;

  // Regular 1-on-1 layout: remote fullscreen + local PiP
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Main video - fills entire screen */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br from-background via-background/95 to-primary/5 transition-all call-speaking-frame"
            )}
            data-speaking={isCallSpeaking}
          >
            {mainParticipant && hasMainVideo && mainVideoTrack ? (
              <VideoTrack
                trackRef={{
                  participant: mainParticipant,
                  source: Track.Source.Camera,
                  publication: mainVideoTrack,
                }}
                className={cn(
                  "w-full h-full object-cover",
                  showLocalInMain && "mirror"
                )}
              />
            ) : mainParticipant ? (
              // Participant without video
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className={cn(
                    "w-32 h-32 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border transition-all",
                    isMainSpeaking ? "border-primary ring-4 ring-primary/30" : "border-primary/20"
                  )}>
                    <User className="w-16 h-16 text-muted-foreground" />
                  </div>
                  <div className="text-xl font-medium text-foreground">
                    {showLocalInMain ? 'Вы' : (mainParticipant.name || mainParticipant.identity)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <VideoOff className="w-4 h-4" />
                    <span>Камера отключена</span>
                  </div>
                </div>
              </div>
            ) : (
              // No remote participants yet - show waiting state (single center stack, no overlays)
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                    {/* Subtle slow breathing animation */}
                    <div className="absolute -inset-3 rounded-full border border-primary/10 animate-[pulse_4s_ease-in-out_infinite]" />
                  </div>
                  <div>
                    <div className="text-lg font-medium text-foreground mb-1">Ожидание участника...</div>
                    <div className="text-sm text-muted-foreground">Отправьте ссылку на комнату</div>

                    {!isCameraEnabled && (
                      <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <VideoOff className="w-3.5 h-3.5" />
                        <span>Камера отключена</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        
        {/* Context menu for main video (if it's remote participant) */}
        {!showLocalInMain && mainRemoteParticipant && onPinParticipant && (
          <ContextMenuContent className="bg-background/95 backdrop-blur-xl border-white/10">
            <ContextMenuItem onClick={() => onPinParticipant(isRemotePinned ? null : mainRemoteParticipant.identity)}>
              <Pin className="w-4 h-4 mr-2" />
              {isRemotePinned ? 'Открепить' : 'Закрепить'}
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Pin indicator for main view */}
      {isMainPinned && (
        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center z-20">
          <Pin className="w-4 h-4 text-primary-foreground" />
        </div>
      )}

      {/* Audio glow aura - soft pulsing orbs instead of hard bars */}
      {/* Left side glow */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 pointer-events-none z-10 transition-all duration-700 ease-out",
          hasActiveAudio ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: `${Math.min(250, Math.max(80, activeAudioLevel.level * 600))}px`,
        }}
      >
        {/* Multiple layered glowing orbs for organic feel */}
        <div 
          className="absolute top-[15%] -left-20 rounded-full bg-primary/40 blur-[80px] transition-all duration-300"
          style={{
            width: `${Math.min(200, Math.max(60, activeAudioLevel.level * 500))}px`,
            height: `${Math.min(200, Math.max(60, activeAudioLevel.level * 500))}px`,
            opacity: Math.min(0.8, activeAudioLevel.level * 2),
          }}
        />
        <div 
          className="absolute top-[45%] -left-16 rounded-full bg-cyan-400/30 blur-[60px] transition-all duration-200"
          style={{
            width: `${Math.min(160, Math.max(40, activeAudioLevel.level * 400))}px`,
            height: `${Math.min(160, Math.max(40, activeAudioLevel.level * 400))}px`,
            opacity: Math.min(0.7, activeAudioLevel.level * 1.8),
          }}
        />
        <div 
          className="absolute top-[70%] -left-24 rounded-full bg-primary/35 blur-[100px] transition-all duration-400"
          style={{
            width: `${Math.min(180, Math.max(50, activeAudioLevel.level * 450))}px`,
            height: `${Math.min(180, Math.max(50, activeAudioLevel.level * 450))}px`,
            opacity: Math.min(0.6, activeAudioLevel.level * 1.5),
          }}
        />
        {/* Accent glow for variety */}
        <div 
          className="absolute top-[30%] -left-10 rounded-full bg-teal-300/25 blur-[50px] transition-all duration-250"
          style={{
            width: `${Math.min(100, Math.max(30, activeAudioLevel.level * 300))}px`,
            height: `${Math.min(100, Math.max(30, activeAudioLevel.level * 300))}px`,
            opacity: Math.min(0.5, activeAudioLevel.level * 1.2),
          }}
        />
      </div>

      {/* Right side glow */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 pointer-events-none z-10 transition-all duration-700 ease-out",
          hasActiveAudio ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: `${Math.min(250, Math.max(80, activeAudioLevel.level * 600))}px`,
        }}
      >
        {/* Multiple layered glowing orbs for organic feel */}
        <div 
          className="absolute top-[20%] -right-20 rounded-full bg-primary/40 blur-[80px] transition-all duration-350"
          style={{
            width: `${Math.min(200, Math.max(60, activeAudioLevel.level * 500))}px`,
            height: `${Math.min(200, Math.max(60, activeAudioLevel.level * 500))}px`,
            opacity: Math.min(0.8, activeAudioLevel.level * 2),
          }}
        />
        <div 
          className="absolute top-[50%] -right-16 rounded-full bg-cyan-400/30 blur-[60px] transition-all duration-200"
          style={{
            width: `${Math.min(160, Math.max(40, activeAudioLevel.level * 400))}px`,
            height: `${Math.min(160, Math.max(40, activeAudioLevel.level * 400))}px`,
            opacity: Math.min(0.7, activeAudioLevel.level * 1.8),
          }}
        />
        <div 
          className="absolute top-[75%] -right-24 rounded-full bg-primary/35 blur-[100px] transition-all duration-450"
          style={{
            width: `${Math.min(180, Math.max(50, activeAudioLevel.level * 450))}px`,
            height: `${Math.min(180, Math.max(50, activeAudioLevel.level * 450))}px`,
            opacity: Math.min(0.6, activeAudioLevel.level * 1.5),
          }}
        />
        {/* Accent glow for variety */}
        <div 
          className="absolute top-[60%] -right-10 rounded-full bg-teal-300/25 blur-[50px] transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(30, activeAudioLevel.level * 300))}px`,
            height: `${Math.min(100, Math.max(30, activeAudioLevel.level * 300))}px`,
            opacity: Math.min(0.5, activeAudioLevel.level * 1.2),
          }}
        />
      </div>

      {/* PiP - Draggable local participant in corner - ALWAYS show */}
      {!showChat && localParticipant && (
        <DraggablePiP
          storageKey="local-pip-position"
          snapToCorners={true}
          onDoubleClick={mainRemoteParticipant ? handlePipDoubleClick : undefined}
          initialCorner="bottom-right"
          bottomOffset={112}
          className="pip-speaking-glow"
          data-speaking={showLocalInMain ? isRemoteSpeaking : isLocalSpeaking}
        >
          {/* PiP content */}
          {mainRemoteParticipant ? (
            // Normal case: show either local or remote in PiP based on swap
            (() => {
              const showVideo = showLocalInMain 
                ? hasRemoteVideo 
                : (localVideoTrack && !localVideoTrack.isMuted);
              const trackToShow = showLocalInMain ? remoteVideoTrack : localVideoTrack;
              
              return showVideo && trackToShow ? (
                <VideoTrack
                  trackRef={{
                    participant: showLocalInMain ? mainRemoteParticipant as RemoteParticipant : localParticipant as LocalParticipant,
                    source: Track.Source.Camera,
                    publication: trackToShow,
                  }}
                  className={cn(
                    "w-full h-full object-cover",
                    !showLocalInMain && "mirror"
                  )}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              );
            })()
          ) : (
            // Solo case: show self in PiP - check track exists and not muted
            (() => {
              const hasLocalVideo = localVideoTrack && !localVideoTrack.isMuted;
              
              return hasLocalVideo ? (
                <VideoTrack
                  trackRef={{
                    participant: localParticipant as LocalParticipant,
                    source: Track.Source.Camera,
                    publication: localVideoTrack,
                  }}
                  className="w-full h-full object-cover mirror"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                  <User className="w-8 h-8 text-muted-foreground" />
                </div>
              );
            })()
          )}
          
          {/* PiP label */}
          <div className="absolute bottom-1.5 left-2.5 text-xs text-white/90 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm">
            {mainRemoteParticipant 
              ? (showLocalInMain 
                  ? (mainRemoteParticipant?.name || mainRemoteParticipant?.identity) 
                  : 'Вы')
              : 'Вы'
            }
          </div>
          
          {/* Mic status indicator - use prop for local, property for remote */}
          {(() => {
            // Determine whose mic status to show
            const isShowingLocal = !mainRemoteParticipant || !showLocalInMain;
            const micEnabled = isShowingLocal 
              ? isMicrophoneEnabled 
              : (mainRemoteParticipant?.isMicrophoneEnabled ?? false);
            
            return (
              <div className={cn(
                "absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center",
                micEnabled ? "bg-primary/60" : "bg-destructive/60"
              )}>
                {micEnabled ? (
                  <Mic className="w-3 h-3 text-white" />
                ) : (
                  <MicOff className="w-3 h-3 text-white" />
                )}
              </div>
            );
          })()}
        </DraggablePiP>
      )}

      {/* Hint for double-click swap */}
      {mainRemoteParticipant && (
        <div className="absolute bottom-28 left-4 text-[10px] text-white/40 bg-black/20 px-2 py-1 rounded-md backdrop-blur-sm z-10">
          Двойной клик на PiP — поменять местами
        </div>
      )}
    </div>
  );
}
