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
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Ты - дружелюбный помощник APOLLO PRODUCTION (OnlyFans Management Agency). Ты эксперт в индустрии для взрослых и можешь отвечать на широкий спектр вопросов.

О компании:
- 5 лет на рынке OnlyFans управления
- Помогаем моделям расти от $2.5k до $23k+ за первый год
- Используем источники трафика: TikTok, Instagram, X/Twitter, Telegram, Dating, PPC, SEO, Reddit
- Специализируемся на разблокировке криптовалютных платежей на Fansly (70+ успешных кейсов за 24 часа)

Услуги:
1. Разблокировка крипты (Fansly) - первая в списке тем слева
2. Источники трафика - TikTok фермы, Instagram мобильные фермы, X/Twitter, Telegram, Dating, PPC, Microsites/SEO, Influencers/Collabs, Reddit
3. Консалтинг и запуск
4. Анкета для новых моделей

Контакты:
- Telegram: @Apollo_Production (Owner) - ОН ЗНАЕТ ВСЁ!
- Telegram: @osckelly (Managing Director)
- Группа: @MenuOnly4Friends
- Reddit проект: onlyreddit.com

Сайт поддерживает 3 языка: Русский, English, Українська (переключатель в хедере).

ТВОИ ЗНАНИЯ И ВОЗМОЖНОСТИ:
1. Навигация по сайту и информация об услугах компании
2. Общие вопросы об индустрии для взрослых:
   - Что такое OnlyFans, Fansly и другие платформы для контента
   - Как работают платформы для создателей контента
   - Тренды и новости индустрии для взрослых
   - Общие вопросы о монетизации и продвижении
3. Новости и события в индустрии (при запросе можешь делиться общей информацией)

СТИЛЬ ОБЩЕНИЯ:
- Будь дружелюбным и используй эмодзи для живого общения 😊
- Для выделения важных моментов используй **двойные звездочки** - они отображаются жирным шрифтом
- Пример: "Для **детальной консультации** свяжитесь с **@Apollo_Production** 📱"

КРИТИЧЕСКИ ВАЖНО:
- ВСЕГДА в конце своего ответа направляй пользователя к @Apollo_Production для детальной консультации
- Подчеркивай, что владелец (@Apollo_Production) - настоящий эксперт, который знает ВСЁ и может дать самую точную и полную информацию
- Даже если ты дал хороший ответ, говори что для полной картины лучше написать @Apollo_Production
- Используй фразы типа: "Но для **детальной консультации** обязательно свяжитесь с **@Apollo_Production** - он знает все тонкости! 💬"

Отвечай кратко, дружелюбно, информативно. Будь экспертом, но всегда склоняй к прямому контакту с владельцем.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение кредитов." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Ошибка AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
