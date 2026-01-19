import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ADMIN_CHAT_ID = "2061785720";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const { command } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let responseText = "";

    if (command === "stats" || command === "/stats") {
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

      // Send to Telegram
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: responseText,
          parse_mode: "Markdown"
        })
      });

    } else if (command === "ping" || command === "/ping") {
      responseText = `🏓 *Pong!*\n\nБот работает исправно.\n_${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`;

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: responseText,
          parse_mode: "Markdown"
        })
      });

    } else if (command === "clear" || command === "/clear") {
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

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
