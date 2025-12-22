import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import backgroundVideo from "@/assets/background-video-new.mp4";

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_SESSION_KEY = "aplink_splash_state_v2";

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [stage, setStage] = useState(0);
  const [shouldShow, setShouldShow] = useState(false);
  const soundPlayedRef = useRef(false);
  // 0 = video reveals, 1 = text appears, 2 = fade out

  useEffect(() => {
    // sessionStorage: null -> not shown, in_progress -> started but not finished, done -> fully shown
    const splashState = sessionStorage.getItem(SPLASH_SESSION_KEY);

    if (splashState === "done") {
      onComplete();
      return;
    }

    // Mark as in progress so React StrictMode double-invocation doesn't permanently skip the splash
    sessionStorage.setItem(SPLASH_SESSION_KEY, "in_progress");
    setShouldShow(true);

    const timers = [
      setTimeout(() => setStage(1), 800), // Show text
      setTimeout(() => setStage(2), 5000), // Start fade out (~5 sec)
      setTimeout(() => {
        sessionStorage.setItem(SPLASH_SESSION_KEY, "done");
        onComplete();
      }, 5800),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  // Play sound when logo appears
  useEffect(() => {
    if (stage === 1 && !soundPlayedRef.current && shouldShow) {
      soundPlayedRef.current = true;
      
      const playSound = async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logo-sound`,
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
            audio.volume = 0.4;
            audio.play().catch(() => {});
          }
        } catch (error) {
          console.log("Could not play logo sound");
        }
      };

      // Small delay to sync with logo animation
      setTimeout(() => playSound(), 400);
    }
  }, [stage, shouldShow]);
  
  // Don't render anything if not showing
  if (!shouldShow) return null;


  return (
    <AnimatePresence>
      {stage < 2 && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {/* Darkened video background - same as main site */}
          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={{ scale: 1.2, opacity: 0 }}
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
            {/* Dark overlay - matching main site */}
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
          </motion.div>

          {/* Animated particles/stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(25)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/50 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 0.8, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 2.5 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 3,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Central glow */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/20 blur-[100px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: [0, 0.6, 0.4] }}
            transition={{ duration: 2.5, ease: "easeOut" }}
          />

          {/* Text content */}
          <motion.div
            className="relative z-10 text-center px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ 
              opacity: stage >= 1 ? 1 : 0, 
              y: stage >= 1 ? 0 : 30 
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Decorative line */}
            <motion.div
              className="w-20 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-8"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: stage >= 1 ? 1 : 0, opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            />
            
            <motion.p
              className="text-sm sm:text-base text-primary/80 mb-4 tracking-[0.3em] uppercase font-medium"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 10 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              Apollo Production
            </motion.p>
            
            <motion.p
              className="text-sm text-muted-foreground/70 mb-10 italic"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              представляет
            </motion.p>
            
            {/* APLink logo - letter by letter from shadow, with shimmer gradient */}
            <div className="relative mb-6">
              {/* Sweeping glow effect */}
              <motion.div
                className="absolute inset-0 blur-3xl bg-primary/50 rounded-full"
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ 
                  x: stage >= 1 ? "100%" : "-100%",
                  opacity: stage >= 1 ? [0, 0.8, 0] : 0
                }}
                transition={{ delay: 0.6, duration: 2, ease: "easeInOut" }}
              />
              <h1 className="text-6xl sm:text-8xl font-bold relative z-10 flex justify-center">
                {"APLink".split("").map((letter, index) => (
                  <motion.span
                    key={index}
                    className="inline-block relative bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent bg-[length:200%_auto]"
                    style={{
                      animationDelay: `${index * 0.1}s`,
                    }}
                    initial={{ 
                      opacity: 0, 
                      x: -30,
                      filter: "blur(8px)",
                    }}
                    animate={{ 
                      opacity: stage >= 1 ? 1 : 0, 
                      x: stage >= 1 ? 0 : -30,
                      filter: stage >= 1 ? "blur(0px)" : "blur(8px)",
                      backgroundPosition: stage >= 1 ? ["200% 0", "-200% 0"] : "200% 0",
                    }}
                    transition={{ 
                      opacity: { delay: 0.6 + index * 0.15, duration: 0.5 },
                      x: { delay: 0.6 + index * 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
                      filter: { delay: 0.6 + index * 0.15, duration: 0.5 },
                      backgroundPosition: { delay: 1.5, duration: 3, repeat: Infinity, ease: "linear" },
                    }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </h1>
            </div>
            
            <motion.p
              className="text-xl sm:text-2xl text-foreground/80 font-light tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 10 }}
              transition={{ delay: 0.9, duration: 0.5 }}
            >
              Видеозвонки нового поколения
            </motion.p>

            {/* Decorative line bottom */}
            <motion.div
              className="w-20 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mt-8"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: stage >= 1 ? 1 : 0, opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
            />
          </motion.div>

          {/* Loading bar */}
          <motion.div
            className="absolute bottom-16 w-48 h-1 bg-muted/20 rounded-full overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: stage >= 1 ? 1 : 0, y: stage >= 1 ? 0 : 10 }}
            transition={{ delay: 1.3, duration: 0.3 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full"
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
