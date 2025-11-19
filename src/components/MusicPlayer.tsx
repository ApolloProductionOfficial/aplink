import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(15);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasStartedRef = useRef(false);

  // Start audio on first user interaction
  useEffect(() => {
    const startAudioOnInteraction = async () => {
      if (!hasStartedRef.current && audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          hasStartedRef.current = true;
          // Remove listeners after first interaction
          document.removeEventListener('click', startAudioOnInteraction);
          document.removeEventListener('touchstart', startAudioOnInteraction);
        } catch (err) {
          console.log("Play failed:", err);
        }
      }
    };

    // Try autoplay first
    const tryAutoplay = async () => {
      if (audioRef.current) {
        audioRef.current.volume = volume / 100;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
          hasStartedRef.current = true;
        } catch (err) {
          console.log("Autoplay blocked, waiting for user interaction");
          // Add event listeners for first user interaction
          document.addEventListener('click', startAudioOnInteraction);
          document.addEventListener('touchstart', startAudioOnInteraction);
        }
      }
    };

    setTimeout(tryAutoplay, 100);

    return () => {
      document.removeEventListener('click', startAudioOnInteraction);
      document.removeEventListener('touchstart', startAudioOnInteraction);
    };
  }, []);

  // Hide player on scroll (mobile only)
  useEffect(() => {
    const handleScroll = () => {
      // Check if mobile every time
      if (window.innerWidth >= 768) {
        setIsVisible(true);
        return;
      }

      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    handleScroll(); // Initial check
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll); // Check on resize
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [lastScrollY]);

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
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      const audio = audioRef.current;
      // Smooth volume change without interrupting playback
      audio.volume = newVolume / 100;
      
      if (newVolume === 0) {
        audio.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        audio.muted = false;
        setIsMuted(false);
      }
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
        
        {/* Mobile & Desktop: Play button on mobile, slider for all */}
        <div className="flex items-center gap-2 w-full">
          {/* Play/Pause button only on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:hidden flex-shrink-0"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>

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
