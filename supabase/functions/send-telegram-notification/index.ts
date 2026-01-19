import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_CHAT_ID = "2061785720";
const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 минут - окно группировки

interface ErrorParams {
  errorType: string;
  errorMessage: string;
  details?: Record<string, unknown>;
  source?: string;
  severity?: string;
  isTest?: boolean;
}

interface MessageOptions {
  errorType: string;
  errorMessage: string;
  source?: string;
  severity?: string;
  details?: Record<string, unknown>;
  count?: number;
  timestamp?: string;
  firstSeen?: string;
  isTest?: boolean;
}

// Форматирование сообщения
function formatMessage(opts: MessageOptions): string {
  const { errorType, errorMessage, source, severity, details, count, timestamp, firstSeen, isTest } = opts;
  
  const time = timestamp || new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  const emoji = isTest ? "🧪" : severity === "critical" ? "🔴" : severity === "error" ? "🟠" : "🟡";
  
  const errorReport = {
    timestamp: time,
    source: source || "Unknown",
    errorType: errorType || "GENERAL_ERROR",
    errorMessage: errorMessage || "No message",
    details: details || null,
    url: details?.url || null,
    userAgent: details?.userAgent || null
  };

  let header = isTest 
    ? "🧪 *Тестовое уведомление*" 
    : `${emoji} *Ошибка в Apollo Production*`;
    
  if (count && count > 1) {
    header += `\n🔁 Повторилась *${count} раз* с ${firstSeen}`;
  }

  // Экранируем специальные символы Markdown
  const safeMessage = (errorMessage || "").substring(0, 300)
    .replace(/[_*`\[\]]/g, "\\$&");

  return `
${header}

📅 *Время:* ${time}
📍 *Источник:* ${source || "Неизвестно"}
🏷 *Тип:* \`${errorType || "ERROR"}\`
⚠️ *Severity:* ${severity || "error"}

💬 *Сообщение:*
\`\`\`
${safeMessage}
\`\`\`

📋 *JSON для Lovable:*
\`\`\`json
${JSON.stringify(errorReport, null, 2)}
\`\`\`
`.trim();
}

// Inline-кнопки для быстрых действий
function getInlineKeyboard(groupId?: string) {
  return {
    inline_keyboard: [
      [
        { text: "📋 Открыть админку", url: "https://aplink.live/admin" },
        { text: "🔇 Игнорировать", callback_data: `ignore:${groupId || "new"}` }
      ],
      [
        { text: "🗑 Очистить логи", callback_data: "clear_logs" },
        { text: "📊 Статистика", callback_data: "show_stats" }
      ]
    ]
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { errorType, errorMessage, details, source, severity, isTest }: ErrorParams = await req.json();
    
    console.log("Telegram notification request:", { errorType, source, severity, isTest });
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Bot token not configured" }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const timestamp = now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

    // Для тестовых сообщений - просто отправляем без группировки
    if (isTest) {
      const message = formatMessage({
        errorType: errorType || "TEST_NOTIFICATION",
        errorMessage: errorMessage || "Это тестовое уведомление",
        source,
        severity: "info",
        details,
        timestamp,
        isTest: true
      });

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: "Markdown"
          })
        }
      );

      const telegramData = await telegramResponse.json();
      console.log("Test message response:", JSON.stringify(telegramData));
      
      return new Response(
        JSON.stringify({ success: telegramData.ok, test: true, telegram_response: telegramData }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Создаём хеш ошибки для группировки
    const errorHash = btoa(unescape(encodeURIComponent(`${errorType}:${source}:${(errorMessage || "").substring(0, 100)}`)));
    const windowStart = new Date(now.getTime() - GROUP_WINDOW_MS);

    // Проверяем, есть ли недавняя похожая ошибка
    const { data: existingGroup } = await supabase
      .from("error_groups")
      .select("*")
      .eq("error_hash", errorHash)
      .gte("last_seen", windowStart.toISOString())
      .single();

    if (existingGroup) {
      // Обновляем счётчик и редактируем существующее сообщение
      const newCount = (existingGroup.occurrence_count || 1) + 1;
      
      await supabase.from("error_groups").update({
        occurrence_count: newCount,
        last_seen: now.toISOString()
      }).eq("id", existingGroup.id);

      console.log(`Error grouped, count: ${newCount}`);

      // Редактируем сообщение в Telegram
      if (existingGroup.telegram_message_id) {
        const firstSeenFormatted = new Date(existingGroup.first_seen).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        
        const updatedMessage = formatMessage({
          errorType,
          errorMessage,
          source,
          severity,
          details,
          count: newCount,
          timestamp,
          firstSeen: firstSeenFormatted
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            message_id: existingGroup.telegram_message_id,
            text: updatedMessage,
            parse_mode: "Markdown",
            reply_markup: getInlineKeyboard(existingGroup.id)
          })
        });
      }

      return new Response(
        JSON.stringify({ success: true, grouped: true, count: newCount }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Новая ошибка - отправляем новое сообщение
    const message = formatMessage({
      errorType,
      errorMessage,
      source,
      severity,
      details,
      count: 1,
      timestamp
    });

    // Отправляем сообщение с inline-кнопками
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          reply_markup: getInlineKeyboard()
        })
      }
    );

    const telegramData = await telegramResponse.json();
    console.log("New message sent:", telegramData.ok, telegramData.result?.message_id);
    
    // Сохраняем в группу для будущей агрегации
    if (telegramData.ok) {
      await supabase.from("error_groups").insert({
        error_hash: errorHash,
        error_type: errorType || "UNKNOWN",
        error_message: (errorMessage || "").substring(0, 500),
        source,
        severity,
        telegram_message_id: telegramData.result?.message_id
      });
    }

    return new Response(
      JSON.stringify({ 
        success: telegramData.ok, 
        message_id: telegramData.result?.message_id 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Telegram notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
