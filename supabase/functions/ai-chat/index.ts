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

    // Determine which AI provider to use
    const useProvider = provider || 'lovable';
    const useModel = model || 'google/gemini-2.5-flash';

    let apiUrl: string;
    let apiKey: string;

    if (useProvider === 'openrouter') {
      const key = Deno.env.get("OPENROUTER_API_KEY");
      if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = key;
    } else {
      const key = Deno.env.get("LOVABLE_API_KEY");
      if (!key) throw new Error("LOVABLE_API_KEY is not configured");
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = key;
    }

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

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (useProvider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://aplink.lovable.app';
      headers['X-Title'] = 'APLink by Apollo Production';
    }

    console.log(`[ai-chat] provider=${useProvider} model=${useModel}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useModel,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение кредитов." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Ошибка AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
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
