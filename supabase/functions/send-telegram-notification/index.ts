import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use REPORTS_BOT_TOKEN for error/diagnostic notifications (Reports and Errors bot)
const REPORTS_BOT_TOKEN = Deno.env.get("REPORTS_BOT_TOKEN");
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

function extractHostnameFromText(text?: string | null): string | null {
  if (!text) return null;
  // Try to find any URL-like substring and return its hostname
  const match = text.match(/https?:\/\/([a-zA-Z0-9.-]+)/);
  return match?.[1] || null;
}

function inferSiteName(details?: Record<string, unknown> | null): string {
  try {
    const url = (details?.url as string | undefined) || null;
    if (url) return new URL(url).hostname;

    const fromStack = extractHostnameFromText(details?.stack as string | undefined);
    if (fromStack) return fromStack;

    const fromComponentStack = extractHostnameFromText(details?.componentStack as string | undefined);
    if (fromComponentStack) return fromComponentStack;

    const fromFullMessage = extractHostnameFromText(details?.fullMessage as string | undefined);
    if (fromFullMessage) return fromFullMessage;

    return "aplink.live"; // fallback: this app
  } catch {
    return "aplink.live";
  }
}

function extractComponentStack(details?: Record<string, unknown> | null): string | null {
  if (!details) return null;

  const direct = details.componentStack;
  if (typeof direct === "string" && direct.trim()) return direct;

  // Some clients send componentStack inside a JSON blob embedded in fullMessage.
  const fullMessage = details.fullMessage;
  if (typeof fullMessage === "string" && fullMessage.includes("componentStack")) {
    // Try parsing the last JSON object found in the string.
    const lastOpen = fullMessage.lastIndexOf("{");
    const lastClose = fullMessage.lastIndexOf("}");
    if (lastOpen !== -1 && lastClose !== -1 && lastClose > lastOpen) {
      const maybeJson = fullMessage.slice(lastOpen, lastClose + 1);
      try {
        const parsed = JSON.parse(maybeJson);
        if (typeof parsed?.componentStack === "string" && parsed.componentStack.trim()) {
          return parsed.componentStack;
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function normalizeStackSignature(stack: string): string {
  const lines = stack
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // Keep the signature stable but compact
    .slice(0, 4);
  return lines.join("|").substring(0, 280);
}

function inferDisplayMessage(errorMessage: string | undefined, details?: Record<string, unknown> | null): string {
  const msg = (errorMessage || "").trim();
  if (msg) return msg;

  const stack = extractComponentStack(details) || (details?.stack as string | undefined) || null;
  if (typeof stack === "string" && stack.trim()) {
    const firstLine = stack
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0];
    if (firstLine) return firstLine;
  }

  return "No message";
}

function buildGroupingFingerprint(params: {
  errorType?: string;
  errorMessage?: string;
  source?: string;
  details?: Record<string, unknown> | null;
}): { fingerprint: string; normalizedType: string } {
  const { errorType, errorMessage, source, details } = params;

  const type = (errorType || "UNKNOWN").toUpperCase();
  const src = (source || "").toLowerCase();
  const msg = (errorMessage || "").toLowerCase();

  // React ErrorBoundary duplicates:
  // - one event comes as REACT_ERROR (often with empty message)
  // - the second comes via console.error as CONSOLE_ERROR with "ErrorBoundary caught error..."
  // We want BOTH to produce the same fingerprint so they merge into one Telegram message.
  const componentStack = extractComponentStack(details);
  const isBoundaryRelated =
    !!componentStack ||
    src.includes("errorboundary") ||
    msg.includes("errorboundary caught error") ||
    msg.includes("errorboundary caught") ||
    msg.includes("componentstack") ||
    (type === "CONSOLE_ERROR" && msg.includes("errorboundary"));

  if (isBoundaryRelated && componentStack) {
    const signature = normalizeStackSignature(componentStack);
    // Use REACT_BOUNDARY prefix regardless of original errorType
    // This ensures REACT_ERROR and CONSOLE_ERROR with same stack merge together
    return { fingerprint: `REACT_BOUNDARY:${signature}`, normalizedType: "REACT_ERROR" };
  }

  // Also catch "ErrorBoundary caught error: {}" messages even without componentStack
  if (msg.includes("errorboundary caught error")) {
    // Try to extract any stack-like info from the message itself
    const stackMatch = msg.match(/componentstack["\s:]+([^"]+)/i);
    if (stackMatch) {
      const signature = normalizeStackSignature(stackMatch[1]);
      return { fingerprint: `REACT_BOUNDARY:${signature}`, normalizedType: "REACT_ERROR" };
    }
    // Fallback: use a generic boundary fingerprint with partial message
    const partialMsg = msg.substring(0, 80);
    return { fingerprint: `REACT_BOUNDARY:${partialMsg}`, normalizedType: "REACT_ERROR" };
  }

  const normalizedMsg = (errorMessage || "").substring(0, 160);
  return { fingerprint: `${type}:${normalizedMsg}`, normalizedType: type };
}

// Форматирование сообщения - один JSON блок для удобного копирования
function formatMessage(opts: MessageOptions): string {
  const { errorType, errorMessage, source, severity, details, count, timestamp, firstSeen, isTest } = opts;
  
  const time = timestamp || new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  const emoji = isTest ? "🧪" : severity === "critical" ? "🔴" : severity === "error" ? "🟠" : "🟡";
  
  const siteUrl = (details?.url as string | undefined) || null;
  const siteName = inferSiteName(details || null);
  
  const displayMessage = inferDisplayMessage(errorMessage, details || null);

  const errorReport = {
    timestamp: time,
    site: siteName,
    source: source || "Unknown",
    errorType: errorType || "GENERAL_ERROR",
    errorMessage: displayMessage,
    details: details || null,
    url: siteUrl || null,
    userAgent: details?.userAgent || null
  };

  // Указываем конкретный сайт вместо "Apollo"
  let header = isTest ? "🧪 ТЕСТ" : `${emoji} Ошибка сайта ${siteName}`;
    
  if (count && count > 1) {
    header += ` (×${count}, с ${firstSeen})`;
  }

  // Единый JSON блок - легко копируется целиком
  return `${header}

\`\`\`json
${JSON.stringify(errorReport, null, 2)}
\`\`\``;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { errorType, errorMessage, details, source, severity, isTest }: ErrorParams = await req.json();
    
    console.log("Telegram notification request:", { errorType, source, severity, isTest });
    
    if (!REPORTS_BOT_TOKEN) {
      console.error("REPORTS_BOT_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Reports bot token not configured" }), 
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
        `https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/sendMessage`,
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
    // Normalize site so "Unknown" and actual site are grouped together
    const siteName = inferSiteName(details || null);
    const { fingerprint } = buildGroupingFingerprint({ errorType, errorMessage, source, details: details || null });
    const errorHash = btoa(unescape(encodeURIComponent(`${siteName}:${fingerprint}`)));
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

      // Редактируем сообщение в Telegram (без кнопок)
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

        await fetch(`https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            message_id: existingGroup.telegram_message_id,
            text: updatedMessage,
            parse_mode: "Markdown"
          })
        });
      }

      return new Response(
        JSON.stringify({ success: true, grouped: true, count: newCount }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Новая ошибка - отправляем новое сообщение (без кнопок)
    const message = formatMessage({
      errorType,
      errorMessage,
      source,
      severity,
      details,
      count: 1,
      timestamp
    });

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/sendMessage`,
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
