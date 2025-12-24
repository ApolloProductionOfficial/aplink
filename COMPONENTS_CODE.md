# CF Project - Ключевые визуальные компоненты

Скопируй эти компоненты в `src/components/` нового проекта.

---

## FloatingOrbs.tsx
Анимированные градиентные орбы на фоне.

```typescript
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const FloatingOrbs = () => {
  const reduceMotion = useReducedMotion();

  // On mobile/low-power devices, show static orbs without animation
  const orbs = reduceMotion 
    ? [
        { size: 300, x: '20%', y: '30%', color: 'from-primary/10 to-purple-500/5' },
        { size: 250, x: '70%', y: '60%', color: 'from-cyan-400/10 to-blue-500/5' },
      ]
    : [
        { size: 300, x: '10%', y: '20%', color: 'from-primary/20 to-purple-500/10', delay: 0 },
        { size: 200, x: '80%', y: '30%', color: 'from-pink-500/15 to-primary/10', delay: 1 },
        { size: 250, x: '50%', y: '70%', color: 'from-cyan-400/15 to-blue-500/10', delay: 2 },
        { size: 180, x: '20%', y: '80%', color: 'from-purple-500/15 to-pink-500/10', delay: 0.5 },
        { size: 220, x: '70%', y: '60%', color: 'from-primary/15 to-cyan-400/10', delay: 1.5 },
      ];

  // Static version for mobile
  if (reduceMotion) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" style={{ contain: 'strict' }}>
        {orbs.map((orb, index) => (
          <div
            key={index}
            className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.x,
              top: orb.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    );
  }

  // Animated version for desktop
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" style={{ contain: 'strict' }}>
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute rounded-full bg-gradient-to-br ${orb.color} blur-3xl`}
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 15 + index * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: (orb as any).delay || 0,
          }}
        />
      ))}
    </div>
  );
};

export default FloatingOrbs;
```

---

## NeonGlow.tsx
Следящий за курсором неоновый эффект свечения.

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const NeonGlow = () => {
  const glowRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const rafRef = useRef<number | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const updateGlow = useCallback(() => {
    if (glowRef.current) {
      glowRef.current.style.setProperty('--mouse-x', `${mousePos.current.x}px`);
      glowRef.current.style.setProperty('--mouse-y', `${mousePos.current.y}px`);
    }
    rafRef.current = null;
  }, []);

  useEffect(() => {
    // Disable mouse tracking on mobile for performance
    if (reduceMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      
      // Throttle updates using RAF
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateGlow);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [reduceMotion, updateGlow]);

  // Don't render on mobile (no mouse anyway)
  if (reduceMotion) {
    return null;
  }

  return (
    <div 
      ref={glowRef}
      className="fixed inset-0 pointer-events-none z-20 overflow-hidden"
      style={{
        contain: 'strict',
        background: `
          radial-gradient(
            600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(6, 182, 212, 0.06),
            transparent 40%
          )
        `,
      }}
    />
  );
};

export default NeonGlow;
```

---

## ParticleEffect.tsx
Интерактивные частицы на canvas.

```typescript
import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

const ParticleEffect = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = [
      'rgba(6, 182, 212, ',    // cyan/primary
      'rgba(139, 92, 246, ',   // purple
      'rgba(236, 72, 153, ',   // pink
      'rgba(34, 211, 238, ',   // light cyan
    ];

    const createParticle = (x: number, y: number): Particle => ({
      x,
      y,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2 - 1,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.5 + 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0,
      maxLife: Math.random() * 100 + 50,
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      
      // Add particles on mouse move
      if (Math.random() > 0.7) {
        particlesRef.current.push(createParticle(e.clientX, e.clientY));
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Burst of particles on click
      for (let i = 0; i < 15; i++) {
        const particle = createParticle(e.clientX, e.clientY);
        particle.vx = (Math.random() - 0.5) * 8;
        particle.vy = (Math.random() - 0.5) * 8;
        particle.size = Math.random() * 5 + 2;
        particlesRef.current.push(particle);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    // Add ambient particles
    const addAmbientParticles = () => {
      if (particlesRef.current.length < 50 && Math.random() > 0.95) {
        particlesRef.current.push(
          createParticle(
            Math.random() * canvas.width,
            canvas.height + 10
          )
        );
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      addAmbientParticles();

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.02; // Gravity up
        p.opacity -= 0.005;

        if (p.life > p.maxLife || p.opacity <= 0) return false;

        // Draw particle with glow
        ctx.save();
        ctx.globalAlpha = p.opacity;
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color + '1)';
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.opacity + ')';
        ctx.fill();
        
        ctx.restore();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default ParticleEffect;
```

