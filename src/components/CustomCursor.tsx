import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CustomCursor = () => {
  const reduceMotion = useReducedMotion();
  const spotlightRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion) return;

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

      {/* Spotlight layer: illuminates dark overlays like ApolloProduction.studio */}
      <div
        ref={spotlightRef}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          willChange: 'background',
          background:
            'radial-gradient(280px circle at var(--cursor-x, 50%) var(--cursor-y, 50%), hsla(0, 0%, 100%, 0.18) 0%, hsla(199, 89%, 55%, 0.10) 35%, hsla(199, 89%, 55%, 0.04) 55%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Cursor core: subtle dot + small halo */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div className="relative">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 26,
              height: 26,
              background:
                'radial-gradient(circle, hsla(199, 89%, 55%, 0.22) 0%, hsla(199, 89%, 55%, 0.10) 45%, transparent 70%)',
            }}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 6,
              height: 6,
              background: 'hsla(199, 89%, 70%, 0.65)',
              boxShadow: '0 0 14px hsla(199, 89%, 55%, 0.35)',
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
