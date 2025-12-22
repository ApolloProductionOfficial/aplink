import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import backgroundVideo from "@/assets/background-video-new.mp4";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [stage, setStage] = useState(0);
  const audioPlayedRef = useRef(false);
  // 0 = video reveals, 1 = text appears, 2 = fade out

  useEffect(() => {
    // Prevent double audio play
    if (audioPlayedRef.current) return;
    audioPlayedRef.current = true;

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
          const audio = new Audio(audioUrl);
          audio.volume = 0.35; // Softer volume
          audio.play().catch(() => {});
        }
      } catch (error) {
        console.log("Could not play whisper intro");
      }
    };

    // Delay whisper to sync with text appearance
    setTimeout(() => playWhisper(), 1500);

    const timers = [
      setTimeout(() => setStage(1), 1500),   // Show text
      setTimeout(() => setStage(2), 5500),   // Start fade out (longer)
      setTimeout(() => onComplete(), 6300),  // Complete
    ];

    return () => {
      timers.forEach(clearTimeout);
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
            initial={{ scale: 1.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
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
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
          </motion.div>

          {/* Subtle central glow - centered and softer */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/15 blur-[100px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />

          {/* Text content */}
          <motion.div
            className="relative z-10 text-center px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 1 ? 1 : 0, 
              y: stage >= 1 ? 0 : 20 
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.p
              className="text-base sm:text-lg text-muted-foreground/70 mb-4 tracking-widest uppercase"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 10 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Apollo Production
            </motion.p>
            <motion.p
              className="text-sm sm:text-base text-muted-foreground/60 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              представляет
            </motion.p>
            <motion.h1
              className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: stage >= 1 ? 1 : 0, 
                scale: stage >= 1 ? 1 : 0.9 
              }}
              transition={{ delay: 0.7, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            >
              APLink
            </motion.h1>
            <motion.p
              className="text-xl sm:text-2xl text-muted-foreground/80 font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              Созвоны без границ
            </motion.p>
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="absolute bottom-20 w-40 h-0.5 bg-muted/20 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 1 ? 1 : 0 }}
            transition={{ delay: 1.2, duration: 0.3 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: stage >= 1 ? "100%" : "0%" }}
              transition={{ delay: 1.3, duration: 3.5, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
