import { supabase } from "@/integrations/supabase/client";

interface ErrorNotificationParams {
  errorType: string;
  errorMessage: string;
  details?: Record<string, unknown>;
  source: string;
}

// Rate limiting: track last send time and queue
let lastSendTime = 0;
const MIN_INTERVAL_MS = 1000; // 1 second between requests
let pendingNotification: ErrorNotificationParams | null = null;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

const sendNotificationInternal = async (params: ErrorNotificationParams): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-error-notification", {
      body: params,
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
}: ErrorNotificationParams): Promise<boolean> => {
  const now = Date.now();
  const timeSinceLastSend = now - lastSendTime;
  
  const params = { errorType, errorMessage, details, source };
  
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
          await sendNotificationInternal(toSend);
        }
      }, delay);
    }
    
    return true; // Queued successfully
  }
  
  // Send immediately
  lastSendTime = now;
  return sendNotificationInternal(params);
};

// Specific error types
export const notifyElevenLabsError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "ELEVENLABS_ERROR",
    errorMessage,
    details,
    source: "ElevenLabs Transcription",
  });
};

export const notifyAPIError = async (apiName: string, errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "API_ERROR",
    errorMessage,
    details,
    source: apiName,
  });
};

export const notifyDatabaseError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "DATABASE_ERROR",
    errorMessage,
    details,
    source: "Database",
  });
};

export const notifyAuthError = async (errorMessage: string, details?: Record<string, unknown>) => {
  return sendErrorNotification({
    errorType: "AUTH_ERROR",
    errorMessage,
    details,
    source: "Authentication",
  });
};
