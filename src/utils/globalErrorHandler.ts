import { sendErrorNotification } from './errorNotification';

// Dedupe: track errors to prevent spam (5 min window)
const sentErrors = new Set<string>();

function getErrorKey(message: string, source?: string): string {
  return `${message}::${source || 'unknown'}`;
}

export function initGlobalErrorHandlers() {
  // --- window.onerror ---
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = String(message || error?.message || 'Unknown error');

    // Filter out noise (browser extensions, non-app errors)
    if (
      errorMessage.includes('ResizeObserver') ||
      errorMessage.includes('Script error') ||
      errorMessage.includes('favicon') ||
      errorMessage.includes('disconnected port') ||
      errorMessage.includes('Extension context') ||
      errorMessage.includes('chrome-extension://') ||
      errorMessage.includes('moz-extension://') ||
      errorMessage.includes('safari-extension://') ||
      errorMessage.includes('TooltipProvider') ||
      errorMessage.includes('Tooltip') ||
      errorMessage.includes('grammarly') ||
      errorMessage.includes('Grammarly') ||
      errorMessage.includes('AdBlock') ||
      errorMessage.includes('adblock') ||
      errorMessage.includes('LastPass') ||
      errorMessage.includes('Bitwarden') ||
      errorMessage.includes('1Password') ||
      errorMessage.includes('__REACT_DEVTOOLS') ||
      errorMessage.includes('postMessage') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('dynamically imported module')
    ) {
      return false;
    }

    const errorKey = getErrorKey(errorMessage, String(source));
    if (sentErrors.has(errorKey)) return false;
    sentErrors.add(errorKey);
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    console.error('[GlobalError]', errorMessage);

    sendErrorNotification({
      errorType: 'JAVASCRIPT_ERROR',
      errorMessage,
      details: {
        source: String(source),
        lineno,
        colno,
        stack: error?.stack?.substring(0, 500),
      },
      source: 'JavaScript Runtime',
    });

    return false;
  };

  // --- unhandledrejection ---
  window.onunhandledrejection = (event) => {
    const reason = event.reason;
    const errorMessage =
      reason?.message || (typeof reason === 'string' ? reason : 'Unhandled Promise Rejection');

    // Filter out noise (network, extensions, non-app errors, expected disconnects, WebRTC internals)
    if (
      errorMessage.includes('FunctionsFetchError') ||
      errorMessage.includes('FunctionsHttpError') ||
      errorMessage.includes('AbortError') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('Load failed') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('TooltipProvider') ||
      errorMessage.includes('Tooltip') ||
      errorMessage.includes('chrome-extension://') ||
      errorMessage.includes('moz-extension://') ||
      errorMessage.includes('safari-extension://') ||
      errorMessage.includes('disconnected port') ||
      errorMessage.includes('grammarly') ||
      errorMessage.includes('Grammarly') ||
      errorMessage.includes('Loading chunk') ||
      errorMessage.includes('dynamically imported module') ||
      // Filter out expected billing/credit errors
      errorMessage.includes('credits exhausted') ||
      errorMessage.includes('payment_required') ||
      errorMessage.includes('Edge function returned 402') ||
      // Filter out expected LiveKit disconnection reasons
      errorMessage.includes('"reason":3') ||
      errorMessage.includes('"reasonName":"Cancelled"') ||
      errorMessage.includes('Cancelled') ||
      // Filter out internal WebRTC errors (removeTrack sender mismatch)
      errorMessage.includes("removeTrack") ||
      errorMessage.includes("sender was not created by this peer connection") ||
      // Filter out NegotiationError - these are handled by app-level recovery
      (errorMessage.includes('NegotiationError') && !errorMessage.includes('critical'))
    ) {
      return;
    }

    const errorKey = getErrorKey(errorMessage, 'promise');
    if (sentErrors.has(errorKey)) return;
    sentErrors.add(errorKey);
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    console.error('[UnhandledRejection]', errorMessage);

    sendErrorNotification({
      errorType: 'PROMISE_REJECTION',
      errorMessage,
      details: {
        stack: reason?.stack?.substring(0, 500),
      },
      source: 'Promise',
    });
  };

  // --- console.error capture ---
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);

    const fullMessage = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');

    // Only report actual errors, not debug logs
    const lowerMessage = fullMessage.toLowerCase();
    if (!lowerMessage.includes('error') && !lowerMessage.includes('failed')) {
      return;
    }

    // Filter out noise (extensions, devtools, non-app errors, handled LiveKit issues)
    if (
      fullMessage.includes('DevTools') ||
      fullMessage.includes('favicon') ||
      fullMessage.includes('ResizeObserver') ||
      fullMessage.includes('disconnected port') ||
      fullMessage.includes('chrome-extension://') ||
      fullMessage.includes('moz-extension://') ||
      fullMessage.includes('safari-extension://') ||
      fullMessage.includes('TooltipProvider') ||
      fullMessage.includes('Tooltip') ||
      fullMessage.includes('ErrorBoundary caught') || // Already handled by ErrorBoundary
      fullMessage.includes('grammarly') ||
      fullMessage.includes('Grammarly') ||
      fullMessage.includes('AdBlock') ||
      fullMessage.includes('adblock') ||
      fullMessage.includes('LastPass') ||
      fullMessage.includes('Bitwarden') ||
      fullMessage.includes('1Password') ||
      fullMessage.includes('__REACT_DEVTOOLS') ||
      fullMessage.includes('postMessage') ||
      fullMessage.includes('Loading chunk') ||
      fullMessage.includes('dynamically imported module') ||
      // Filter out expected billing/credit limit errors
      fullMessage.includes('credits exhausted') ||
      fullMessage.includes('payment_required') ||
      fullMessage.includes('Not enough credits') ||
      fullMessage.includes('Edge function returned 402') ||
      fullMessage.includes('FunctionsHttpError') ||
      fullMessage.includes('[Captions] Translation error') ||
      fullMessage.includes('Translation error:') ||
      // Filter out internal WebRTC errors
      fullMessage.includes("removeTrack") ||
      fullMessage.includes("sender was not created by this peer connection") ||
      // Filter out expected/handled LiveKit logs
      fullMessage.includes('[LiveKitRoom] NegotiationError') ||
      fullMessage.includes('[LiveKitRoom] Reconnecting') ||
      fullMessage.includes('"reasonName":"Cancelled"') ||
      fullMessage.includes('"reason":3')
    ) {
      return;
    }

    const errorKey = getErrorKey(fullMessage.substring(0, 200), 'console');
    if (sentErrors.has(errorKey)) return;
    sentErrors.add(errorKey);
    setTimeout(() => sentErrors.delete(errorKey), 5 * 60 * 1000);

    sendErrorNotification({
      errorType: 'CONSOLE_ERROR',
      errorMessage: fullMessage.substring(0, 500),
      details: {
        fullMessage: fullMessage.substring(0, 1000),
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      source: 'Console',
    });
  };
}
