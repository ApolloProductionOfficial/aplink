import { useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const NeonGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rafRef = useRef<number | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const updateGlow = useCallback(() => {
    if (glowRef.current) {
      glowRef.current.style.setProperty('--mouse-x', `${mousePos.current.x}px`);
      glowRef.current.style.setProperty('--mouse-y', `${mousePos.current.y}px`);
    }
    rafRef.current = null;
  }, []);

  useEffect(() => {
    // Disable mouse tracking on mobile for performance
    if (reduceMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      // Throttle updates using RAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateGlow);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [reduceMotion, updateGlow]);

  // Don't render on mobile (no mouse anyway)
  if (reduceMotion) {
    return null;
  }

  return (
    <div 
      ref={glowRef}
      className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
      style={{
        contain: 'strict',
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
