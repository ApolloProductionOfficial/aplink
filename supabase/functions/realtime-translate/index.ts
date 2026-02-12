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

// Available voices with categories
const VOICES = {
  // Female voices
  'female-sarah': { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female' },
  'female-laura': { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female' },
  'female-alice': { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female' },
  'female-matilda': { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female' },
  'female-lily': { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female' },
  'female-jessica': { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female' },
  // Male voices
  'male-daniel': { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male' },
  'male-george': { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male' },
  'male-charlie': { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male' },
  'male-liam': { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male' },
  'male-brian': { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male' },
  'male-chris': { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', gender: 'male' },
  // Neutral voices
  'neutral-river': { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'neutral' },
  'neutral-alloy': { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'neutral' },
};

// Default voice per language (fallback)
const DEFAULT_VOICE_BY_LANG: Record<string, string> = {
  'en': 'female-sarah',
  'ru': 'male-daniel',
  'uk': 'male-daniel',
  'es': 'female-sarah',
  'de': 'male-george',
  'fr': 'female-matilda',
  'it': 'female-sarah',
  'pt': 'female-sarah',
  'zh': 'female-sarah',
  'ja': 'female-sarah',
  'ko': 'female-sarah',
  'ar': 'male-daniel',
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
    const voiceKey = formData.get("voiceId") as string | null;
    const previewText = formData.get("previewText") as string | null;

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    // If previewText is provided, skip transcription and translation - just generate TTS
    if (previewText) {
      console.log(`Voice preview requested for voice: ${voiceKey}`);
      
      const defaultVoiceKey = DEFAULT_VOICE_BY_LANG[targetLanguage] || 'female-sarah';
      const selectedVoiceKey = voiceKey && VOICES[voiceKey as keyof typeof VOICES] ? voiceKey : defaultVoiceKey;
      const voiceConfig = VOICES[selectedVoiceKey as keyof typeof VOICES] || VOICES['female-sarah'];
      const voiceId = voiceConfig.id;
      
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: previewText,
            model_id: "eleven_turbo_v2_5",
            output_format: "mp3_44100_128",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
              speed: 1.0,
            },
          }),
        }
      );

      if (!ttsResponse.ok) {
        throw new Error(`TTS preview failed: ${ttsResponse.status}`);
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      const audioBase64 = base64Encode(audioBuffer);

      return new Response(
        JSON.stringify({
          originalText: previewText,
          translatedText: previewText,
          audioContent: audioBase64,
          voiceId: selectedVoiceKey,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    // LOVABLE_API_KEY no longer needed - using free MyMemory API for translation

    console.log(`Received audio file: ${audioFile.name}, size: ${audioFile.size}`);
    console.log(`Target language: ${targetLanguage}, Source language: ${sourceLanguage || 'auto'}, Voice: ${voiceKey || 'default'}`);

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
          detectedLanguage: null,
          voiceId: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Transcribed text: "${originalText.substring(0, 100)}..."`);

    // Detect source language from transcription if available
    const detectedLanguage = transcription.language_code || sourceLanguage || 'unknown';

    // Step 2: Translate using free MyMemory API (no API key needed)
    console.log("Step 2: Translating text...");
    
    // Detect source lang code from transcription
    const srcLangCode = sourceLanguage || detectedLanguage || 'en';
    
    let translatedText = originalText;
    
    // Only translate if source and target are different
    if (srcLangCode !== targetLanguage) {
      try {
        const langPair = `${srcLangCode}|${targetLanguage}`;
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=${langPair}`;
        
        const translateResponse = await fetch(myMemoryUrl);
        
        if (translateResponse.ok) {
          const translateResult = await translateResponse.json();
          if (translateResult?.responseData?.translatedText && translateResult?.responseStatus === 200) {
            translatedText = translateResult.responseData.translatedText;
          } else {
            console.warn("MyMemory returned no valid translation, using original text");
          }
        } else {
          console.error("MyMemory translation error:", translateResponse.status);
        }
      } catch (translateError) {
        console.error("Translation fetch failed:", translateError);
        // Continue with original text as fallback
      }
    }

    console.log(`Translated text: "${translatedText.substring(0, 100)}..."`);

    // Step 3: Synthesize speech using ElevenLabs TTS (with fallback)
    console.log("Step 3: Synthesizing speech...");
    
    // Get voice ID - use provided voice or default for language
    const defaultVoiceKey = DEFAULT_VOICE_BY_LANG[targetLanguage] || 'female-sarah';
    const selectedVoiceKey = voiceKey && VOICES[voiceKey as keyof typeof VOICES] ? voiceKey : defaultVoiceKey;
    const voiceConfig = VOICES[selectedVoiceKey as keyof typeof VOICES] || VOICES['female-sarah'];
    const voiceId = voiceConfig.id;
    
    console.log(`Using voice: ${voiceConfig.name} (${voiceConfig.gender})`);
    
    let audioBase64: string | null = null;
    let useBrowserTTS = false;
    
    try {
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
        // Check for payment/auth issues - signal client to use browser TTS
        if (ttsResponse.status === 401 || ttsResponse.status === 403 || ttsResponse.status === 402) {
          console.log("ElevenLabs auth/payment issue, signaling browser TTS fallback");
          useBrowserTTS = true;
        } else {
          throw new Error(`TTS failed: ${ttsResponse.status}`);
        }
      } else {
        const audioBuffer = await ttsResponse.arrayBuffer();
        audioBase64 = base64Encode(audioBuffer);
      }
    } catch (ttsError) {
      console.error("TTS request failed:", ttsError);
      useBrowserTTS = true;
    }

    console.log(`Translation pipeline completed. Audio: ${audioBase64 ? 'ElevenLabs' : 'Browser fallback needed'}`);

    return new Response(
      JSON.stringify({
        originalText,
        translatedText,
        audioContent: audioBase64,
        detectedLanguage,
        targetLanguage,
        voiceId: selectedVoiceKey,
        useBrowserTTS, // Signal client to use Web Speech API
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
