import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TRAIL_LENGTH = 12; // Optimized trail length
const THROTTLE_MS = 16; // ~60fps throttle

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef({ x: -100, y: -100 });
  const trailPositions = useRef<{ x: number; y: number }[]>(
    Array(TRAIL_LENGTH).fill({ x: -100, y: -100 })
  );
  const rafRef = useRef<number | null>(null);
  const lastMoveRef = useRef(0);
  const reduceMotion = useReducedMotion();

  const animate = useCallback(() => {
    const now = performance.now();
    
    // Throttle animation updates
    if (now - lastMoveRef.current < THROTTLE_MS) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }
    lastMoveRef.current = now;

    // Update trail positions with optimized lerp
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      const prev = trailPositions.current[i - 1];
      const curr = trailPositions.current[i];
      const ease = 0.3 - (i * 0.02);
      trailPositions.current[i] = {
        x: curr.x + (prev.x - curr.x) * ease,
        y: curr.y + (prev.y - curr.y) * ease,
      };
    }
    
    // First trail point follows cursor
    const pos = positionRef.current;
    trailPositions.current[0] = {
      x: trailPositions.current[0].x + (pos.x - trailPositions.current[0].x) * 0.4,
      y: trailPositions.current[0].y + (pos.y - trailPositions.current[0].y) * 0.4,
    };

    // Update main cursor with GPU-accelerated transform
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
    }
    
    // Draw comet trail on canvas
    const canvas = trailCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { alpha: true });
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const points = trailPositions.current;
        if (points.length > 1 && points[0].x > 0) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          
          // Use quadratic curves for smoother, faster rendering
          for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          
          // Simplified gradient with fewer stops
          const gradient = ctx.createLinearGradient(
            points[0].x, points[0].y,
            points[points.length - 1].x, points[points.length - 1].y
          );
          gradient.addColorStop(0, 'hsla(199, 89%, 70%, 0.7)');
          gradient.addColorStop(0.5, 'hsla(199, 89%, 75%, 0.25)');
          gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    
    const canvas = trailCanvasRef.current;
    if (canvas) {
      // Use device pixel ratio for crisp rendering but cap it for performance
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      
      const handleResize = () => {
        const newDpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * newDpr;
        canvas.height = window.innerHeight * newDpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        const resizeCtx = canvas.getContext('2d');
        if (resizeCtx) {
          resizeCtx.scale(newDpr, newDpr);
        }
      };
      window.addEventListener('resize', handleResize, { passive: true });
    }

    // Throttled mouse move handler
    let lastMove = 0;
    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const now = performance.now();
      if (now - lastMove < 8) return; // Throttle to ~120hz max
      lastMove = now;
      positionRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('pointermove', handlePointerMove as EventListener, { capture: true, passive: true });
    
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove as EventListener, { capture: true } as EventListenerOptions);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, reduceMotion]);

  if (reduceMotion) {
    return null;
  }

  return (
    <div className="hidden md:block">
      <style>{`
        body, body * { cursor: none !important; }
        input, textarea, [contenteditable="true"] { cursor: text !important; }
      `}</style>

      {/* Canvas for comet trail - GPU accelerated */}
      <canvas
        ref={trailCanvasRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{ 
          width: '100vw', 
          height: '100vh',
          willChange: 'auto',
          contain: 'strict'
        }}
      />

      {/* Main cursor - GPU accelerated */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ 
          willChange: 'transform',
          contain: 'layout style'
        }}
      >
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full bg-sky-400" />
          <div className="absolute -inset-0.5 rounded-full bg-sky-300/50" />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
