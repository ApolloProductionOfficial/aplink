import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import backgroundVideo from "@/assets/background-video-new.mp4";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [stage, setStage] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 0 = video reveals, 1 = text appears, 2 = fade out

  useEffect(() => {
    // Play whisper intro sound
    const playWhisper = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whisper-intro`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        
        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          audioRef.current = new Audio(audioUrl);
          audioRef.current.volume = 0.5;
          audioRef.current.play().catch(() => {});
        }
      } catch (error) {
        console.log("Could not play whisper intro");
      }
    };

    playWhisper();

    const timers = [
      setTimeout(() => setStage(1), 1200),   // Show text after video reveals
      setTimeout(() => setStage(2), 4000),   // Start fade out
      setTimeout(() => onComplete(), 4800),  // Complete
    ];

    return () => {
      timers.forEach(clearTimeout);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage < 2 && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Video background that reveals/expands */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src={backgroundVideo} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/50" />
          </motion.div>

          {/* Central glow effect */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/30 blur-[120px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 0.7 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />

          {/* Animated ring */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full border border-primary/40"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 2], opacity: [0.8, 0.4, 0] }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.5
            }}
          />

          {/* Text content */}
          <motion.div
            className="relative z-10 text-center px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ 
              opacity: stage >= 1 ? 1 : 0, 
              y: stage >= 1 ? 0 : 30 
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.p
              className="text-base sm:text-lg text-muted-foreground/80 mb-3 tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 10 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              Apollo Production представляет
            </motion.p>
            <motion.h1
              className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-foreground via-primary to-sky-400 bg-clip-text text-transparent mb-4"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: stage >= 1 ? 1 : 0, 
                scale: stage >= 1 ? 1 : 0.8 
              }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              APLink
            </motion.h1>
            <motion.p
              className="text-xl sm:text-2xl text-muted-foreground font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              Созвоны без границ
            </motion.p>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="absolute bottom-16 w-48 h-1 bg-muted/30 rounded-full overflow-hidden"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: stage >= 1 ? 1 : 0, scaleX: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-sky-400 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: stage >= 1 ? "100%" : "0%" }}
              transition={{ delay: 0.7, duration: 2.8, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
