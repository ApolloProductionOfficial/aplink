import { useEffect, useState } from 'react';

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [trail, setTrail] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    let trailId = 0;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });

      // Check if hovering over clickable element
      const target = e.target as HTMLElement;
      const isClickable = target.closest('button, a, [role="button"]');
      setIsPointer(!!isClickable);

      // Add trail point
      setTrail((prev) => {
        const newTrail = [
          ...prev,
          { x: e.clientX, y: e.clientY, id: trailId++ },
        ].slice(-8); // Keep last 8 points
        return newTrail;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Remove old trail points faster
    const interval = setInterval(() => {
      setTrail((prev) => prev.slice(1));
    }, 20);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="hidden md:block">
      {/* Main cursor - Neon glow */}
      <div
        className={`fixed pointer-events-none z-[9999] transition-transform duration-50 ${
          isPointer ? 'scale-125' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Core */}
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 rounded-full bg-primary animate-pulse" />
          
          {/* Inner glow */}
          <div className="absolute -inset-1 rounded-full bg-primary blur-[3px] animate-pulse" 
               style={{ animationDuration: '1.5s' }} />
          
          {/* Outer glow */}
          <div className="absolute -inset-2 rounded-full bg-primary/70 blur-[6px] animate-pulse" 
               style={{ animationDuration: '2s' }} />
          
          {/* Far glow */}
          <div className="absolute -inset-3 rounded-full bg-primary/40 blur-[8px] animate-pulse" 
               style={{ animationDuration: '2.5s' }} />
        </div>
      </div>

      {/* Trail with glow */}
      {trail.map((point, index) => {
        const opacity = (index / trail.length) * 0.7;
        const size = (index / trail.length) * 12 + 3;
        
        return (
          <div
            key={point.id}
            className="fixed pointer-events-none z-[9998]"
            style={{
              left: `${point.x}px`,
              top: `${point.y}px`,
              transform: 'translate(-50%, -50%)',
              opacity: opacity,
            }}
          >
            <div
              className="rounded-full bg-primary/80 blur-[3px]"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                boxShadow: `0 0 ${size * 2}px ${size}px hsl(var(--primary) / 0.5)`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default CustomCursor;
