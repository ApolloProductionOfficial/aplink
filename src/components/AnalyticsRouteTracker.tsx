import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Generate or get anonymous session ID
const getAnonSessionId = () => {
  let sessionId = sessionStorage.getItem("analytics_anon_session_id");
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("analytics_anon_session_id", sessionId);
  }
  return sessionId;
};

/**
 * Tracks user navigation paths (from -> to) to help spot UX drop-offs.
 * Supports both authenticated users (via hook) and anonymous users (via Edge Function).
 */
export default function AnalyticsRouteTracker() {
  const location = useLocation();
  const { trackEvent } = useAnalytics();
  const { user } = useAuth();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const to = `${location.pathname}${location.search}`;
    const from = prevPathRef.current;
    prevPathRef.current = to;

    const eventData = {
      from: from ?? null,
      to,
    };

    if (user?.id) {
      // Authenticated user: use existing hook (direct insert)
      trackEvent({
        eventType: "page_view",
        pagePath: to,
        eventData,
      });
    } else {
      // Anonymous user: send via Edge Function
      const sessionId = getAnonSessionId();
      supabase.functions
        .invoke("track-anonymous-event", {
          body: {
            eventType: "page_view",
            pagePath: to,
            eventData,
            sessionId,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
          },
        })
        .catch(() => {
          // Silently ignore errors for anonymous tracking
        });
    }
  }, [location.pathname, location.search, trackEvent, user?.id]);

  return null;
}
