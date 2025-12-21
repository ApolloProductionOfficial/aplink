import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported languages with their codes
const LANGUAGE_CODES: Record<string, string> = {
  'en': 'eng',
  'ru': 'rus', 
  'uk': 'ukr',
  'es': 'spa',
  'de': 'deu',
  'fr': 'fra',
  'it': 'ita',
  'pt': 'por',
  'zh': 'cmn',
  'ja': 'jpn',
  'ko': 'kor',
  'ar': 'ara',
};

const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'ru': 'Russian',
  'uk': 'Ukrainian',
  'es': 'Spanish',
  'de': 'German',
  'fr': 'French',
  'it': 'Italian',
  'pt': 'Portuguese',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
};

// Voice IDs for different languages
const VOICE_IDS: Record<string, string> = {
  'en': 'EXAVITQu4vr4xnSDxMaL', // Sarah - English
  'ru': 'onwK4e9ZLuTAKqWW03F9', // Daniel - works well for Russian
  'uk': 'onwK4e9ZLuTAKqWW03F9', // Daniel
  'es': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'de': 'JBFqnCBsd6RMkjVDRZzb', // George
  'fr': 'XrExE9yKIg1WjnnlVkGX', // Matilda
  'it': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'pt': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'zh': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'ja': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'ko': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  'ar': 'onwK4e9ZLuTAKqWW03F9', // Daniel
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const targetLanguage = formData.get("targetLanguage") as string || 'ru';
    const sourceLanguage = formData.get("sourceLanguage") as string | null;

    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size}`);
    console.log(`Target language: ${targetLanguage}, Source language: ${sourceLanguage || 'auto'}`);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Transcribe audio using ElevenLabs Scribe
    console.log("Step 1: Transcribing audio...");
    const transcribeFormData = new FormData();
    transcribeFormData.append("file", audioFile);
    transcribeFormData.append("model_id", "scribe_v1");
    transcribeFormData.append("tag_audio_events", "false");
    transcribeFormData.append("diarize", "false");
    
    // Set source language if provided, otherwise auto-detect
    if (sourceLanguage && LANGUAGE_CODES[sourceLanguage]) {
      transcribeFormData.append("language_code", LANGUAGE_CODES[sourceLanguage]);
    }

    const transcribeResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: transcribeFormData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error("Transcription error:", transcribeResponse.status, errorText);
      throw new Error(`Transcription failed: ${transcribeResponse.status}`);
    }

    const transcription = await transcribeResponse.json();
    const originalText = transcription.text;
    
    if (!originalText || originalText.trim() === '') {
      console.log("No speech detected in audio");
      return new Response(
        JSON.stringify({ 
          originalText: '', 
          translatedText: '', 
          audioContent: null,
          detectedLanguage: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribed text: "${originalText.substring(0, 100)}..."`);

    // Detect source language from transcription if available
    const detectedLanguage = transcription.language_code || sourceLanguage || 'unknown';

    // Step 2: Translate using Lovable AI
    console.log("Step 2: Translating text...");
    const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional real-time interpreter. Translate the given text to ${LANGUAGE_NAMES[targetLanguage] || 'Russian'}. 
Rules:
- Provide ONLY the translation, nothing else
- Keep the original tone and style
- Preserve any proper nouns
- If the text is already in the target language, return it unchanged
- Be concise and natural sounding for speech synthesis`
          },
          {
            role: "user",
            content: originalText
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!translateResponse.ok) {
      const errorText = await translateResponse.text();
      console.error("Translation error:", translateResponse.status, errorText);
      throw new Error(`Translation failed: ${translateResponse.status}`);
    }

    const translateResult = await translateResponse.json();
    const translatedText = translateResult.choices?.[0]?.message?.content?.trim() || originalText;

    console.log(`Translated text: "${translatedText.substring(0, 100)}..."`);

    // Step 3: Synthesize speech using ElevenLabs TTS
    console.log("Step 3: Synthesizing speech...");
    const voiceId = VOICE_IDS[targetLanguage] || VOICE_IDS['en'];
    
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: translatedText,
          model_id: "eleven_turbo_v2_5", // Fast model for low latency
          output_format: "mp3_44100_128",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.1, // Slightly faster for real-time feel
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("TTS error:", ttsResponse.status, errorText);
      throw new Error(`TTS failed: ${ttsResponse.status}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    console.log("Translation pipeline completed successfully");

    return new Response(
      JSON.stringify({
        originalText,
        translatedText,
        audioContent: audioBase64,
        detectedLanguage,
        targetLanguage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Translation pipeline error:", errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
