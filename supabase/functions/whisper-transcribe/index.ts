import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const provider = (formData.get('provider') as string) || 'groq';
    // Default Groq Whisper model; overridable via form field.
    const model = (formData.get('model') as string) || 'whisper-large-v3';

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Whisper] Received audio file:', audioFile.name, 'size:', audioFile.size, 'provider:', provider);

    // ---- OpenRouter path (chat-with-audio, kept for compatibility) ----
    if (provider === 'openrouter') {
      const key = Deno.env.get("OPENROUTER_API_KEY");
      if (!key) throw new Error("OPENROUTER_API_KEY is not configured");

      // Convert audio to base64 for the chat-completions audio payload
      const audioBuffer = await audioFile.arrayBuffer();
      const bytes = new Uint8Array(audioBuffer);
      const chunkSize = 8192;
      let binary = "";
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const audioBase64 = btoa(binary);

      const orModel = (formData.get('model') as string) || 'google/gemini-2.5-flash';
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://aplink.live',
          'X-Title': 'APLink by Apollo Production',
        },
        body: JSON.stringify({
          model: orModel,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Transcribe the following audio. Return ONLY the transcribed text, nothing else. If you cannot understand the audio or it's silent, return an empty string."
                },
                {
                  type: "input_audio",
                  input_audio: { data: audioBase64, format: "wav" }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Whisper] OpenRouter error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Transcription failed: ${response.status}`, text: '' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const transcribedText = data.choices?.[0]?.message?.content?.trim() || '';
      console.log('[Whisper] Result (openrouter):', transcribedText.substring(0, 100));
      return new Response(
        JSON.stringify({ text: transcribedText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Default path: Groq Whisper (OpenAI-compatible audio/transcriptions) ----
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) throw new Error("GROQ_API_KEY is not configured");

    const groqForm = new FormData();
    groqForm.append("file", audioFile, audioFile.name || "audio.wav");
    groqForm.append("model", model);
    groqForm.append("response_format", "json");
    groqForm.append("temperature", "0");

    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: groqForm,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Whisper] Groq error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Transcription failed: ${response.status}`, text: '' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const transcribedText = (data.text || '').trim();

    console.log('[Whisper] Result:', transcribedText.substring(0, 100));

    return new Response(
      JSON.stringify({ text: transcribedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Whisper] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', text: '' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
