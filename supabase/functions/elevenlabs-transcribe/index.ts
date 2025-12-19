import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to send error notification
async function sendErrorNotification(errorType: string, errorMessage: string, details?: Record<string, unknown>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Cannot send notification: Supabase not configured");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.functions.invoke("send-error-notification", {
      body: {
        errorType,
        errorMessage,
        details,
        source: "ElevenLabs Transcription",
      },
    });
    
    console.log("Error notification sent for:", errorType);
  } catch (err) {
    console.error("Failed to send error notification:", err);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    
    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    console.log("Received audio file:", audioFile.name, "size:", audioFile.size);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      await sendErrorNotification(
        "ELEVENLABS_CONFIG_ERROR",
        "ELEVENLABS_API_KEY не настроен. Пожалуйста, добавьте API ключ в секреты.",
        { timestamp: new Date().toISOString() }
      );
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const apiFormData = new FormData();
    apiFormData.append("file", audioFile);
    apiFormData.append("model_id", "scribe_v1");
    apiFormData.append("tag_audio_events", "false");
    apiFormData.append("diarize", "true");
    apiFormData.append("language_code", "rus");

    console.log("Sending to ElevenLabs API...");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      
      // Check for specific error types
      let errorType = "ELEVENLABS_API_ERROR";
      let friendlyMessage = `ElevenLabs API ошибка: ${response.status}`;
      
      if (response.status === 401 || response.status === 403) {
        errorType = "ELEVENLABS_AUTH_ERROR";
        friendlyMessage = "Проблема с авторизацией ElevenLabs. Возможно, API ключ недействителен или подписка закончилась.";
      } else if (response.status === 402) {
        errorType = "ELEVENLABS_SUBSCRIPTION_ERROR";
        friendlyMessage = "Подписка ElevenLabs закончилась или превышен лимит использования. Необходимо продлить подписку.";
      } else if (response.status === 429) {
        errorType = "ELEVENLABS_RATE_LIMIT";
        friendlyMessage = "Превышен лимит запросов к ElevenLabs API. Подождите перед повторной попыткой.";
      }
      
      // Send notification for serious errors
      if (response.status === 401 || response.status === 402 || response.status === 403) {
        await sendErrorNotification(errorType, friendlyMessage, {
          statusCode: response.status,
          errorText,
          timestamp: new Date().toISOString(),
        });
      }
      
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const transcription = await response.json();
    console.log("Transcription received:", transcription.text?.substring(0, 100));

    return new Response(JSON.stringify(transcription), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Transcription error:", errorMessage);
    
    // Send notification for unexpected errors
    if (!errorMessage.includes("ElevenLabs API error")) {
      await sendErrorNotification(
        "ELEVENLABS_UNEXPECTED_ERROR",
        errorMessage,
        { timestamp: new Date().toISOString() }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
