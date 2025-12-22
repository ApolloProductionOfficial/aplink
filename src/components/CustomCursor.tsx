import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CustomCursor = () => {
  const glowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };

    window.addEventListener('pointermove', handlePointerMove as EventListener, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener, { capture: true } as EventListenerOptions);
    };
  }, [reduceMotion]);

  if (reduceMotion) {
    return null;
  }

  return (
    <div className="hidden md:block">
      <style>{`
        body, body * { cursor: none !important; }
        input, textarea, [contenteditable="true"] { cursor: text !important; }
        a, button, [role="button"] { cursor: pointer !important; }
      `}</style>

      {/* Glow cursor - soft light like apolloproduction.studio */}
      <div
        ref={glowRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div 
          className="w-48 h-48 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle, hsla(199, 89%, 55%, 0.35) 0%, hsla(199, 89%, 50%, 0.15) 30%, hsla(199, 89%, 48%, 0.05) 50%, transparent 70%)',
          }}
        />
      </div>
    </div>
  );
};

export default CustomCursor;
