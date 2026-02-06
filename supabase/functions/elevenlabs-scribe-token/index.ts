import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function to get a single-use token for ElevenLabs Scribe Realtime WebSocket
 * This token is used for ultra-low latency streaming transcription
 * 
 * Token validity: 15 minutes
 * Usage: Client connects to WebSocket with this token for realtime STT
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      console.error("[Scribe Token] ELEVENLABS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("[Scribe Token] Requesting single-use token for realtime scribe...");

    // Request single-use token for realtime scribe
    // Docs: https://elevenlabs.io/docs/cookbooks/speech-to-text/streaming
    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Scribe Token] Failed to get token:", response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `ElevenLabs API error: ${response.status}`,
          details: errorText 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const data = await response.json();
    console.log("[Scribe Token] Token obtained successfully");

    return new Response(
      JSON.stringify({ 
        token: data.token,
        expires_at: data.expires_at || Date.now() + 15 * 60 * 1000 // Default 15 min
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Scribe Token] Error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
