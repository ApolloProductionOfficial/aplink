import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CallMenuHintProps {
  children: React.ReactNode;
  hint: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Lightweight hover-hint component for call menu buttons.
 * Works in all environments (including Telegram WebView) where 
 * native title attributes and Radix tooltips may fail.
 */
export function CallMenuHint({ 
  children, 
  hint, 
  side = 'top',
  className 
}: CallMenuHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showHint = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Small delay to prevent flickering
    timeoutRef.current = setTimeout(() => setIsVisible(true), 150);
  }, []);

  const hideHint = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className={cn("relative inline-flex", className)}
      onMouseEnter={showHint}
      onMouseLeave={hideHint}
      onFocus={showHint}
      onBlur={hideHint}
    >
      {children}
      
      {isVisible && (
        <div 
          className={cn(
            "absolute z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md shadow-lg whitespace-nowrap pointer-events-none",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            positionClasses[side]
          )}
          role="tooltip"
        >
          {hint}
          {/* Arrow */}
          <div 
            className={cn(
              "absolute w-2 h-2 bg-black/90 rotate-45",
              side === 'top' && "top-full left-1/2 -translate-x-1/2 -mt-1",
              side === 'bottom' && "bottom-full left-1/2 -translate-x-1/2 -mb-1",
              side === 'left' && "left-full top-1/2 -translate-y-1/2 -ml-1",
              side === 'right' && "right-full top-1/2 -translate-y-1/2 -mr-1"
            )}
          />
        </div>
      )}
    </div>
  );
}

export default CallMenuHint;
