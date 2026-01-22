import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";

/**
 * Tracks user navigation paths (from -> to) to help spot UX drop-offs.
 * Uses existing analytics hook (currently logs only for authenticated users).
 */
export default function AnalyticsRouteTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const to = `${location.pathname}${location.search}`;
    const from = prevPathRef.current;
    prevPathRef.current = to;

    trackEvent({
      eventType: "page_view",
      pagePath: to,
      eventData: {
        from: from ?? null,
        to,
      },
    });
  }, [location.pathname, location.search, trackEvent]);

  return null;
}
