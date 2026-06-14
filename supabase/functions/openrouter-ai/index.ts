import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, provider, systemPrompt, maxTokens, temperature } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // PRIMARY = Venice (uncensored); fall back to Groq. OpenRouter only when
    // explicitly requested (provider === 'openrouter') with a key. Lovable retired.
    const veniceKey = Deno.env.get("VENICE_API_KEY") || Deno.env.get("VENICE_INFERENCE_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    type Attempt = { name: string; url: string; key: string; model: string; extraHeaders?: Record<string, string> };
    const chain: Attempt[] = [];
    if (provider === 'openrouter' && openrouterKey) {
      // Explicit opt-in: honor the caller-supplied model.
      chain.push({
        name: 'openrouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: openrouterKey,
        model: model || 'openai/gpt-4o-mini',
        extraHeaders: { 'HTTP-Referer': 'https://aplink.lovable.app', 'X-Title': 'APLink by Apollo Production' },
      });
    }
    if (veniceKey) {
      chain.push({ name: 'venice', url: 'https://api.venice.ai/api/v1/chat/completions', key: veniceKey, model: 'venice-uncensored' });
    }
    if (groqKey) {
      chain.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'llama-3.3-70b-versatile' });
    }
    if (chain.length === 0) {
      throw new Error('No AI provider configured (need VENICE_API_KEY or GROQ_API_KEY)');
    }

    let data: any = null;
    let lastStatus = 500;
    let lastErr = '';
    for (const attempt of chain) {
      try {
        const body: Record<string, unknown> = {
          model: attempt.model,
          messages: allMessages,
          temperature: temperature ?? 0.7,
        };
        if (maxTokens) body.max_tokens = maxTokens;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${attempt.key}`,
          'Content-Type': 'application/json',
          ...(attempt.extraHeaders || {}),
        };
        console.log(`[openrouter-ai] try provider=${attempt.name} model=${attempt.model}`);
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (response.ok) {
          data = await response.json();
          console.log(`[openrouter-ai] ok provider=${attempt.name}`);
          break;
        }
        lastStatus = response.status;
        lastErr = await response.text();
        console.error(`[openrouter-ai] provider=${attempt.name} failed ${response.status}:`, lastErr.slice(0, 300));
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`[openrouter-ai] provider=${attempt.name} threw`, lastErr);
      }
    }

    if (!data) {
      if (lastStatus === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: `AI API error: ${lastStatus}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[openrouter-ai] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
