import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Forced refresh page for WebKit cache bypass.
 * When WebKit (Safari/Telegram Desktop) aggressively caches old builds,
 * redirecting to this route forces a fresh page load.
 */
const Refresh = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const targetPath = searchParams.get("to") || "/";
    const timestamp = Date.now();

    // Build target URL with cache-bust
    const url = new URL(targetPath, window.location.origin);
    url.searchParams.set("__cb", String(timestamp));

    // Log for diagnostics
    console.log("[Refresh] Forcing cache bypass redirect to:", url.toString());

    // Replace to avoid back-button loop
    window.location.replace(url.toString());
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Обновление...</p>
      </div>
    </div>
  );
};

export default Refresh;
