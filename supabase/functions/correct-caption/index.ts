import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lingva Translate - free Google Translate proxy, no limits
async function translateWithLingva(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const instances = [
    'lingva.ml',
    'lingva.thedaviddelta.com',
    'translate.plausibility.cloud',
  ];
  
  for (const instance of instances) {
    try {
      const url = `https://${instance}/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        if (data?.translation) {
          console.log(`Lingva (${instance}) translation OK`);
          return data.translation;
        }
      }
    } catch (e) {
      console.warn(`Lingva instance ${instance} failed:`, e);
    }
  }
  return null;
}

// MyMemory - 50k chars/day with email
async function translateWithMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}&de=aplink@lovable.app`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data?.responseData?.translatedText && data?.responseStatus === 200) {
      // MyMemory returns "PLEASE SELECT TWO LANGUAGES" or similar on errors
      const result = data.responseData.translatedText;
      if (result.includes('PLEASE SELECT') || result.includes('MYMEMORY WARNING')) {
        return null;
      }
      return result;
    }
  } catch (e) {
    console.warn("MyMemory failed:", e);
  }
  return null;
}

// Cascading translation: MyMemory → Lingva → original text
async function translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  // Try MyMemory first (fast, good quality)
  const myMemoryResult = await translateWithMyMemory(text, sourceLang, targetLang);
  if (myMemoryResult) return myMemoryResult;
  
  // Fallback to Lingva (unlimited, uses Google Translate)
  const lingvaResult = await translateWithLingva(text, sourceLang, targetLang);
  if (lingvaResult) return lingvaResult;
  
  // Ultimate fallback: return original
  console.warn("All translation services failed, returning original text");
  return text;
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

    const srcLang = sourceLang || 'en';
    
    if (srcLang === targetLang) {
      return new Response(
        JSON.stringify({ corrected: originalText, translated: originalText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Translating "${originalText.substring(0, 50)}..." from ${srcLang} to ${targetLang}`);
    const translated = await translate(originalText, srcLang, targetLang);
    console.log(`Result: "${translated.substring(0, 50)}..."`);

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
