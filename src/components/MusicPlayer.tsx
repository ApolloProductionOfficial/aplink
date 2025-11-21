import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MusicPlayer = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  // Load music state from localStorage
  const [isPlaying, setIsPlaying] = useState(() => {
    const saved = localStorage.getItem('musicPlaying');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(5);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasStartedRef = useRef(false);

  // Restore music state on mount
  useEffect(() => {
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    setIsMobile(isMobileScreen);

    // On mobile devices we completely disable autoplay so music never starts by itself
    if (isMobileScreen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volume / 100;
      }
      setIsPlaying(false);
      hasStartedRef.current = false;
      localStorage.setItem('musicPlaying', 'false');
      return;
    }

    const startAudioOnInteraction = async () => {
      if (!hasStartedRef.current && audioRef.current) {
        const savedState = localStorage.getItem('musicPlaying');
        const shouldPlay = savedState ? JSON.parse(savedState) : false;
        
        if (shouldPlay) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
            hasStartedRef.current = true;
            localStorage.setItem('musicPlaying', 'true');
          } catch (err) {
            console.log("Play failed:", err);
          }
        }
        // Remove listeners after first interaction
        document.removeEventListener('click', startAudioOnInteraction);
        document.removeEventListener('touchstart', startAudioOnInteraction);
      }
    };

    // Try to restore state or autoplay (desktop only)
    const tryAutoplay = async () => {
      if (audioRef.current) {
        audioRef.current.volume = volume / 100;
        const savedState = localStorage.getItem('musicPlaying');
        const shouldPlay = savedState === null ? true : JSON.parse(savedState); // Autoplay only on first visit
        
        if (shouldPlay) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
            hasStartedRef.current = true;
            localStorage.setItem('musicPlaying', 'true');
          } catch (err) {
            console.log("Autoplay blocked, waiting for user interaction");
            // Add event listeners for first user interaction
            document.addEventListener('click', startAudioOnInteraction);
            document.addEventListener('touchstart', startAudioOnInteraction);
          }
        }
      }
    };

    setTimeout(tryAutoplay, 100);

    return () => {
      document.removeEventListener('click', startAudioOnInteraction);
      document.removeEventListener('touchstart', startAudioOnInteraction);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      const newState = !isPlaying;
      if (newState) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
      setIsPlaying(newState);
      localStorage.setItem('musicPlaying', JSON.stringify(newState));
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
 
   // On phones we completely hide the player so music does not play there at all
   if (isMobile) {
     return null;
   }
 
  return (
    <div className="hidden md:block fixed bottom-6 left-6 right-auto z-50">
      <div
        className={`relative group bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl border-2 ${
          isPlaying ? 'border-primary/60 shadow-2xl shadow-primary/30' : 'border-border/50'
        } rounded-2xl md:w-72 md:p-5 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/40`}
      >
        {/* Cosmic glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-2xl blur-xl opacity-0 ${
          isPlaying ? 'opacity-100 animate-shimmer' : 'group-hover:opacity-60'
        } transition-opacity duration-500`} />
        <audio
          ref={audioRef}
          src="https://abs.zaycev.fm/kpop128k"
          loop
          preload="auto"
          playsInline
        />
        
        {/* Mobile & Desktop: Play button on mobile, slider for all */}
        <div className="relative z-10 flex items-center gap-3 w-full">
          {/* Music icon with glow - desktop only */}
          <div className="hidden md:flex w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 items-center justify-center border-2 border-primary/50 shadow-lg shadow-primary/30 flex-shrink-0">
            <Music className={`h-5 w-5 text-primary ${isPlaying ? 'animate-pulse' : ''}`} />
          </div>
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
            <span className="text-xs font-medium text-primary/80 w-10 text-right bg-primary/10 rounded-full px-2 py-1">
              {volume}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full transition-all duration-300 ${
                isPlaying 
                  ? 'bg-primary/20 text-primary hover:bg-primary/30 shadow-lg shadow-primary/20' 
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
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
              className={`h-9 w-9 rounded-full transition-all duration-300 ${
                isMuted 
                  ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' 
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
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
