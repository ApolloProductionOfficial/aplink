import { useState, useEffect } from "react";

/**
 * Hook that hides element during scroll and shows it when scrolling stops
 * @param mobileOnly - If true, only applies on mobile devices (< 768px)
 * @param delay - Delay in ms before showing element after scroll stops (default: 200)
 */
export const useScrollVisibility = (mobileOnly: boolean = false, delay: number = 200) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let scrollTimer: NodeJS.Timeout;

    const handleScroll = () => {
      // Check if should apply only on mobile
      if (mobileOnly && window.innerWidth >= 768) {
        setIsVisible(true);
        return;
      }

      // Hide immediately when scrolling
      setIsVisible(false);

      // Clear existing timer
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      // Show after delay when scrolling stops
      scrollTimer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    };

    handleScroll(); // Initial check
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll); // Check on resize
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, [mobileOnly, delay]);

  return isVisible;
};
