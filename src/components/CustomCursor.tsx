import { useEffect, useState, useRef, useCallback } from 'react';

const CustomCursor = () => {
  const [isPointer, setIsPointer] = useState(false);
  const [isText, setIsText] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const updateCursorPosition = useCallback(() => {
    if (cursorRef.current) {
      cursorRef.current.style.left = `${positionRef.current.x}px`;
      cursorRef.current.style.top = `${positionRef.current.y}px`;
    }
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      positionRef.current = { x: e.clientX, y: e.clientY };

      // Use requestAnimationFrame for smooth updates
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateCursorPosition);
      }

      // Check if hovering over clickable element
      const target = e.target as HTMLElement;
      const isClickable = target.closest('button, a, [role="button"]');
      const isTextInput = target.closest('input, textarea, [contenteditable="true"]');
      
      setIsPointer(!!isClickable);
      setIsText(!!isTextInput);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [updateCursorPosition]);

  // Don't show custom cursor over text inputs - let browser handle it
  if (isText) {
    return (
      <style>{`
        body { cursor: auto !important; }
        * { cursor: inherit; }
        input, textarea { cursor: text !important; }
      `}</style>
    );
  }

  return (
    <div className="hidden md:block">
      {/* Main cursor - Soft glow only */}
      <div
        ref={cursorRef}
        className={`fixed pointer-events-none z-[9999] will-change-[left,top] ${
          isPointer ? 'scale-150' : 'scale-100'
        }`}
        style={{
          left: `${positionRef.current.x}px`,
          top: `${positionRef.current.y}px`,
          transform: 'translate(-50%, -50%)',
          transition: 'transform 0.1s ease-out',
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
