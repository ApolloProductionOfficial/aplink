import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useRef, useCallback, useEffect } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const toasterRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  // Handle swipe up to dismiss
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchStartY.current - touchEndY;
    
    // Swipe up threshold (50px)
    if (deltaY > 50) {
      // Find the toast element and dismiss it
      const toastElement = (e.target as HTMLElement).closest('[data-sonner-toast]');
      if (toastElement) {
        const toastId = toastElement.getAttribute('data-sonner-toast');
        if (toastId) {
          toast.dismiss(toastId);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Add swipe listeners to document for toast elements
    const handleDocTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-sonner-toast]')) {
        handleTouchStart(e);
      }
    };
    
    const handleDocTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-sonner-toast]')) {
        handleTouchEnd(e);
      }
    };

    document.addEventListener('touchstart', handleDocTouchStart, { passive: true });
    document.addEventListener('touchend', handleDocTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleDocTouchStart);
      document.removeEventListener('touchend', handleDocTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={2000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg touch-pan-y",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
