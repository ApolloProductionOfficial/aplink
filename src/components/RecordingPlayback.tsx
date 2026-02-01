import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface RecordingPlaybackProps {
  recordingUrl: string;
  roomName: string;
  className?: string;
}

const RecordingPlayback = ({ recordingUrl, roomName, className }: RecordingPlaybackProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setHasError(true);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = recordingUrl;
    link.download = `${roomName}-recording.webm`;
    link.click();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasError) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2",
        className
      )}>
        <span>Запись недоступна</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 bg-muted/30 rounded-lg p-3",
      className
    )}>
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />
      
      {/* Play/Pause button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        disabled={isLoading}
        className="h-8 w-8 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>

      {/* Progress bar */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-10 shrink-0">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={1}
          onValueChange={handleSeek}
          className="flex-1"
          disabled={isLoading}
        />
        <span className="text-xs text-muted-foreground w-10 shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Volume toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMute}
        disabled={isLoading}
        className="h-8 w-8 shrink-0"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>

      {/* Download button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={isLoading}
        className="h-8 w-8 shrink-0"
        title="Скачать запись"
      >
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default RecordingPlayback;
