import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free MyMemory translation API - no API key needed
async function translateWithMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const langPair = `${sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error("MyMemory error:", response.status);
    return text; // fallback to original
  }
  
  const data = await response.json();
  const translated = data?.responseData?.translatedText;
  
  if (!translated || data?.responseStatus !== 200) {
    console.warn("MyMemory returned no translation, using original");
    return text;
  }
  
  return translated;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, targetLang, sourceLang } = await req.json();
    
    if (!originalText) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Detect source language - default to 'en' if not provided
    const srcLang = sourceLang || 'en';
    
    // If source and target are the same, just return original
    if (srcLang === targetLang) {
      return new Response(
        JSON.stringify({ corrected: originalText, translated: originalText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Translating "${originalText.substring(0, 50)}..." from ${srcLang} to ${targetLang}`);

    const translated = await translateWithMyMemory(originalText, srcLang, targetLang);
    
    console.log(`Translated: "${translated.substring(0, 50)}..."`);

    return new Response(
      JSON.stringify({ corrected: originalText, translated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Correct caption error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
