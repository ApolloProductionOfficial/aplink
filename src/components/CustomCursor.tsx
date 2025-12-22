import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ x: -100, y: -100 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
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
      `}</style>

      {/* Simple cursor - no canvas, no trail */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full bg-sky-400" />
          <div className="absolute -inset-0.5 rounded-full bg-sky-300/40" />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
