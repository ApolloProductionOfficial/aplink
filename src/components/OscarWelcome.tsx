import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface OscarWelcomeProps {
  onComplete: () => void;
}

const OscarWelcome = ({ onComplete }: OscarWelcomeProps) => {
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    // Generate random stars
    const newStars = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 0.5,
    }));
    setStars(newStars);

    // Play Oscar's special music track snippet (33-37 seconds = 4 seconds)
    const audio = new Audio("/audio/oscar-welcome.mp3");
    audio.volume = 0.7;

    // Start playback from 33s and let it play smoothly for 4 seconds
    audio.currentTime = 33;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((error) => console.log("Audio play failed:", error));
    }

    // Close welcome after exactly 4 seconds (duration from 33 to 37 seconds)
    const welcomeTimer = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(welcomeTimer);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        {/* Starfield background */}
        <div className="absolute inset-0 overflow-hidden">
          {stars.map((star, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: star.delay,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            />
          ))}
        </div>

        {/* Comet effect - Enhanced */}
        <motion.div
          className="absolute"
          initial={{ x: "-20%", y: "-20%", opacity: 0 }}
          animate={{
            x: "120%",
            y: "120%",
            opacity: [0, 1, 1, 1, 0],
          }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
        >
          <div className="relative">
            {/* Comet head - larger and brighter */}
            <motion.div
              className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-white"
              animate={{
                boxShadow: [
                  "0 0 40px 15px rgba(59, 130, 246, 1)",
                  "0 0 80px 25px rgba(6, 182, 212, 1)",
                  "0 0 40px 15px rgba(59, 130, 246, 1)",
                ],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 0.4, repeat: Infinity }}
            />
            {/* Comet tail - longer and more visible */}
            <motion.div
              className="absolute top-1/2 right-full w-96 h-2 -translate-y-1/2"
              style={{
                background: "linear-gradient(to left, rgba(59, 130, 246, 1), rgba(6, 182, 212, 0.6), transparent)",
                filter: "blur(3px)",
              }}
            />
            {/* Secondary tail glow */}
            <motion.div
              className="absolute top-1/2 right-full w-64 h-4 -translate-y-1/2"
              style={{
                background: "linear-gradient(to left, rgba(59, 130, 246, 0.8), transparent)",
                filter: "blur(8px)",
              }}
            />
          </div>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -180 }}
          animate={{
            scale: [0, 1.2, 1],
            opacity: [0, 1, 1],
            rotate: [180, 0, 0],
          }}
          transition={{ duration: 1, delay: 0.5 }}
          className="relative z-10 text-center"
        >
          <motion.div
            animate={{
              textShadow: [
                "0 0 20px rgba(59, 130, 246, 0.8)",
                "0 0 40px rgba(6, 182, 212, 1)",
                "0 0 20px rgba(59, 130, 246, 0.8)",
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent mb-4">
              OSCAR, ТЫ ЛУЧШИЙ! ✨
            </h1>
            <p className="text-xl md:text-2xl text-cyan-300 font-semibold mb-2">
              Без тебя ничего бы не вышло! 🌟
            </p>
            <p className="text-lg md:text-xl text-blue-300 font-medium">
              Очень рад, что мы работаем вместе! 💙
            </p>
          </motion.div>

          {/* Orbiting particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 rounded-full bg-cyan-400"
              style={{
                left: "50%",
                top: "50%",
              }}
              animate={{
                x: [0, Math.cos((i * Math.PI) / 4) * 150],
                y: [0, Math.sin((i * Math.PI) / 4) * 150],
                opacity: [1, 0],
                scale: [1, 0],
              }}
              transition={{
                duration: 1.5,
                delay: 1 + i * 0.1,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.div>

        {/* Bottom glow effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent pointer-events-none" />
      </motion.div>
    </AnimatePresence>
  );
};

export default OscarWelcome;
