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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(0));

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

  // Equalizer animation - simple movement when playing
  useEffect(() => {
    const bars = 10;
    let frameCount = 0;

    const animate = () => {
      const arr: number[] = [];
      frameCount += isPlaying ? 0.2 : 0.02;

      for (let i = 0; i < bars; i++) {
        const base = isPlaying ? 4 : 2;
        const variance = isPlaying ? 14 : 1;
        const wave = Math.sin(frameCount + i * 0.6) * 0.5 + 0.5;
        arr.push(base + variance * wave);
      }
      setFrequencyData(arr);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

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
    <div className="hidden md:block fixed bottom-6 left-4 right-auto z-50">
      {/* Cosmic glow around player - outside */}
      <div className="absolute inset-0 -m-12 pointer-events-none">
        {/* Green glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-green-500/15 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '3s' }} />
        {/* Purple glow */}
        <div className="absolute bottom-0 right-0 w-36 h-36 bg-purple-500/15 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
        {/* Cyan glow */}
        <div className="absolute top-1/2 left-0 w-32 h-32 bg-cyan-500/15 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '3.5s', animationDelay: '1s' }} />
        {/* Pink glow */}
        <div className="absolute bottom-1/4 left-1/4 w-28 h-28 bg-pink-500/12 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '4.5s', animationDelay: '1.5s' }} />
      </div>
      
      <div
        className={`relative group bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl border-2 ${
          isPlaying ? 'border-primary/40 shadow-xl shadow-primary/15' : 'border-border/50'
        } rounded-2xl md:w-56 md:p-3 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-primary/20`}
      >
        {/* Cosmic glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl blur-xl opacity-0 ${
          isPlaying ? 'opacity-100 animate-shimmer' : 'group-hover:opacity-40'
        } transition-opacity duration-500`} />
        <audio
          ref={audioRef}
          src="https://abs.zaycev.fm/kpop128k"
          loop
          preload="auto"
          playsInline
        />
        
        {/* Mobile & Desktop: Play button on mobile, slider for all */}
        <div className="relative z-10 flex flex-col gap-3 w-full">
          {/* Top row: Icon, equalizer, and control buttons */}
          <div className="flex items-center gap-3 w-full">
            {/* Music icon - desktop only */}
            <div className="hidden md:flex flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-primary/12 flex items-center justify-center border-2 border-primary/30 shadow-lg shadow-primary/15">
                <Music className={`h-4 w-4 text-primary ${isPlaying ? 'animate-pulse' : ''}`} />
              </div>
            </div>
            
            {/* Equalizer - stretched across */}
            <div className="hidden md:flex flex-1 gap-1 h-6 items-end justify-center px-2">
              {frequencyData.slice(0, 20).map((value, i) => {
                const height = Math.max(3, value * 1.2);
                return (
                  <div
                    key={i}
                    className="flex-1 max-w-[3px] bg-gradient-to-t from-primary to-primary/50 rounded-full transition-all duration-150 shadow-sm shadow-primary/30"
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-full transition-all duration-300 ${
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
                className={`h-8 w-8 rounded-full transition-all duration-300 ${
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

          {/* Bottom row: Volume slider */}
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1">
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-full cursor-pointer"
              />
            </div>
            <span className="text-xs font-medium text-primary/80 min-w-[2.5rem] text-right bg-primary/10 rounded-full px-2 py-0.5">
              {volume}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
