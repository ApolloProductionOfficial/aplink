import { useEffect, useState } from 'react';

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });

      // Check if hovering over clickable element
      const target = e.target as HTMLElement;
      const isClickable = target.closest('button, a, [role="button"]');
      setIsPointer(!!isClickable);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="hidden md:block">
      {/* Main cursor - Soft glow only */}
      <div
        className={`fixed pointer-events-none z-[9999] transition-transform duration-100 ${
          isPointer ? 'scale-150' : 'scale-100'
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Core */}
        <div className="relative w-2 h-2">
          <div className="absolute inset-0 rounded-full bg-primary/80" />
          
          {/* Soft inner glow */}
          <div className="absolute -inset-1 rounded-full bg-primary/50 blur-[4px]" />
          
          {/* Outer glow */}
          <div className="absolute -inset-3 rounded-full bg-primary/30 blur-[8px]" />
        </div>
      </div>
    </div>
  );
};

export default CustomCursor;
