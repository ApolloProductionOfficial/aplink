import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Don't render canvas animation on mobile for performance
    if (reduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Star {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      opacity: number;
      fadeDirection: number;
    }

    const stars: Star[] = [];
    // Reduced for better performance
    const starCount = 50;

    // Create stars
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        opacity: Math.random(),
        fadeDirection: Math.random() > 0.5 ? 1 : -1,
      });
    }

    let animationFrameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        // Update position
        star.x += star.vx;
        star.y += star.vy;

        // Wrap around edges
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;

        // Twinkle effect
        star.opacity += star.fadeDirection * 0.008;
        if (star.opacity >= 1 || star.opacity <= 0.2) {
          star.fadeDirection *= -1;
        }

        // Draw star
        ctx.fillStyle = `rgba(147, 197, 253, ${star.opacity})`;
        ctx.fillRect(star.x, star.y, star.radius, star.radius);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [reduceMotion]);

  // Don't render anything on mobile for maximum performance
  if (reduceMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.5, willChange: 'transform' }}
    />
  );
};

export default StarField;
