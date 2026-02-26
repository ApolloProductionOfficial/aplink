import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Free HuggingFace models for different tasks
const MODELS = {
  // Translation models (free, no rate limits on Inference API)
  translation: {
    'en-ru': 'Helsinki-NLP/opus-mt-en-ru',
    'ru-en': 'Helsinki-NLP/opus-mt-ru-en',
    'en-uk': 'Helsinki-NLP/opus-mt-en-uk',
    'uk-en': 'Helsinki-NLP/opus-mt-uk-en',
    'en-de': 'Helsinki-NLP/opus-mt-en-de',
    'de-en': 'Helsinki-NLP/opus-mt-de-en',
    'en-fr': 'Helsinki-NLP/opus-mt-en-fr',
    'fr-en': 'Helsinki-NLP/opus-mt-fr-en',
    'en-es': 'Helsinki-NLP/opus-mt-en-es',
    'es-en': 'Helsinki-NLP/opus-mt-es-en',
    'en-it': 'Helsinki-NLP/opus-mt-en-it',
    'it-en': 'Helsinki-NLP/opus-mt-it-en',
    'en-pt': 'Helsinki-NLP/opus-mt-en-pt',
    'pt-en': 'Helsinki-NLP/opus-mt-pt-en',
    'en-zh': 'Helsinki-NLP/opus-mt-en-zh',
    'zh-en': 'Helsinki-NLP/opus-mt-zh-en',
    'en-ja': 'Helsinki-NLP/opus-mt-en-jap',
    'ja-en': 'Helsinki-NLP/opus-mt-jap-en',
    'en-ko': 'Helsinki-NLP/opus-mt-tc-big-en-ko',
    'ko-en': 'Helsinki-NLP/opus-mt-ko-en',
    'en-ar': 'Helsinki-NLP/opus-mt-en-ar',
    'ar-en': 'Helsinki-NLP/opus-mt-ar-en',
  },
  // Text generation (free)
  chat: 'mistralai/Mistral-7B-Instruct-v0.3',
  // Summarization (free)
  summarization: 'facebook/bart-large-cnn',
  // Sentiment analysis (free)
  sentiment: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
  // Language detection (free)
  langDetect: 'papluca/xlm-roberta-base-language-detection',
};

async function callHuggingFace(model: string, inputs: any, apiKey: string, options: any = {}) {
  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs, ...options }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`HuggingFace error (${model}):`, response.status, errorText);
    
    // Model loading - retry after wait
    if (response.status === 503) {
      const data = JSON.parse(errorText);
      const waitTime = data.estimated_time || 20;
      console.log(`Model loading, waiting ${waitTime}s...`);
      await new Promise(r => setTimeout(r, Math.min(waitTime * 1000, 30000)));
      
      const retry = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs, ...options }),
      });
      if (!retry.ok) throw new Error(`HuggingFace retry failed: ${retry.status}`);
      return await retry.json();
    }
    
    throw new Error(`HuggingFace API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, text, sourceLang, targetLang, messages } = await req.json();
    
    const apiKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      throw new Error('HUGGINGFACE_API_KEY is not configured');
    }

    let result: any;

    switch (task) {
      case 'translate': {
        if (!text || !targetLang) throw new Error('text and targetLang required');
        const src = sourceLang || 'en';
        const pair = `${src}-${targetLang}`;
        const model = MODELS.translation[pair as keyof typeof MODELS.translation];
        
        if (!model) {
          // Try via English as pivot
          if (src !== 'en' && targetLang !== 'en') {
            const toEn = MODELS.translation[`${src}-en` as keyof typeof MODELS.translation];
            const fromEn = MODELS.translation[`en-${targetLang}` as keyof typeof MODELS.translation];
            if (toEn && fromEn) {
              const midResult = await callHuggingFace(toEn, text, apiKey);
              const midText = midResult[0]?.translation_text || text;
              const finalResult = await callHuggingFace(fromEn, midText, apiKey);
              result = { translatedText: finalResult[0]?.translation_text || midText, pivot: true };
              break;
            }
          }
          throw new Error(`Translation pair not supported: ${pair}`);
        }
        
        const data = await callHuggingFace(model, text, apiKey);
        result = { translatedText: data[0]?.translation_text || text };
        break;
      }

      case 'chat': {
        if (!messages || !Array.isArray(messages)) throw new Error('messages array required');
        const prompt = messages.map((m: any) => 
          m.role === 'user' ? `[INST] ${m.content} [/INST]` : m.content
        ).join('\n');
        
        const data = await callHuggingFace(MODELS.chat, prompt, apiKey, {
          parameters: { max_new_tokens: 500, temperature: 0.7, return_full_text: false }
        });
        result = { response: data[0]?.generated_text || '' };
        break;
      }

      case 'summarize': {
        if (!text) throw new Error('text required');
        const data = await callHuggingFace(MODELS.summarization, text, apiKey, {
          parameters: { max_length: 150, min_length: 30 }
        });
        result = { summary: data[0]?.summary_text || '' };
        break;
      }

      case 'detect_language': {
        if (!text) throw new Error('text required');
        const data = await callHuggingFace(MODELS.langDetect, text, apiKey);
        const sorted = (data[0] || []).sort((a: any, b: any) => b.score - a.score);
        result = { language: sorted[0]?.label || 'unknown', confidence: sorted[0]?.score || 0, all: sorted.slice(0, 5) };
        break;
      }

      case 'sentiment': {
        if (!text) throw new Error('text required');
        const data = await callHuggingFace(MODELS.sentiment, text, apiKey);
        result = { sentiment: data[0] };
        break;
      }

      case 'list_models': {
        result = {
          translation: Object.keys(MODELS.translation),
          chat: MODELS.chat,
          summarization: MODELS.summarization,
          sentiment: MODELS.sentiment,
          langDetect: MODELS.langDetect,
        };
        break;
      }

      default:
        throw new Error(`Unknown task: ${task}. Available: translate, chat, summarize, detect_language, sentiment, list_models`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('HuggingFace error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
