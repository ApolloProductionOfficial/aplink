import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook that hides element during scroll and shows it when scrolling stops
 * with smooth debounced behavior to prevent jittering
 * @param mobileOnly - If true, only applies on mobile devices (< 768px)
 * @param delay - Delay in ms before showing element after scroll stops (default: 300)
 */
export const useScrollVisibility = (mobileOnly: boolean = false, delay: number = 300) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isScrolling = useRef(false);
  const ticking = useRef(false);

  const handleScroll = useCallback(() => {
    // Check if should apply only on mobile
    if (mobileOnly && window.innerWidth >= 768) {
      setIsVisible(true);
      return;
    }

    const currentScrollY = window.scrollY;
    const scrollDelta = Math.abs(currentScrollY - lastScrollY.current);
    
    // Only react to significant scroll movements (prevents micro-jitter)
    if (scrollDelta < 5) return;
    
    lastScrollY.current = currentScrollY;

    // Mark as scrolling and hide
    if (!isScrolling.current) {
      isScrolling.current = true;
      setIsVisible(false);
    }

    // Clear existing timer
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Show after delay when scrolling stops
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
      setIsVisible(true);
    }, delay);
  }, [mobileOnly, delay]);

  useEffect(() => {
    const onScroll = () => {
      // Use requestAnimationFrame for throttling
      if (!ticking.current) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, [handleScroll]);

  return isVisible;
};
