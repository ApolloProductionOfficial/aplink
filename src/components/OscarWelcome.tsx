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

    // Play comet sound
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => console.log("Audio play failed"));

    // Auto complete after 5 seconds
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl"
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

        {/* Comet effect */}
        <motion.div
          className="absolute"
          initial={{ x: "-10%", y: "-10%", opacity: 0 }}
          animate={{
            x: "110%",
            y: "110%",
            opacity: [0, 1, 1, 0],
          }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          <div className="relative">
            {/* Comet head */}
            <motion.div
              className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-white"
              animate={{
                boxShadow: [
                  "0 0 20px 5px rgba(59, 130, 246, 0.8)",
                  "0 0 40px 10px rgba(6, 182, 212, 1)",
                  "0 0 20px 5px rgba(59, 130, 246, 0.8)",
                ],
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            {/* Comet tail */}
            <motion.div
              className="absolute top-1/2 right-full w-64 h-1 -translate-y-1/2"
              style={{
                background: "linear-gradient(to left, rgba(59, 130, 246, 0.8), transparent)",
                filter: "blur(2px)",
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
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent mb-4">
              ВЕЛКОМ, ОСКАР! ✨
            </h1>
            <p className="text-2xl md:text-3xl text-cyan-300 font-semibold">
              Как хорошо, что вы нас посетили! 🌟
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