---

## CustomCursor.tsx
Кастомный курсор со spotlight эффектом.

```typescript
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
```

---

## FeatureCards.tsx
Интерактивные карточки с анимациями.

```typescript
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureCardsProps {
  features: Feature[];
}

const FeatureCards = ({ features }: FeatureCardsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          whileHover={{ 
            scale: 1.05,
            transition: { duration: 0.2 }
          }}
          className="relative glass rounded-xl md:rounded-2xl p-5 md:p-6 text-center group cursor-pointer overflow-hidden border border-transparent hover:border-primary/30"
        >
          {/* Background glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/10 group-hover:to-primary/5 transition-all duration-500 rounded-xl md:rounded-2xl" />
          
          {/* Animated border */}
          <div className="absolute inset-0 rounded-xl md:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div 
              className="absolute inset-0 rounded-xl md:rounded-2xl"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.3) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite'
              }}
            />
          </div>
          
          {/* Icon container */}
          <motion.div 
            className="relative w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 md:mb-5"
            whileHover={{ 
              rotate: [0, -10, 10, -5, 0],
              transition: { duration: 0.5 }
            }}
          >
            <feature.icon className="w-6 h-6 md:w-8 md:h-8 text-primary transition-transform duration-300 group-hover:scale-110" />
          </motion.div>
          
          {/* Content */}
          <h3 className="relative text-sm md:text-lg font-semibold mb-1.5 md:mb-2 transition-colors duration-300 group-hover:text-primary">
            {feature.title}
          </h3>
          <p className="relative text-xs md:text-sm text-muted-foreground leading-relaxed transition-colors duration-300 group-hover:text-foreground/80">
            {feature.description}
          </p>
          
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 rounded-full group-hover:w-1/2 transition-all duration-500" />
        </motion.div>
      ))}
    </div>
  );
};

export default FeatureCards;
```

---

## AnimatedBackground.tsx
Базовый анимированный фон.

```typescript
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedBackground = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background" style={{ contain: 'strict' }}>
      {/* Subtle gradient orbs - simplified on mobile */}
      <div
        className={`absolute top-0 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl ${
          reduceMotion ? '' : 'animate-float'
        }`}
        style={{ animationDelay: "0s" }}
      />
      {!reduceMotion && (
        <>
          <div
            className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/2 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "4s" }}
          />
        </>
      )}

      {/* Subtle grid pattern - always static */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px]" />
    </div>
  );
};

export default AnimatedBackground;
```

---

## Зависимости

Убедись, что установлены:
```bash
npm install framer-motion lucide-react
```

---

## Использование

```typescript
import FloatingOrbs from '@/components/FloatingOrbs';
import NeonGlow from '@/components/NeonGlow';
import ParticleEffect from '@/components/ParticleEffect';
import CustomCursor from '@/components/CustomCursor';
import AnimatedBackground from '@/components/AnimatedBackground';
import FeatureCards from '@/components/FeatureCards';

// В App.tsx или Layout:
function App() {
  return (
    <>
      <AnimatedBackground />
      <FloatingOrbs />
      <NeonGlow />
      <ParticleEffect />
      <CustomCursor />
      {/* Остальной контент */}
    </>
  );
}
```
