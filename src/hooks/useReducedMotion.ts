import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion or is on a low-power device
 * Returns true if animations should be reduced/disabled
 */
export const useReducedMotion = () => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(() => {
    // Initial check on mount (SSR safe)
    if (typeof window === 'undefined') return false;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    
    return prefersReducedMotion || isMobile;
  });

  useEffect(() => {
    // Check for user preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check if on mobile (likely lower performance)
    const isMobile = window.innerWidth < 768;
    
    // Check device memory if available (Chrome only)
    const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    
    // Check hardware concurrency (fewer cores = less power)
    const hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    
    // Check for battery saver mode (if available)
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
    
    // Reduce motion on mobile or low-power devices
    const shouldReduce = prefersReducedMotion || isMobile || hasLowMemory || hasLowCores;
    setShouldReduceMotion(shouldReduce);

    // Listen for changes in preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduceMotion(e.matches || isMobile);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Also update on resize (debounced)
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
