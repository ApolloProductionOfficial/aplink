import { useCallback, useEffect, useRef } from 'react';

const TRAIL_LENGTH = 25;

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement[]>([]);
  const positionRef = useRef({ x: -100, y: -100 });
  const trailPositions = useRef<{ x: number; y: number }[]>(
    Array(TRAIL_LENGTH).fill({ x: -100, y: -100 })
  );
  const isTextRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    // Update trail positions - each follows the one before it with lerp
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      const prev = trailPositions.current[i - 1];
      const curr = trailPositions.current[i];
      const ease = 0.35 - (i * 0.01); // Slower at the end for comet effect
      trailPositions.current[i] = {
        x: curr.x + (prev.x - curr.x) * ease,
        y: curr.y + (prev.y - curr.y) * ease,
      };
    }
    
    // First trail dot follows cursor
    const pos = positionRef.current;
    trailPositions.current[0] = {
      x: trailPositions.current[0].x + (pos.x - trailPositions.current[0].x) * 0.5,
      y: trailPositions.current[0].y + (pos.y - trailPositions.current[0].y) * 0.5,
    };

    // Update DOM
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    }
    
    trailRef.current.forEach((el, i) => {
      if (el) {
        const tp = trailPositions.current[i];
        el.style.transform = `translate(${tp.x}px, ${tp.y}px) translate(-50%, -50%)`;
      }
    });

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };

      const target = e.target as HTMLElement | null;
      if (target) {
        isTextRef.current = !!target.closest('input, textarea, [contenteditable="true"]');
      }
    };

    window.addEventListener('pointermove', handlePointerMove as EventListener, { capture: true, passive: true });
    window.addEventListener('mousemove', handlePointerMove as EventListener, { capture: true, passive: true } as AddEventListenerOptions);
    
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener, { capture: true } as EventListenerOptions);
      window.removeEventListener('mousemove', handlePointerMove as EventListener, { capture: true } as EventListenerOptions);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <div className="hidden md:block">
      <style>{`
        body { cursor: none !important; }
        * { cursor: none !important; }
        input, textarea, [contenteditable="true"] { cursor: text !important; }
      `}</style>

      {/* Comet trail - particles getting smaller and more transparent */}
      {Array.from({ length: TRAIL_LENGTH }).map((_, i) => {
        const size = Math.max(1, 8 - i * 0.3);
        const opacity = Math.max(0.05, 0.6 - i * 0.025);
        const blur = i * 0.15;
        
        return (
          <div
            key={i}
            ref={(el) => { if (el) trailRef.current[i] = el; }}
            className="fixed top-0 left-0 pointer-events-none z-[9998] rounded-full bg-primary"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              filter: `blur(${blur}px)`,
              willChange: 'transform',
            }}
          />
        );
      })}

      {/* Main cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full bg-primary" />
          <div className="absolute -inset-1 rounded-full bg-primary/60 blur-[3px]" />
          <div className="absolute -inset-2 rounded-full bg-primary/30 blur-[6px]" />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
