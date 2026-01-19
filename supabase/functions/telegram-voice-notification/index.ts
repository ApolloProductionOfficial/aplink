import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");

// Voice IDs
const VOICES = {
  female: "FGY2WhTYpPnrIDTdsKH5", // Laura
  male: "JBFqnCBsd6RMkjVDRZzb", // George
};

interface VoiceNotificationRequest {
  telegram_id: string;
  caller_name: string;
  is_group_call?: boolean;
  participant_count?: number;
  user_id?: string; // Optional: to fetch user's voice preferences
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegram_id, caller_name, is_group_call, participant_count, user_id }: VoiceNotificationRequest = await req.json();

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    if (!telegram_id || !caller_name) {
      throw new Error("Missing required fields: telegram_id, caller_name");
    }

    console.log(`Generating voice notification for ${telegram_id} from ${caller_name}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's voice preferences if user_id provided or find by telegram_id
    let voicePreference: 'female' | 'male' = 'female';
    let voiceSpeed = 1.0;

    if (user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user_id)
        .single();

      if (profile) {
        voicePreference = (profile as Record<string, unknown>).voice_preference as 'female' | 'male' || 'female';
        voiceSpeed = (profile as Record<string, unknown>).voice_speed as number || 1.0;
      }
    } else {
      // Try to find user by telegram_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", parseInt(telegram_id))
        .single();

      if (profile) {
        voicePreference = (profile as Record<string, unknown>).voice_preference as 'female' | 'male' || 'female';
        voiceSpeed = (profile as Record<string, unknown>).voice_speed as number || 1.0;
      }
    }

    const voiceId = VOICES[voicePreference];
    console.log(`Using voice: ${voicePreference} (${voiceId}), speed: ${voiceSpeed}`);

    // Generate voice message text
    let messageText: string;
    if (is_group_call && participant_count) {
      messageText = `Внимание! Вас приглашают в групповой звонок. Организатор: ${caller_name}. Участников: ${participant_count}. Откройте АП Линк чтобы присоединиться.`;
    } else {
      messageText = `Внимание! Входящий звонок от ${caller_name}. Откройте АП Линк чтобы присоединиться к разговору.`;
    }

    // Generate audio using ElevenLabs TTS
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: messageText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: voiceSpeed,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("ElevenLabs API error:", errorText);
      throw new Error(`ElevenLabs API error: ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(`Generated audio: ${audioBuffer.byteLength} bytes`);

    // Create form data for Telegram
    const formData = new FormData();
    formData.append("chat_id", telegram_id);
    formData.append("voice", new Blob([audioBuffer], { type: "audio/mpeg" }), "voice.mp3");
    formData.append("caption", is_group_call 
      ? `🎥 Групповой звонок от ${caller_name}`
      : `📞 Входящий звонок от ${caller_name}`
    );

    // Send voice message via Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`,
      {
        method: "POST",
        body: formData,
      }
    );

    const telegramData = await telegramResponse.json();
    console.log("Telegram voice message sent:", telegramData.ok);

    if (!telegramData.ok) {
      console.error("Telegram API error:", telegramData);
      throw new Error(`Telegram API error: ${telegramData.description}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: telegramData.result?.message_id,
        voice_used: voicePreference,
        speed_used: voiceSpeed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Voice notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
