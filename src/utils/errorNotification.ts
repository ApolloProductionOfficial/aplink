import { supabase } from "@/integrations/supabase/client";

interface ErrorNotificationParams {
  errorType: string;
  errorMessage: string;
  details?: Record<string, unknown>;
  source: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

// Severity levels - only 'error' and 'critical' will send email notifications
type SeverityLevel = 'info' | 'warning' | 'error' | 'critical';

// Patterns to ignore completely (not even log to DB)
const IGNORED_PATTERNS = [
  'Warning:',
  'DevTools',
  'favicon',
  'ResizeObserver',
  'ChunkLoadError',
  '[hmr]',
  'Failed to fetch', // Network issues
  'AbortError',
  'net::ERR_',
  'Load failed',
  'Script error',
  'extension://',
  'chrome-extension://',
  'moz-extension://',
  // Ignore Jitsi-related parse errors
  'Failed to parse URL parameter',
];

// Patterns that are only warnings (log but don't email)
const WARNING_PATTERNS = [
  'Audio play failed',
  'Translation error: {}',
  'timeout',
  'CORS',
];

// Patterns that are critical (always email)
const CRITICAL_PATTERNS = [
  'auth',
  'payment',
  'security',
  'unauthorized',
  'forbidden',
  'database',
];

// Rate limiting: track last send time and queue
let lastSendTime = 0;
const MIN_INTERVAL_MS = 2000; // 2 seconds between requests
let pendingNotification: ErrorNotificationParams | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

// Determine severity based on error message patterns
const determineSeverity = (errorMessage: string, errorType: string): SeverityLevel => {
  const msgLower = errorMessage.toLowerCase();
  const typeLower = errorType.toLowerCase();
  
  // Check for critical patterns
  if (CRITICAL_PATTERNS.some(p => msgLower.includes(p) || typeLower.includes(p))) {
    return 'critical';
  }
  
  // Check for warning patterns
  if (WARNING_PATTERNS.some(p => msgLower.includes(p))) {
    return 'warning';
  }
  
  // Default based on error type
  if (typeLower.includes('error') || typeLower === 'react_error') {
    return 'error';
  }
  
  return 'warning';
};

// Should this error be ignored completely?
const shouldIgnore = (errorMessage: string): boolean => {
  return IGNORED_PATTERNS.some(p => errorMessage.includes(p));
};

// Should this error send an email notification?
const shouldNotify = (severity: SeverityLevel): boolean => {
  return severity === 'error' || severity === 'critical';
};

const sendNotificationInternal = async (params: ErrorNotificationParams & { severity: SeverityLevel }): Promise<boolean> => {
  try {
    // First, log to database (always, if not ignored)
    // Using raw insert to avoid type issues with newly created table
    const { error: dbError } = await supabase.from('error_logs').insert([{
      error_type: params.errorType,
      error_message: params.errorMessage.substring(0, 1000), // Limit message length
      source: params.source,
      severity: params.severity,
      details: params.details || null,
      url: (params.details?.url as string) || null,
      user_agent: (params.details?.userAgent as string) || null,
      notified: shouldNotify(params.severity),
    }] as any); // Use 'as any' until types regenerate
    
    if (dbError) {
      console.error("Failed to log error to database:", dbError);
    }

    // Only send email for error/critical severity
    if (!shouldNotify(params.severity)) {
      console.log(`Error logged (${params.severity}) but not emailed:`, params.errorType);
      return true;
    }

    const { data, error } = await supabase.functions.invoke("send-telegram-notification", {
      body: { ...params, severity: params.severity },
    });

    if (error) {
      console.error("Failed to send error notification:", error);
      return false;
    }

    console.log("Error notification sent:", data);
    return true;
  } catch (err) {
    console.error("Error sending notification:", err);
    return false;
  }
};

export const sendErrorNotification = async ({
  errorType,
  errorMessage,
  details,
  source,
  severity: explicitSeverity,
}: ErrorNotificationParams): Promise<boolean> => {
  // Check if this error should be ignored
  if (shouldIgnore(errorMessage)) {
    return true; // Pretend success but do nothing
  }
  
  // Determine severity
  const severity = explicitSeverity || determineSeverity(errorMessage, errorType);
  
  const now = Date.now();
  const timeSinceLastSend = now - lastSendTime;
  
  const params = { errorType, errorMessage, details, source, severity };
  
  // If we're within the rate limit window, queue this notification
  if (timeSinceLastSend < MIN_INTERVAL_MS) {
    // Store only the latest pending notification (discard previous if any)
    pendingNotification = params;
    
    // Set up a delayed send if not already scheduled
    if (!timeoutId) {
      const delay = MIN_INTERVAL_MS - timeSinceLastSend;
      timeoutId = setTimeout(async () => {
        timeoutId = null;
        if (pendingNotification) {
          const toSend = pendingNotification;
          pendingNotification = null;
          lastSendTime = Date.now();
          await sendNotificationInternal(toSend as ErrorNotificationParams & { severity: SeverityLevel });
        }
      }, delay);
    }
    
    return true; // Queued successfully
  }
  
  // Send immediately
  lastSendTime = now;
  return sendNotificationInternal(params);
};

// Specific error types with appropriate severity
export const notifyElevenLabsError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "ELEVENLABS_ERROR",
    errorMessage,
    details,
    source: "ElevenLabs Transcription",
    severity: 'error',
  });
};

export const notifyAPIError = async (apiName: string, errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "API_ERROR",
    errorMessage,
    details,
    source: apiName,
    severity: 'error',
  });
};

export const notifyDatabaseError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "DATABASE_ERROR",
    errorMessage,
    details,
    source: "Database",
    severity: 'critical',
  });
};

export const notifyAuthError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "AUTH_ERROR",
    errorMessage,
    details,
    source: "Authentication",
    severity: 'critical',
  });
};

export const notifySecurityError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "SECURITY_ERROR",
    errorMessage,
    details,
    source: "Security",
    severity: 'critical',
  });
};