import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data: string;
    message?: {
      chat?: { id: number };
      message_id?: number;
    };
  };
  message?: {
    chat?: { id: number };
    text?: string;
  };
}

serve(async (req) => {
  try {
    const update: TelegramUpdate = await req.json();
    
    console.log("Webhook received:", JSON.stringify(update).substring(0, 200));
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response("Bot token not configured", { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Обработка callback_query (нажатие на кнопку)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message?.chat?.id;
      const messageId = update.callback_query.message?.message_id;
      
      console.log("Callback received:", callbackData);

      let responseText = "";

      if (callbackData.startsWith("ignore:")) {
        // Игнорировать ошибку
        const groupId = callbackData.split(":")[1];
        
        if (groupId && groupId !== "new") {
          await supabase.from("error_groups").delete().eq("id", groupId);
        }
        
        responseText = "✅ Ошибка проигнорирована";
        
        // Удаляем сообщение
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
          });
        }
        
      } else if (callbackData === "clear_logs") {
        // Очистить старые логи (старше 7 дней)
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
        
        responseText = `🗑 Удалено:\n• Логов: ${logsCount}\n• Групп: ${groupsCount}`;
        
      } else if (callbackData === "show_stats") {
        // Показать статистику
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
        
        responseText = `📊 Статистика ошибок:\n\n• Всего: ${totalLogs || 0}\n• Сегодня: ${todayLogs || 0}\n• Критических: ${criticalLogs || 0}\n• Активных групп: ${activeGroups || 0}`;
      }

      // Отправляем ответ на callback
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: update.callback_query.id,
          text: responseText,
          show_alert: true
        })
      });
    }

    // Обработка текстовых команд
    if (update.message?.text) {
      const chatId = update.message.chat?.id;
      const text = update.message.text;
      
      if (text === "/stats" || text === "/status") {
        const today = new Date().toISOString().split("T")[0];
        
        const { count: totalLogs } = await supabase
          .from("error_logs")
          .select("*", { count: "exact", head: true });
        
        const { count: todayLogs } = await supabase
          .from("error_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", today);
        
        const statsMessage = `📊 *Статистика Apollo Production*\n\n• Всего ошибок: ${totalLogs || 0}\n• Сегодня: ${todayLogs || 0}\n\n_Последнее обновление: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: statsMessage,
            parse_mode: "Markdown"
          })
        });
      } else if (text === "/help" || text === "/start") {
        const helpMessage = `🤖 *Apollo Error Bot*\n\nДоступные команды:\n/stats - Показать статистику ошибок\n/help - Показать это сообщение\n\nБот автоматически отправляет уведомления об ошибках в приложении.`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMessage,
            parse_mode: "Markdown"
          })
        });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});
