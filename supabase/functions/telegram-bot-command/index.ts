import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Use REPORTS_BOT_TOKEN for error/diagnostic commands (Reports and Errors bot)
// This is separate from TELEGRAM_BOT_TOKEN which is used for user notifications (APLink bot)
const REPORTS_BOT_TOKEN = Deno.env.get("REPORTS_BOT_TOKEN");
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_CHAT_ID = "2061785720";
const WELCOME_GIF_URL = "https://aplink.live/animations/aplink-welcome.gif";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { command, telegram_id, caption, media_url, file_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let responseText = "";

    if (command === "send_test_welcome") {
      // Send test welcome message to the specified telegram_id
      if (!TELEGRAM_BOT_TOKEN) {
        throw new Error("TELEGRAM_BOT_TOKEN not configured");
      }
      if (!telegram_id) {
        throw new Error("telegram_id is required");
      }

      const testCaption = caption || "🧪 Тестовое приветственное сообщение";
      let sent = false;

      // Priority 1: Use file_id if available
      if (file_id && !sent) {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegram_id,
            animation: file_id,
            caption: `🧪 *ТЕСТ*\n\n${testCaption}`,
            parse_mode: "Markdown",
          }),
        });
        const data = await res.json();
        console.log("Test sendAnimation with file_id:", JSON.stringify(data));
        if (data?.ok) sent = true;

        // Try as photo if animation fails
        if (!sent) {
          const photoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegram_id,
              photo: file_id,
              caption: `🧪 *ТЕСТ*\n\n${testCaption}`,
              parse_mode: "Markdown",
            }),
          });
          const photoData = await photoRes.json();
          if (photoData?.ok) sent = true;
        }
      }

      // Priority 2: Use media_url
      if (!sent) {
        const urlToUse = media_url || WELCOME_GIF_URL;
        console.log("Using media URL for test:", urlToUse);

        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegram_id,
            animation: urlToUse,
            caption: `🧪 *ТЕСТ*\n\n${testCaption}`,
            parse_mode: "Markdown",
          }),
        });
        const data = await res.json();
        console.log("Test sendAnimation with URL:", JSON.stringify(data));
        if (data?.ok) sent = true;

        // Try as photo if animation fails
        if (!sent) {
          const photoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegram_id,
              photo: urlToUse,
              caption: `🧪 *ТЕСТ*\n\n${testCaption}`,
              parse_mode: "Markdown",
            }),
          });
          const photoData = await photoRes.json();
          if (photoData?.ok) sent = true;
        }
      }

      // Fallback: text only
      if (!sent) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegram_id,
            text: `🧪 *ТЕСТ*\n\n${testCaption}`,
            parse_mode: "Markdown",
          }),
        });
      }

      responseText = "Test welcome message sent";

    } else if (command === "stats" || command === "/stats") {
      if (!REPORTS_BOT_TOKEN) {
        throw new Error("REPORTS_BOT_TOKEN not configured");
      }

      const today = new Date().toISOString().split("T")[0];

      const { count: totalLogs } = await supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true });

      const { count: todayLogs } = await supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today);

      const { count: criticalLogs } = await supabase
        .from("error_logs")
        .select("*", { count: "exact", head: true })
        .eq("severity", "critical");

      const { count: activeGroups } = await supabase
        .from("error_groups")
        .select("*", { count: "exact", head: true });

      responseText = `📊 *Статистика Apollo Production*\n\n• Всего ошибок: ${totalLogs || 0}\n• Сегодня: ${todayLogs || 0}\n• Критических: ${criticalLogs || 0}\n• Активных групп: ${activeGroups || 0}\n\n_${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`;

      // Send to Reports and Errors bot
      await fetch(`https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: responseText,
          parse_mode: "Markdown"
        })
      });

    } else if (command === "ping" || command === "/ping") {
      if (!REPORTS_BOT_TOKEN) {
        throw new Error("REPORTS_BOT_TOKEN not configured");
      }

      responseText = `🏓 *Pong!*\n\nБот работает исправно.\n_${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`;

      await fetch(`https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: responseText,
          parse_mode: "Markdown"
        })
      });

    } else if (command === "clear" || command === "/clear") {
      if (!REPORTS_BOT_TOKEN) {
        throw new Error("REPORTS_BOT_TOKEN not configured");
      }

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: deletedLogs } = await supabase
        .from("error_logs")
        .delete()
        .lt("created_at", weekAgo)
        .select("id");

      const { data: deletedGroups } = await supabase
        .from("error_groups")
        .delete()
        .lt("last_seen", weekAgo)
        .select("id");

      const logsCount = deletedLogs?.length || 0;
      const groupsCount = deletedGroups?.length || 0;

      responseText = `🗑 *Очистка завершена*\n\nУдалено:\n• Логов: ${logsCount}\n• Групп: ${groupsCount}\n\n_Удалены записи старше 7 дней_`;

      await fetch(`https://api.telegram.org/bot${REPORTS_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: responseText,
          parse_mode: "Markdown"
        })
      });

    } else {
      throw new Error(`Unknown command: ${command}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: responseText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error executing command:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
