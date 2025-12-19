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
      },
      source: "Promise",
    });
  };

  // Intercept console.error to catch logged errors
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    
    // Only send for significant errors (avoid noise)
    const message = args.map(arg => 
      typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    
    // Skip common non-critical errors
    if (
      message.includes("Warning:") ||
      message.includes("DevTools") ||
      message.includes("favicon") ||
      message.includes("ResizeObserver") ||
      message.includes("ChunkLoadError")
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
        },
        source: "Console",
      });
    }
  };

  console.log("Global error handlers initialized");
}
