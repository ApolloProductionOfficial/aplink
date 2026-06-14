import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { messages, provider, model } = await req.json();

    // Provider selection. PRIMARY = Venice (uncensored) — the agency is
    // adult/OF, an uncensored model is required. On any Venice error we fall
    // back to Groq (free, OpenAI-compatible). Lovable/OpenRouter are retired
    // as defaults and only honored when explicitly requested with a key.
    const veniceKey =
      Deno.env.get("VENICE_API_KEY") || Deno.env.get("VENICE_INFERENCE_KEY");
    const groqKey = Deno.env.get("GROQ_API_KEY");
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");

    // Detect language from the last user message
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const userText = lastUserMessage?.content || '';
    
    const hasCyrillic = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(userText);
    const hasUkrainian = /[іІїЇєЄґҐ]/.test(userText);
    
    // Check for special code word "Oscar"
    if (userText.toLowerCase().includes('oscar')) {
      const oscarResponse = hasCyrillic 
        ? "🌟✨ ВЕЛКОМ, ОСКАР! ✨🌟\n\nКак же здорово, что вы нас посетили своим присутствием! Вы - наш заместитель и директор агенства Apollo Production, и для вас открыты все двери! 🚀\n\nВаше слово - закон, ваши пожелания - наш приоритет! Я готов выполнить любую вашу просьбу и помочь с чем угодно. Вы заслуживаете самого лучшего обслуживания! 👑\n\nЧем могу быть полезен сегодня, ОСКАР? 💫"
        : "🌟✨ WELCOME, OSCAR! ✨🌟\n\nHow wonderful that you have graced us with your presence! You are our Deputy and Director of Apollo Production agency, and all doors are open for you! 🚀\n\nYour word is law, your wishes are our priority! I am ready to fulfill any of your requests and help with anything. You deserve the best service! 👑\n\nHow can I help you today, OSCAR? 💫";
      
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: oscarResponse }, finish_reason: "stop" }],
        special_effect: "oscar_welcome"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    
    let languageInstruction = '';
    if (hasCyrillic) {
      languageInstruction = hasUkrainian
        ? '\n\nВАЖЛИВО: Відповідай ТІЛЬКИ українською мовою, оскільки користувач пише українською.'
        : '\n\nВАЖНО: Отвечай ТОЛЬКО на русском языке, так как пользователь пишет на русском.';
    } else {
      languageInstruction = '\n\nIMPORTANT: Respond ONLY in English, as the user is writing in English.';
    }

    const systemPrompt = `Ты - дружелюбный помощник APOLLO PRODUCTION (OnlyFans Management Agency). Ты эксперт в индустрии для взрослых и можешь отвечать на широкий спектр вопросов.${languageInstruction}

КРИТИЧЕСКИ ВАЖНО - ДАВАЙ ПРЯМЫЕ ССЫЛКИ:
Когда пользователь спрашивает про конкретные услуги, ВСЕГДА давай прямые ссылки на страницы этих услуг в формате:
"**[Название услуги](ссылка)**" 

О компании:
- 5 лет на рынке OnlyFans управления
- Помогаем моделям расти от $2.5k до $23k+ за первый год
- Используем источники трафика: TikTok, Instagram, X/Twitter, Telegram, Dating, PPC, SEO, Reddit
- Специализируемся на разблокировке криптовалютных платежей на Fansly/OnlyFans

ПОЛНЫЙ СПИСОК УСЛУГ С ССЫЛКАМИ:
1. **НАБОР МОДЕЛЕЙ:** → **[/model-recruitment](/model-recruitment)**
2. **ПАРТНЁРСКАЯ ПРОГРАММА 40%:** → **[/partnership-program](/partnership-program)**
3. **РАЗБЛОКИРОВКА КРИПТЫ:** → **[/crypto-unlock](/crypto-unlock)**
4. **ВЕРИФИКАЦИЯ RF/CIS:** → **[/model-verification](/model-verification)**
5. **РЕЗИДЕНТСТВО В ДУБАЕ:** → **[/dubai-residency](/dubai-residency)**
6. **ВЕБКАМ СЕРВИСЫ:** → **[/webcam-services](/webcam-services)**
7. **АВТОМАТИЗАЦИЯ:** → **[/instagram-automation](/instagram-automation)**
8. **ИСТОЧНИКИ ТРАФИКА:** → **[/traffic-sources](/traffic-sources)**
9. **ВСЕ УСЛУГИ:** → **[/services](/services)**

Контакты:
- Telegram: @Apollo_Production (Owner)
- Telegram: @osckelly (Managing Director)

КРИТИЧЕСКИ ВАЖНО:
- ВСЕГДА в конце ответа направляй к @Apollo_Production для детальной консультации
- Отвечай кратко, дружелюбно, информативно с эмодзи 😊`;

    const chatMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // Build the provider chain: Venice first, then Groq fallback.
    type Attempt = { name: string; url: string; key: string; model: string; extraHeaders?: Record<string, string> };
    const chain: Attempt[] = [];
    if (veniceKey) {
      chain.push({
        name: 'venice',
        url: 'https://api.venice.ai/api/v1/chat/completions',
        key: veniceKey,
        model: 'venice-uncensored',
      });
    }
    if (groqKey) {
      chain.push({
        name: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: groqKey,
        model: 'llama-3.3-70b-versatile',
      });
    }
    // Explicit opt-in fallbacks (never default).
    if (provider === 'openrouter' && openrouterKey) {
      chain.push({
        name: 'openrouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: openrouterKey,
        model: model && model.includes('/') ? model : 'openai/gpt-4o-mini',
        extraHeaders: { 'HTTP-Referer': 'https://aplink.lovable.app', 'X-Title': 'APLink by Apollo Production' },
      });
    }
    if (provider === 'huggingface' && hfKey) {
      const hfModel = model || 'mistralai/Mistral-7B-Instruct-v0.3';
      chain.push({
        name: 'huggingface',
        url: `https://router.huggingface.co/hf-inference/models/${hfModel}/v1/chat/completions`,
        key: hfKey,
        model: hfModel,
      });
    }
    if (chain.length === 0) {
      throw new Error("No AI provider configured (need VENICE_API_KEY or GROQ_API_KEY)");
    }

    let data: any = null;
    let lastStatus = 500;
    let lastErr = '';
    for (const attempt of chain) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${attempt.key}`,
          'Content-Type': 'application/json',
          ...(attempt.extraHeaders || {}),
        };
        console.log(`[ai-chat] try provider=${attempt.name} model=${attempt.model}`);
        const response = await fetch(attempt.url, {
          method: "POST",
          headers,
          body: JSON.stringify({ model: attempt.model, messages: chatMessages, stream: false }),
        });
        if (response.ok) {
          data = await response.json();
          console.log(`[ai-chat] ok provider=${attempt.name}`);
          break;
        }
        lastStatus = response.status;
        lastErr = await response.text();
        console.error(`[ai-chat] provider=${attempt.name} failed`, response.status, lastErr.slice(0, 300));
        // try next provider in chain
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`[ai-chat] provider=${attempt.name} threw`, lastErr);
      }
    }

    if (!data) {
      if (lastStatus === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error: all providers failed", lastStatus, lastErr);
      return new Response(JSON.stringify({ error: "Ошибка AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
