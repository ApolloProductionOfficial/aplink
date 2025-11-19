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
      // Auto-play when component mounts with delay for better mobile support
      const playAudio = async () => {
        try {
          await audioRef.current?.play();
          setIsPlaying(true);
        } catch (err) {
          console.log("Autoplay blocked:", err);
          setIsPlaying(false);
        }
      };
      
      // Small delay to ensure DOM is ready
      setTimeout(playAudio, 100);
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
    <div className={`fixed bottom-2 left-2 right-2 md:bottom-6 md:left-6 md:right-auto z-50 transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : 'translate-y-32'
    }`}>
      <div 
        className={`bg-card/95 backdrop-blur-lg border border-border rounded-full px-3 py-1.5 md:rounded-lg md:w-64 md:p-4 transition-all duration-150 ${
          isPlaying ? 'animate-music-pulse' : ''
        }`}
      >
        <audio
          ref={audioRef}
          src="https://abs.zaycev.fm/kpop128k"
          loop
          preload="auto"
          playsInline
        />
        
        {/* Mobile & Desktop: Slider with better mobile touch area */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 py-2 md:py-0">
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {/* Десктоп: маленький текст и кнопки справа */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8 text-right">
              {volume}%
            </span>
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
      </div>
    </div>
  );
};

export default MusicPlayer;
