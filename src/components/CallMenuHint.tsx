import { cn } from '@/lib/utils';

interface CallMenuHintProps {
  children: React.ReactNode;
  hint: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * CSS-only hover-hint component for call menu buttons.
 * NO HOOKS - safe for conditional rendering.
 * Works in all environments (including Telegram WebView).
 */
export function CallMenuHint({ 
  children, 
  hint, 
  side = 'top',
  className 
}: CallMenuHintProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1',
  };

  return (
    <div className={cn("relative inline-flex group", className)}>
      {children}
      
      {/* CSS-only tooltip - uses group-hover for visibility */}
      <div 
        className={cn(
          "absolute z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-black/90 rounded-md shadow-lg whitespace-nowrap pointer-events-none",
          "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100",
          "group-focus-within:opacity-100 group-focus-within:scale-100",
          "transition-all duration-150",
          positionClasses[side]
        )}
        role="tooltip"
      >
        {hint}
        {/* Arrow */}
        <div 
          className={cn(
            "absolute w-2 h-2 bg-black/90 rotate-45",
            arrowClasses[side]
          )}
        />
      </div>
    </div>
  );
}

export default CallMenuHint;
