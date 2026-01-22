import { sendErrorNotification } from "./errorNotification";

// Track sent errors to avoid duplicates
const sentErrors = new Set<string>();

function getErrorKey(message: string, source?: string): string {
  return `${message}-${source || "unknown"}`;
}

// Initialize global error handlers
export function initGlobalErrorHandlers() {
  // Handle uncaught JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    const errorKey = getErrorKey(String(message), source);
    
    if (sentErrors.has(errorKey)) return;
    sentErrors.add(errorKey);
    
    // Clear after 5 minutes to allow re-reporting
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    console.error("Global error:", { message, source, lineno, colno, error });

    sendErrorNotification({
      errorType: "JAVASCRIPT_ERROR",
      errorMessage: String(message),
      details: {
        source,
        line: lineno,
        column: colno,
        stack: error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      source: "JavaScript Runtime",
    });

    return false;
  };

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event) => {
    const message = event.reason?.message || String(event.reason);
    const errorKey = getErrorKey(message, "promise");
    
    if (sentErrors.has(errorKey)) return;
    sentErrors.add(errorKey);
    
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    console.error("Unhandled promise rejection:", event.reason);

    sendErrorNotification({
      errorType: "PROMISE_REJECTION",
      errorMessage: message,
      details: {
        stack: event.reason?.stack,
        reason: String(event.reason),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      source: "Promise",
    });
  };

  // Intercept console.error to catch logged errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    
    // Only send for significant errors (avoid noise)
    const message = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
    
    // Skip common non-critical errors, browser extension errors, and Telegram mini app specific errors
    if (
      message.includes("Warning:") ||
      // Internal logging from our own handlers (prevents double-reporting)
      message.includes("Global error:") ||
      message.includes("Unhandled promise rejection:") ||
      message.includes("Failed to log error to database") ||
      message.includes("Failed to send error notification") ||
      message.includes("DevTools") ||
      message.includes("favicon") ||
      message.includes("ResizeObserver") ||
      message.includes("ChunkLoadError") ||
      message.includes("chrome-extension://") ||
      message.includes("disconnected port object") ||
      message.includes("TelegramGameProxy") ||
      message.includes("TelegramWebviewProxy") ||
      message.includes("Telegram.WebApp") ||
      message.includes("postEvent") ||
      message.includes("web_app_") ||
      message.includes("tgWebAppData") ||
      message.includes("themeParams") ||
      message.includes("viewport_changed") ||
      message.includes("main_button") ||
      message.includes("back_button") ||
      message.includes("popup_closed") ||
      message.includes("initDataUnsafe") ||
      // Radix UI context errors (Safari compatibility) - COMPLETELY IGNORE
      message.includes("TooltipProvider") ||
      message.includes("Tooltip must be used") ||
      message.includes("TooltipProviderProvider") ||
      // ErrorBoundary duplicate errors - skip ALL ErrorBoundary logs
      message.includes("ErrorBoundary") ||
      message.includes("caught error") ||
      message.includes("REACT_ERROR") ||
      // Generic non-actionable errors
      message.includes("No message") ||
      message.includes("componentStack") ||
      // Empty error objects
      message === "{}" ||
      message.startsWith("ErrorBoundary caught error: {}")
    ) {
      return;
    }

    const errorKey = getErrorKey(message.substring(0, 100), "console");
    if (sentErrors.has(errorKey)) return;
    sentErrors.add(errorKey);
    
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    // Only send for actual errors, not warnings
    if (message.toLowerCase().includes("error") || message.includes("failed")) {
      sendErrorNotification({
        errorType: "CONSOLE_ERROR",
        errorMessage: message.substring(0, 500),
        details: {
          fullMessage: message,
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
        source: "Console",
      });
    }
  };

  console.log("Global error handlers initialized");
}
