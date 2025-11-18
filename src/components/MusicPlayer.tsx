import { useState, useRef, useEffect } from "react";
import { Music, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MusicPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isExpanded, setIsExpanded] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(0.3);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Initialize Web Audio API for beat detection
  useEffect(() => {
    if (audioRef.current && !audioContextRef.current) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      const source = audioContext.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Analyze audio and sync glow with beat
  const analyzeAudio = () => {
    if (!analyserRef.current || !isPlaying) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      return;
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Focus on bass frequencies (0-100Hz roughly first 8 bins)
    const bassRange = dataArray.slice(0, 8);
    const bassAverage = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
    
    // Normalize to 0-1 range and apply to glow
    const normalizedBass = bassAverage / 255;
    const intensity = 0.2 + (normalizedBass * 0.8); // Min 0.2, max 1.0
    
    setGlowIntensity(intensity);
    
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  useEffect(() => {
    if (isPlaying) {
      analyzeAudio();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Resume AudioContext if suspended
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
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

  const glowStyle = {
    boxShadow: `0 0 ${20 + glowIntensity * 40}px hsl(190 100% 50% / ${glowIntensity * 0.6})`,
    transition: 'box-shadow 0.1s ease-out'
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div 
        className="bg-card/95 backdrop-blur-lg border border-border rounded-lg w-64 p-4"
        style={glowStyle}
      >
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
