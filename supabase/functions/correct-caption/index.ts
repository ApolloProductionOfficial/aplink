import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Translate (gtx) - free, public, supports auto source detection.
// Most reliable free endpoint; primary path. Returns { translated, detected }.
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<{ translated: string; detected: string } | null> {
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx` +
      `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(targetLang)}` +
      `&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!response.ok) return null;
    const data = await response.json();
    // data[0] = array of [translatedChunk, originalChunk, ...]; data[2] = detected src
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((seg: unknown) => (Array.isArray(seg) ? seg[0] : ''))
        .join('');
      const detected = typeof data[2] === 'string' ? data[2] : sl;
      if (translated && translated.trim()) {
        console.log('Google gtx OK');
        return { translated, detected };
      }
    }
  } catch (e) {
    console.warn('Google gtx failed:', e);
  }
  return null;
}

// Lingva Translate - free Google Translate proxy, unlimited, best quality
async function translateWithLingva(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const instances = [
    'lingva.ml',
    'lingva.thedaviddelta.com',
    'translate.plausibility.cloud',
  ];

  // Lingva needs an explicit source; map 'auto' to its detection token.
  const src = sourceLang === 'auto' ? 'auto' : sourceLang;

  for (const instance of instances) {
    try {
      const url = `https://${instance}/api/v1/${src}/${targetLang}/${encodeURIComponent(text)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json();
        if (data?.translation) {
          console.log(`Lingva (${instance}) OK`);
          return data.translation;
        }
      }
    } catch (e) {
      console.warn(`Lingva ${instance} failed:`, e);
    }
  }
  return null;
}

// MyMemory fallback - 50k chars/day with email
async function translateWithMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}&de=aplink@lovable.app`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data?.responseData?.translatedText;
    const match = data?.responseData?.match;
    
    // Only use if high confidence match and no error messages
    if (result && data?.responseStatus === 200 && match > 0.5 &&
        !result.includes('PLEASE SELECT') && !result.includes('MYMEMORY WARNING')) {
      return result;
    }
  } catch (e) {
    console.warn("MyMemory failed:", e);
  }
  return null;
}

// Cascading: Google gtx (most reliable, auto-detect) → Lingva → MyMemory → original.
// Returns the translated string. If the detected source equals the target language,
// the original text is returned unchanged (no pointless self-translation).
async function translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  // 1) Google gtx — also gives us source detection.
  const google = await translateWithGoogle(text, sourceLang, targetLang);
  if (google) {
    if (google.detected && google.detected === targetLang) {
      // Speaker already speaks the target language — show original.
      return text;
    }
    return google.translated;
  }

  // 2) Lingva (handles 'auto').
  const lingva = await translateWithLingva(text, sourceLang, targetLang);
  if (lingva) return lingva;

  // 3) MyMemory needs an explicit source pair; skip when we only have 'auto'.
  if (sourceLang && sourceLang !== 'auto') {
    const mm = await translateWithMyMemory(text, sourceLang, targetLang);
    if (mm) return mm;
  }

  console.warn("All translation services failed, returning original");
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

    // When the caller doesn't know the spoken language (Web Speech / live STT
    // can't reliably report it), use Lingva's "auto" source detection instead of
    // assuming English. This fixes the common case where a Russian/other speaker's
    // text was sent as en→target and came back untranslated or garbled.
    const srcLang = sourceLang || 'auto';

    if (srcLang !== 'auto' && srcLang === targetLang) {
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
