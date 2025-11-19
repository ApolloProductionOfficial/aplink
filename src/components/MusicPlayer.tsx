import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Hide player on scroll up (mobile)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      // Auto-play when component mounts
      audioRef.current.play().catch(err => {
        console.log("Autoplay blocked:", err);
        setIsPlaying(false);
      });
    }
  }, []);

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
    <div className={`fixed bottom-4 left-4 md:bottom-6 md:left-6 z-50 transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : 'translate-y-32'
    }`}>
      <div 
        className={`bg-card/95 backdrop-blur-lg border border-border rounded-lg w-48 md:w-64 p-2 md:p-4 transition-all duration-150 ${
          isPlaying ? 'animate-music-pulse' : ''
        }`}
      >
        <audio
          ref={audioRef}
          src="https://abs.zaycev.fm/kpop128k"
          loop
          preload="none"
        />
        
        <div className="space-y-2 md:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] md:text-xs font-medium hidden md:block">Music Player</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:h-8 md:w-8"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Play className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:h-8 md:w-8"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Volume2 className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-2 w-2 md:h-3 md:w-3 text-muted-foreground hidden md:block" />
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-[10px] md:text-xs text-muted-foreground w-6 md:w-8">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
