import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion or is on a low-power device
 * Returns true if animations should be reduced/disabled
 * Note: Safari is NOT disabled - we use optimizations instead
 */
export const useReducedMotion = () => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    
    // Only disable on mobile or explicit user preference - NOT Safari
    return prefersReducedMotion || isMobile;
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    
    // Check device memory if available (Chrome only)
    const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    
    // Check for battery saver mode
    const checkBattery = async () => {
      try {
        const battery = await (navigator as any).getBattery?.();
        if (battery && battery.level < 0.2 && !battery.charging) {
          setShouldReduceMotion(true);
        }
      } catch {
        // Battery API not available
      }
    };
    checkBattery();
    
    // Reduce motion on mobile, low-power devices, or user preference - but NOT Safari
    const shouldReduce = prefersReducedMotion || isMobile || hasLowMemory;
    setShouldReduceMotion(shouldReduce);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduceMotion(e.matches || isMobile);
    };

    mediaQuery.addEventListener('change', handleChange);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const nowMobile = window.innerWidth < 768;
        setShouldReduceMotion(prefersReducedMotion || nowMobile);
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return shouldReduceMotion;
};
