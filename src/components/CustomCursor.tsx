import { useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CustomCursor = () => {
  const reduceMotion = useReducedMotion();
  const spotlightRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef(280); // Current spotlight size
  const targetSizeRef = useRef(280);
  const lastMoveRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);
  const isMovingRef = useRef(false);

  // Animate size smoothly
  const animateSize = useCallback(() => {
    const now = Date.now();
    const timeSinceMove = now - lastMoveRef.current;
    
    // If not moving for 150ms, grow; otherwise shrink
    if (timeSinceMove > 150) {
      targetSizeRef.current = 400; // Big when stopped
      isMovingRef.current = false;
    } else {
      targetSizeRef.current = 180; // Small when moving
      isMovingRef.current = true;
    }
    
    // Smooth lerp
    const diff = targetSizeRef.current - sizeRef.current;
    sizeRef.current += diff * 0.08;
    
    if (spotlightRef.current) {
      const size = Math.round(sizeRef.current);
      spotlightRef.current.style.setProperty('--spotlight-size', `${size}px`);
    }
    
    rafRef.current = requestAnimationFrame(animateSize);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      lastMoveRef.current = Date.now();

      if (spotlightRef.current) {
        spotlightRef.current.style.setProperty('--cursor-x', `${x}px`);
        spotlightRef.current.style.setProperty('--cursor-y', `${y}px`);
      }

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    };

    window.addEventListener('pointermove', handlePointerMove as EventListener, {
      capture: true,
      passive: true,
    });

    rafRef.current = requestAnimationFrame(animateSize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener, {
        capture: true,
      } as EventListenerOptions);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reduceMotion, animateSize]);

  if (reduceMotion) return null;

  return (
    <div className="hidden md:block">
      <style>{`
        *, *::before, *::after { cursor: none !important; }
      `}</style>

      {/* Dynamic spotlight - grows when stopped, shrinks when moving */}
      <div
        ref={spotlightRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          willChange: 'background',
          background:
            'radial-gradient(calc(var(--spotlight-size, 280px)) circle at var(--cursor-x, 50%) var(--cursor-y, 50%), hsla(0, 0%, 100%, 0.15) 0%, hsla(199, 89%, 55%, 0.08) 30%, hsla(199, 89%, 55%, 0.03) 50%, transparent 70%)',
          mixBlendMode: 'screen',
          transition: 'background 0.1s ease-out',
        }}
      />

      {/* Cursor core */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div className="relative">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 24,
              height: 24,
              background:
                'radial-gradient(circle, hsla(199, 89%, 55%, 0.2) 0%, hsla(199, 89%, 55%, 0.08) 45%, transparent 70%)',
            }}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 5,
              height: 5,
              background: 'hsla(199, 89%, 65%, 0.5)',
              boxShadow: '0 0 10px hsla(199, 89%, 55%, 0.3)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
