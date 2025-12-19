import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const NeonGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Disable mouse tracking on mobile for performance
    if (reduceMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!glowRef.current) return;
      
      const x = e.clientX;
      const y = e.clientY;
      
      glowRef.current.style.setProperty('--mouse-x', `${x}px`);
      glowRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [reduceMotion]);

  // Don't render on mobile (no mouse anyway)
  if (reduceMotion) {
    return null;
  }

  return (
    <div 
      ref={glowRef}
      className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
      style={{
        background: `
          radial-gradient(
            600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(6, 182, 212, 0.06),
            transparent 40%
          )
        `,
      }}
    />
  );
};

export default NeonGlow;
