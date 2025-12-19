import { supabase } from "@/integrations/supabase/client";

interface ErrorNotificationParams {
  errorType: string;
  errorMessage: string;
  details?: Record<string, unknown>;
  source: string;
}

export const sendErrorNotification = async ({
  errorType,
  errorMessage,
  details,
  source,
}: ErrorNotificationParams): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-error-notification", {
      body: {
        errorType,
        errorMessage,
        details,
        source,
      },
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
