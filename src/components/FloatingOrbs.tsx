import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const FloatingOrbs = () => {
  const reduceMotion = useReducedMotion();

  // On mobile/low-power devices, show static orbs without animation
  const orbs = reduceMotion 
    ? [
        { size: 300, x: '20%', y: '30%', color: 'from-primary/10 to-purple-500/5' },
        { size: 250, x: '70%', y: '60%', color: 'from-cyan-400/10 to-blue-500/5' },
      ]
    : [
        { size: 300, x: '10%', y: '20%', color: 'from-primary/20 to-purple-500/10', delay: 0 },
        { size: 200, x: '80%', y: '30%', color: 'from-pink-500/15 to-primary/10', delay: 1 },
        { size: 250, x: '50%', y: '70%', color: 'from-cyan-400/15 to-blue-500/10', delay: 2 },
        { size: 180, x: '20%', y: '80%', color: 'from-purple-500/15 to-pink-500/10', delay: 0.5 },
        { size: 220, x: '70%', y: '60%', color: 'from-primary/15 to-cyan-400/10', delay: 1.5 },
      ];

  // Static version for mobile
  if (reduceMotion) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {orbs.map((orb, index) => (
          <div
            key={index}
            className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    );
  }

  // Animated version for desktop
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 15 + index * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: (orb as any).delay || 0,
          }}
        />
      ))}
    </div>
  );
};

export default FloatingOrbs;
