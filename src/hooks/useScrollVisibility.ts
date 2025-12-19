import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook that hides element while the page is scrolling and shows it when scrolling truly stops.
 * Designed to avoid mobile "jitter" caused by momentum scroll / address-bar bounce.
 */
export const useScrollVisibility = (mobileOnly: boolean = false, delay: number = 300) => {
  const [isVisible, setIsVisible] = useState(true);

  const lastEventTs = useRef(0);
  const lastY = useRef(0);
  const rafId = useRef<number | null>(null);
  const stableFrames = useRef(0);
  const lastShownTs = useRef(0);

  const stopRaf = useCallback(() => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  const startStopDetector = useCallback(() => {
    if (rafId.current != null) return;

    const tick = () => {
      // keep visible on desktop when mobileOnly=true
      if (mobileOnly && window.innerWidth >= 768) {
        stableFrames.current = 0;
        setIsVisible(true);
        stopRaf();
        return;
      }

      const now = Date.now();
      const y = window.scrollY;
      const dy = Math.abs(y - lastY.current);
      const timeSinceLastEvent = now - lastEventTs.current;

      // Consider scroll "stopped" only after N stable frames AND delay passed
      if (timeSinceLastEvent > delay && dy < 0.5) {
        stableFrames.current += 1;
      } else {
        stableFrames.current = 0;
        lastY.current = y;
      }

      if (stableFrames.current >= 3) {
        setIsVisible(true);
        lastShownTs.current = now;
        stableFrames.current = 0;
        stopRaf();
        return;
      }

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  }, [delay, mobileOnly, stopRaf]);

  const onScroll = useCallback(() => {
    if (mobileOnly && window.innerWidth >= 768) {
      setIsVisible(true);
      return;
    }

    const now = Date.now();
    const y = window.scrollY;

    // Ignore tiny jitters (iOS bounce / address-bar)
    if (Math.abs(y - lastY.current) < 3) {
      lastEventTs.current = now;
      startStopDetector();
      return;
    }

    lastEventTs.current = now;
    lastY.current = y;

    // Prevent immediate hide right after showing (fixes "triple pop")
    if (now - lastShownTs.current > 450) {
      setIsVisible(false);
    }

    startStopDetector();
  }, [mobileOnly, startStopDetector]);

  useEffect(() => {
    lastEventTs.current = Date.now();
    lastY.current = window.scrollY;

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      stopRaf();
    };
  }, [onScroll, stopRaf]);

  return isVisible;
};
