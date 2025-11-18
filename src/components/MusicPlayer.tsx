import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isExpanded, setIsExpanded] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (audioRef.current) {
      audioRef.current.volume = value[0] / 100;
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div className="bg-card/95 backdrop-blur-lg border border-border rounded-lg transition-all duration-300 w-64 p-4">
        <div className="mb-2">
          <p className="text-xs text-muted-foreground italic">
            Изучай сайт под хорошее настроение 🎵
          </p>
        </div>
        <audio
          ref={audioRef}
          src="https://abs.zaycev.fm/kpop128k"
          loop
          preload="none"
        />
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Music Player</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
