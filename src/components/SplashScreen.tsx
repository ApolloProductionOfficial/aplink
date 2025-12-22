import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import apolloLogo from "@/assets/apollo-logo.mp4";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [stage, setStage] = useState(0);
  // 0 = logo appears, 1 = text appears, 2 = fade out

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 800),   // Show text
      setTimeout(() => setStage(2), 2800),  // Start fade out
      setTimeout(() => onComplete(), 3500), // Complete
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {stage < 2 && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {/* Background glow effects */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/20 blur-[100px]"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 0.6 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-sky-500/20 blur-[80px]"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0.5 }}
              transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            />
          </div>

          {/* Logo container */}
          <motion.div
            className="relative z-10"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.34, 1.56, 0.64, 1] 
            }}
          >
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-[-20px] rounded-full border-2 border-primary/30"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.3, opacity: [0, 0.5, 0] }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeOut",
                delay: 0.5 
              }}
            />
            
            {/* Main logo */}
            <div className="relative w-32 h-32 sm:w-40 sm:h-40">
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/40 blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="relative w-full h-full rounded-full overflow-hidden ring-4 ring-primary/50 shadow-[0_0_60px_hsl(var(--primary)/0.6)]">
                <video
                  src={apolloLogo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover scale-[1.3] origin-center"
                />
              </div>
            </div>
          </motion.div>

          {/* Text content */}
          <motion.div
            className="relative z-10 mt-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: stage >= 1 ? 1 : 0, 
              y: stage >= 1 ? 0 : 20 
            }}
            transition={{ duration: 0.5 }}
          >
            <motion.p
              className="text-sm sm:text-base text-muted-foreground mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.1 }}
            >
              Apollo Production представляет
            </motion.p>
            <motion.h1
              className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-sky-400 bg-clip-text text-transparent"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ 
                opacity: stage >= 1 ? 1 : 0, 
                scale: stage >= 1 ? 1 : 0.9 
              }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              APLink
            </motion.h1>
            <motion.p
              className="text-lg sm:text-xl text-muted-foreground mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: stage >= 1 ? 1 : 0 }}
              transition={{ delay: 0.4 }}
            >
              Созвоны без границ
            </motion.p>
          </motion.div>

          {/* Loading dots */}
          <motion.div
            className="absolute bottom-12 flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 1 ? 1 : 0 }}
            transition={{ delay: 0.6 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ 
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
