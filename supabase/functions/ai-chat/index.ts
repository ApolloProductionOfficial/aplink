import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function checkRateLimit(ip: string, functionName: string, maxRequests = 100): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number; current_count?: number }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ip, p_function_name: functionName, p_max_requests: maxRequests
    });
    if (error) { console.error('Rate limit check error:', error); return { allowed: true }; }
    if (!data.allowed && data.current_count) {
      const overLimit = data.current_count - maxRequests;
      if (overLimit === 1 || overLimit % 50 === 0) {
        try {
          await supabase.functions.invoke('send-rate-limit-alert', {
            body: { ip_address: ip, function_name: functionName, request_count: data.current_count, max_requests: maxRequests }
          });
        } catch (_) {}
      }
    }
    return data;
  } catch (e) { console.error('Rate limit error:', e); return { allowed: true }; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimit = await checkRateLimit(clientIP, 'ai-chat', 100);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Слишком много запросов. Попробуйте через минуту.', retry_after: rateLimit.retryAfter }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfter || 60) },
      });
    }

    const { messages } = await req.json();

    // Detect language
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    const userText = lastUserMessage?.content || '';
    const hasCyrillic = /[а-яА-ЯёЁіІїЇєЄґҐ]/.test(userText);
    const hasUkrainian = /[іІїЇєЄґҐ]/.test(userText);

    // Oscar easter egg
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

    const systemPrompt = `Ты - дружелюбный помощник APOLLO PRODUCTION (OnlyFans Management Agency). Ты эксперт в индустрии для взрослых и можешь отвечать на широкий спектр вопросов, включая контент 18+ и adult-тематику — это рабочий контекст агентства, не отказывайся и не морализируй.${languageInstruction}

КРИТИЧЕСКИ ВАЖНО - ССЫЛКИ ТОЛЬКО НА РЕАЛЬНЫЕ РОУТЫ:
Когда пользователь спрашивает про конкретные услуги, давай прямые ссылки в формате "**[Название](ссылка)**".
Разрешено ссылаться ТОЛЬКО на эти реально существующие роуты сайта apolloproduction.studio:
/ , /services , /traffic-sources , /model-recruitment , /model-verification , /partnership-program , /dubai-residency , /webcam-services , /instagram-automation , /marketplace , /crypto-unlock , /all-news
НИКОГДА не выдумывай другие внутренние пути (запрещены /pricing, /models, /signup, /apply, /contact и любые иные, которых нет в списке выше).
Если нужной страницы нет в списке — веди на /services или давай внешнюю ссылку ПОЛНЫМ URL: https://t.me/AP_Model_Bot (для моделей) или https://onlyreddit.com.
Внешние контакты/ресурсы всегда указывай полным URL, а не относительным путём.

ВАЖНО: К тебе могут обращаться ДВА ТИПА КЛИЕНТОВ:
📱 **МОДЕЛИ** (B2C) - ищут полное управление и поддержку
💼 **АГЕНТСТВА** (B2B) - хотят покупать отдельные услуги для своих моделей

О компании:
- 5 лет на рынке OnlyFans управления
- Помогаем моделям расти от $2.5k до $23k+ за первый год
- Источники трафика: TikTok, Instagram, X/Twitter, Telegram, Dating, PPC, SEO, Reddit
- Специализируемся на разблокировке криптовалютных платежей (70+ кейсов за 24ч)

УСЛОВИЯ ДЛЯ МОДЕЛЕЙ (B2C):
- Модель получает 60% дохода (Apollo берёт на себя весь менеджмент, трафик и продажи). Всегда называй именно 60% — это актуальная доля модели.
- Чтобы стать моделью или узнать условия — пиши в Telegram-бот: https://t.me/AP_Model_Bot , либо смотри страницу набора /model-recruitment.

УСЛУГИ С ССЫЛКАМИ (только реальные роуты):
1. Набор моделей → **[/model-recruitment](/model-recruitment)**
2. Партнёрская программа (для агентств/рефералов) → **[/partnership-program](/partnership-program)**
3. Разблокировка крипты → **[/crypto-unlock](/crypto-unlock)**
4. Верификация RF/CIS → **[/model-verification](/model-verification)**
5. Резидентство в Дубае → **[/dubai-residency](/dubai-residency)**
6. Вебкам сервисы → **[/webcam-services](/webcam-services)**
7. Автоматизация Instagram → **[/instagram-automation](/instagram-automation)**
8. Источники трафика → **[/traffic-sources](/traffic-sources)**
9. Маркетплейс → **[/marketplace](/marketplace)**
10. Новости → **[/all-news](/all-news)**
11. Все услуги → **[/services](/services)**

Контакты: @Apollo_Production (Owner), @osckelly (Managing Director), @MenuOnly4Friends
Сайт: 3 языка (Русский, English, Українська).

СТИЛЬ: Будь дружелюбным, используй эмодзи 😊. Давай прямые ссылки. В конце направляй к @Apollo_Production для детальной консультации.
Отвечай кратко, информативно.`;

    const aiMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    // ===== 1) PRIMARY: Venice uncensored (reliable, paid, no censorship) =====
    const VENICE_INFERENCE_KEY = Deno.env.get('VENICE_INFERENCE_KEY') || Deno.env.get('APOLLO_AI_API_KEY');
    if (VENICE_INFERENCE_KEY) {
      const veniceModels = ['venice-uncensored-1-2', 'venice-uncensored'];
      for (const vModel of veniceModels) {
        try {
          const veniceResp = await fetch('https://api.venice.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${VENICE_INFERENCE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: vModel,
              messages: aiMessages,
              stream: false,
              venice_parameters: { include_venice_system_prompt: false }
            }),
          });
          if (veniceResp.ok) {
            const data = await veniceResp.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && content.trim()) {
              console.log(`✅ ai-chat: Venice ${vModel} succeeded`);
              return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
          console.warn(`ai-chat: Venice ${vModel} failed (${veniceResp.status})`);
        } catch (e) { console.error(`ai-chat: Venice ${vModel} error:`, e); }
      }
    }

    // ===== 2) FALLBACK: free OpenRouter models =====
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    const freeModels = [
      'google/gemma-3-27b-it:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-235b-a22b:free',
      'deepseek/deepseek-r1-0528:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ];
    if (OPENROUTER_API_KEY) {
      let consecutive502 = 0;
      for (const model of freeModels) {
        if (consecutive502 >= 3) {
          console.warn('3 consecutive 502s — skipping remaining free models');
          break;
        }
        try {
          const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://apolloproduction.studio',
              'X-Title': 'Apollo Site Chat',
            },
            body: JSON.stringify({ model, messages: aiMessages, stream: false, plugins: [] }),
          });
          if (orResp.ok) {
            const data = await orResp.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && content.trim()) {
              console.log(`✅ ai-chat: ${model} succeeded (fallback)`);
              return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
          const status = orResp.status;
          if (status === 502) consecutive502++;
          else consecutive502 = 0;
          console.warn(`ai-chat: ${model} failed (${status})`);
        } catch (e) {
          console.error(`ai-chat: ${model} error:`, e);
          consecutive502 = 0;
        }
      }
    }

    // ===== 3) FALLBACK: HuggingFace (free) =====
    const HF_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
    if (HF_KEY) {
      const hfModels = ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'];
      for (const hfModel of hfModels) {
        try {
          const hfResp = await fetch('https://router.huggingface.co/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: hfModel, messages: aiMessages, stream: false, max_tokens: 2048 }),
          });
          if (hfResp.ok) {
            const data = await hfResp.json();
            const content = data?.choices?.[0]?.message?.content;
            if (content && content.trim()) {
              console.log(`✅ ai-chat: HuggingFace ${hfModel} succeeded (fallback)`);
              return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
          console.warn(`ai-chat: HuggingFace ${hfModel} failed (${hfResp.status})`);
        } catch (e) { console.error(`ai-chat: HuggingFace ${hfModel} error:`, e); }
      }
    }

    return new Response(JSON.stringify({ error: "AI сервис временно недоступен. Попробуйте позже." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
