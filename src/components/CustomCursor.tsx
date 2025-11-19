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
        ].slice(-10); // Keep last 10 points
        return newTrail;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Remove old trail points
    const interval = setInterval(() => {
      setTrail((prev) => prev.slice(1));
    }, 50);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="hidden md:block">
      {/* Main cursor - Arrow shape */}
      <div
        className={`fixed pointer-events-none z-[9999] transition-transform duration-200 ${
          isPointer ? 'scale-150' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-20%, -20%)',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" 
            fill="hsl(var(--primary))" 
            fillOpacity="0.8"
            stroke="hsl(var(--primary))" 
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path 
            d="M12.58 12.58L19.97 19.97" 
            stroke="hsl(var(--primary))" 
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Trail */}
      {trail.map((point, index) => (
        <div
          key={point.id}
          className="fixed pointer-events-none z-[9998]"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: (index / trail.length) * 0.5,
          }}
        >
          <div
            className="rounded-full bg-primary/40"
            style={{
              width: `${(index / trail.length) * 12}px`,
              height: `${(index / trail.length) * 12}px`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default CustomCursor;
