import { useCallback, useEffect, useRef } from 'react';

const TRAIL_LENGTH = 25;

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const positionRef = useRef({ x: -100, y: -100 });
  const trailPositions = useRef<{ x: number; y: number }[]>(
    Array(TRAIL_LENGTH).fill({ x: -100, y: -100 })
  );
  const rafRef = useRef<number | null>(null);

  const animate = useCallback(() => {
    // Update trail positions - each follows the one before it with lerp
    for (let i = TRAIL_LENGTH - 1; i > 0; i--) {
      const prev = trailPositions.current[i - 1];
      const curr = trailPositions.current[i];
      const ease = 0.35 - (i * 0.01);
      trailPositions.current[i] = {
        x: curr.x + (prev.x - curr.x) * ease,
        y: curr.y + (prev.y - curr.y) * ease,
      };
    }
    
    // First trail point follows cursor
    const pos = positionRef.current;
    trailPositions.current[0] = {
      x: trailPositions.current[0].x + (pos.x - trailPositions.current[0].x) * 0.5,
      y: trailPositions.current[0].y + (pos.y - trailPositions.current[0].y) * 0.5,
    };

    // Update main cursor DOM
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
    }
    
    // Draw comet trail on canvas
    const canvas = trailCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const points = trailPositions.current;
        if (points.length > 1) {
          // Draw gradient line from cursor to tail
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          
          // Create gradient along the line
          const gradient = ctx.createLinearGradient(
            points[0].x, points[0].y,
            points[points.length - 1].x, points[points.length - 1].y
          );
          gradient.addColorStop(0, 'hsla(199, 89%, 70%, 0.8)');
          gradient.addColorStop(0.3, 'hsla(199, 89%, 75%, 0.4)');
          gradient.addColorStop(0.6, 'hsla(199, 89%, 80%, 0.15)');
          gradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          
          // Draw glow effect - thicker blurred line
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          
          const glowGradient = ctx.createLinearGradient(
            points[0].x, points[0].y,
            points[points.length - 1].x, points[points.length - 1].y
          );
          glowGradient.addColorStop(0, 'hsla(199, 89%, 70%, 0.3)');
          glowGradient.addColorStop(0.5, 'hsla(199, 89%, 80%, 0.1)');
          glowGradient.addColorStop(1, 'hsla(0, 0%, 100%, 0)');
          
          ctx.strokeStyle = glowGradient;
          ctx.lineWidth = 8;
          ctx.filter = 'blur(4px)';
          ctx.stroke();
          ctx.filter = 'none';
        }
      }
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Set canvas size
    const canvas = trailCanvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', handleResize);
    }

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };
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

      {/* Canvas for comet trail */}
      <canvas
        ref={trailCanvasRef}
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Main cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{ willChange: 'transform' }}
      >
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full bg-sky-400" />
          <div className="absolute -inset-1 rounded-full bg-sky-300/60 blur-[3px]" />
          <div className="absolute -inset-2 rounded-full bg-white/30 blur-[6px]" />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
