import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SPOTLIGHT_SIZE = 180;

const CustomCursor = () => {
  const reduceMotion = useReducedMotion();
  const spotlightRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion) return;

    // Keep spotlight size static to avoid Safari perf issues
    spotlightRef.current?.style.setProperty('--spotlight-size', `${SPOTLIGHT_SIZE}px`);

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

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

    return () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener, {
        capture: true,
      } as EventListenerOptions);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div className="hidden md:block">
      <style>{`
        *, *::before, *::after { cursor: none !important; }
      `}</style>

      {/* Static spotlight (small) */}
      <div
        ref={spotlightRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          willChange: 'background',
          background:
            'radial-gradient(calc(var(--spotlight-size, 180px)) circle at var(--cursor-x, 50%) var(--cursor-y, 50%), hsla(0, 0%, 100%, 0.15) 0%, hsla(199, 89%, 55%, 0.08) 30%, hsla(199, 89%, 55%, 0.03) 50%, transparent 70%)',
          mixBlendMode: 'screen',
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
