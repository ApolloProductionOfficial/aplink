import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Hard refresh page for aggressive cache bypass.
 * 
 * When the browser (especially WebKit/Safari/Telegram Desktop) aggressively caches
 * old builds, redirecting to this route forces:
 * 1. Service Worker unregistration
 * 2. Cache Storage API clearing
 * 3. Fresh page load with cache-bust query param
 * 
 * This ensures users always get the latest application version after crashes
 * or when exiting calls.
 */
const Refresh = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'clearing' | 'redirecting'>('clearing');

  useEffect(() => {
    const performHardRefresh = async () => {
      const targetPath = searchParams.get("to") || "/";
      const timestamp = Date.now();

      console.log("[Refresh] Starting hard cache bypass...");

      // Step 1: Unregister all Service Workers
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            await Promise.all(registrations.map(r => r.unregister()));
            console.log("[Refresh] Unregistered", registrations.length, "service workers");
          }
        }
      } catch (e) {
        console.warn("[Refresh] Service worker cleanup failed:", e);
      }

      // Step 2: Clear Cache Storage API
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map(k => caches.delete(k)));
            console.log("[Refresh] Cleared", keys.length, "cache entries");
          }
        }
      } catch (e) {
        console.warn("[Refresh] Cache cleanup failed:", e);
      }

      // Step 3: Clear specific sessionStorage keys related to error recovery
      // (but NOT localStorage to preserve auth session)
      try {
        const keysToRemove = [
          'aplink_hook_reload_attempted',
          'aplink_tooltip_reload_attempted',
        ];
        keysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
        });
        console.log("[Refresh] Cleared session storage recovery keys");
      } catch (e) {
        console.warn("[Refresh] Session storage cleanup failed:", e);
      }

      // Step 4: Build target URL with cache-bust
      const url = new URL(targetPath, window.location.origin);
      url.searchParams.set("__cb", String(timestamp));

      setStatus('redirecting');
      console.log("[Refresh] Redirecting to:", url.toString());

      // Small delay to ensure cleanup completes
      await new Promise(resolve => setTimeout(resolve, 100));

      // Replace to avoid back-button loop
      window.location.replace(url.toString());
    };

    performHardRefresh();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">
          {status === 'clearing' ? 'Очистка кэша...' : 'Обновление...'}
        </p>
      </div>
    </div>
  );
};

export default Refresh;
