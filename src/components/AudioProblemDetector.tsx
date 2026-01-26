import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, LocalParticipant, RemoteParticipant, Track, LocalTrackPublication, RemoteTrackPublication } from 'livekit-client';
import { AlertTriangle, MicOff, Volume2, VolumeX, Volume1 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AudioProblemDetectorProps {
  room: Room | null;
  localParticipant: LocalParticipant | null;
}

interface AudioIssue {
  type: 'mic_muted' | 'mic_no_signal' | 'remote_muted' | 'low_volume';
  participantName?: string;
  severity: 'warning' | 'error';
}

export function AudioProblemDetector({ room, localParticipant }: AudioProblemDetectorProps) {
  const [issues, setIssues] = useState<AudioIssue[]>([]);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastWarningTimeRef = useRef<{ [key: string]: number }>({});
  
  // Minimum interval between same warnings (ms)
  const WARNING_COOLDOWN = 30000;

  // Check if we should show warning (prevent spam)
  const shouldShowWarning = (key: string): boolean => {
    const now = Date.now();
    const lastTime = lastWarningTimeRef.current[key] || 0;
    if (now - lastTime < WARNING_COOLDOWN) {
      return false;
    }
    lastWarningTimeRef.current[key] = now;
    return true;
  };

  // Analyze local microphone audio level
  useEffect(() => {
    if (!localParticipant || !room) return;

    const checkLocalMic = async () => {
      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone) as LocalTrackPublication | undefined;
      
      if (!micPub || micPub.isMuted) {
        // Mic is muted - check if talking attempt
        return;
      }

      const track = micPub.track;
      if (!track) return;

      const mediaStreamTrack = track.mediaStreamTrack;
      if (!mediaStreamTrack) return;

      try {
        // Create audio context for level analysis
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const audioContext = audioContextRef.current;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        const stream = new MediaStream([mediaStreamTrack]);
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        analyserRef.current = analyser;
        setIsAnalyzing(true);

        // Monitor audio levels
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let silentFrames = 0;
        const SILENT_THRESHOLD = 10;
        const SILENT_FRAMES_WARNING = 150; // ~5 seconds at 30fps

        const checkLevel = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setLocalAudioLevel(average);

          if (average < SILENT_THRESHOLD) {
            silentFrames++;
            if (silentFrames >= SILENT_FRAMES_WARNING) {
              // Mic might not be working
              if (shouldShowWarning('mic_no_signal')) {
                setIssues(prev => {
                  const filtered = prev.filter(i => i.type !== 'mic_no_signal');
                  return [...filtered, { type: 'mic_no_signal', severity: 'warning' }];
                });
              }
            }
          } else {
            silentFrames = 0;
            setIssues(prev => prev.filter(i => i.type !== 'mic_no_signal'));
          }

          requestAnimationFrame(checkLevel);
        };

        checkLevel();
      } catch (err) {
        console.error('[AudioProblemDetector] Failed to analyze audio:', err);
      }
    };

    checkLocalMic();

    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setIsAnalyzing(false);
    };
  }, [localParticipant, room]);

  // Monitor local mic mute state and detect if user tries to talk
  useEffect(() => {
    if (!localParticipant) return;

    const checkMicMuted = () => {
      const micPub = localParticipant.getTrackPublication(Track.Source.Microphone) as LocalTrackPublication | undefined;
      
      if (!micPub || micPub.isMuted) {
        // Set mic muted warning after delay
        const timer = setTimeout(() => {
          if (shouldShowWarning('mic_muted_hint')) {
            setIssues(prev => {
              if (!prev.find(i => i.type === 'mic_muted')) {
                return [...prev, { type: 'mic_muted', severity: 'warning' }];
              }
              return prev;
            });
          }
        }, 10000); // Show after 10 seconds of being muted
        
        return () => clearTimeout(timer);
      } else {
        setIssues(prev => prev.filter(i => i.type !== 'mic_muted'));
      }
    };

    checkMicMuted();

    const handleMuteChanged = () => checkMicMuted();
    localParticipant.on('trackMuted', handleMuteChanged);
    localParticipant.on('trackUnmuted', handleMuteChanged);

    return () => {
      localParticipant.off('trackMuted', handleMuteChanged);
      localParticipant.off('trackUnmuted', handleMuteChanged);
    };
  }, [localParticipant]);

  // Monitor remote participants' audio
  useEffect(() => {
    if (!room) return;

    const checkRemoteAudio = () => {
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      
      remoteParticipants.forEach((participant: RemoteParticipant) => {
        const audioPub = participant.getTrackPublication(Track.Source.Microphone) as RemoteTrackPublication | undefined;
        
        if (audioPub && audioPub.isMuted) {
          // Remote participant's mic is muted for a while
          const key = `remote_muted_${participant.identity}`;
          if (shouldShowWarning(key)) {
            toast.info(
              <div className="flex items-center gap-3">
                <MicOff className="w-5 h-5 text-yellow-500" />
                <div>
                  <div className="font-medium">{participant.name || participant.identity}</div>
                  <div className="text-xs text-muted-foreground">Микрофон отключён</div>
                </div>
              </div>,
              { duration: 5000 }
            );
          }
        }
      });
    };

    // Check periodically
    const interval = setInterval(checkRemoteAudio, 15000);

    // Also check on track events
    const handleTrackMuted = (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (pub.source === Track.Source.Microphone) {
        console.log('[AudioProblemDetector] Remote participant muted:', participant.name);
      }
    };

    room.on(RoomEvent.TrackMuted, handleTrackMuted as any);

    return () => {
      clearInterval(interval);
      room.off(RoomEvent.TrackMuted, handleTrackMuted as any);
    };
  }, [room]);

  // Dismiss a specific issue
  const dismissIssue = (type: AudioIssue['type']) => {
    setIssues(prev => prev.filter(i => i.type !== type));
  };

  // Don't render if no issues
  if (issues.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[99990] flex flex-col gap-2 pointer-events-auto">
      {issues.map((issue) => (
        <div
          key={issue.type}
          className={cn(
            "flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border animate-fade-in cursor-pointer transition-all hover:scale-[1.02]",
            issue.severity === 'error'
              ? "bg-destructive/90 border-destructive/50 text-destructive-foreground"
              : "bg-yellow-500/90 border-yellow-400/50 text-yellow-950"
          )}
          onClick={() => dismissIssue(issue.type)}
          title="Нажмите, чтобы скрыть"
        >
          {issue.type === 'mic_muted' && (
            <>
              <MicOff className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Ваш микрофон отключён</div>
                <div className="text-xs opacity-80">Другие участники вас не слышат</div>
              </div>
            </>
          )}
          
          {issue.type === 'mic_no_signal' && (
            <>
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Нет сигнала с микрофона</div>
                <div className="text-xs opacity-80">Проверьте подключение микрофона</div>
              </div>
            </>
          )}
          
          {issue.type === 'low_volume' && (
            <>
              <Volume1 className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Низкий уровень громкости</div>
                <div className="text-xs opacity-80">Говорите громче или поднесите микрофон ближе</div>
              </div>
            </>
          )}
        </div>
      ))}
      
      {/* Audio level indicator (debug) */}
      {isAnalyzing && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-32 left-4 bg-black/60 rounded-lg px-3 py-2 text-xs text-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-75"
                style={{ width: `${Math.min(localAudioLevel * 2, 100)}%` }}
              />
            </div>
            <span>{Math.round(localAudioLevel)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
