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
    
    // DIAGNOSTIC MODE: Only skip truly internal messages to prevent infinite loops
    if (
      message.includes("[GlobalErrorHandler]") ||
      message.includes("GlobalErrorHandler:") ||
      message.includes("[DEBUG ErrorBoundary]") ||
      message.includes("Download the React DevTools") ||
      message.includes("Download the Apollo DevTools") ||
      message.includes("favicon") ||
      message.includes("ResizeObserver") ||
      message.includes("Global error:") ||
      message.includes("Unhandled promise rejection:") ||
      message.includes("Failed to log error to database") ||
      message.includes("Failed to send error notification")
    ) {
      return;
    }
    
    // DIAGNOSTIC: Log what we're seeing for debugging
    console.warn("[GlobalErrorHandler DIAGNOSTIC]", message.substring(0, 300));

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
