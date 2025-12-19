import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion or is on a low-power device
 * Returns true if animations should be reduced/disabled
 */
export const useReducedMotion = () => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    // Check for user preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check if on mobile (likely lower performance)
    const isMobile = window.innerWidth < 768;
    
    // Check device memory if available (Chrome only)
    const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    
    // Check hardware concurrency (fewer cores = less power)
    const hasLowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    
    // Reduce motion on mobile or low-power devices
    setShouldReduceMotion(prefersReducedMotion || (isMobile && (hasLowMemory || hasLowCores)) || isMobile);

    // Listen for changes in preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduceMotion(e.matches || isMobile);
    };

    mediaQuery.addEventListener('change', handleChange);

    // Also update on resize
    const handleResize = () => {
      const nowMobile = window.innerWidth < 768;
      setShouldReduceMotion(prefersReducedMotion || nowMobile);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return shouldReduceMotion;
};
