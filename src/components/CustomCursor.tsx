import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CustomCursor = () => {
  const reduceMotion = useReducedMotion();
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
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
        *:not([data-preserve-cursor] *):not([data-preserve-cursor]),
        *:not([data-preserve-cursor] *)::before,
        *:not([data-preserve-cursor] *)::after { cursor: none !important; }
        
        [data-preserve-cursor],
        [data-preserve-cursor] *,
        [data-preserve-cursor] *::before,
        [data-preserve-cursor] *::after { cursor: auto !important; }
        
        canvas[data-preserve-cursor] { cursor: crosshair !important; }
      `}</style>

      {/* Lightweight cursor dot only — no full-screen gradient spotlight */}
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
