import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEB_APP_URL = "https://aplink.live";

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data: string;
    from?: { id: number; username?: string; first_name?: string };
    message?: {
      chat?: { id: number };
      message_id?: number;
    };
  };
  message?: {
    chat?: { id: number };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
}

serve(async (req) => {
  try {
    const update: TelegramUpdate = await req.json();
    
    console.log("Webhook received:", JSON.stringify(update).substring(0, 300));
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response("Bot token not configured", { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle callback_query (button press)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message?.chat?.id;
      const messageId = update.callback_query.message?.message_id;
      const fromUser = update.callback_query.from;
      
      console.log("Callback received:", callbackData);

      let responseText = "";

      if (callbackData.startsWith("ignore:")) {
        const groupId = callbackData.split(":")[1];
        if (groupId && groupId !== "new") {
          await supabase.from("error_groups").delete().eq("id", groupId);
        }
        responseText = "✅ Ошибка проигнорирована";
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
          });
        }
        
      } else if (callbackData.startsWith("decline_group:")) {
        const callRequestId = callbackData.split(":")[1];
        
        // Update participant status
        if (fromUser?.id) {
          await supabase
            .from("call_participants")
            .update({ status: "declined", responded_at: new Date().toISOString() })
            .eq("call_request_id", callRequestId)
            .eq("telegram_id", fromUser.id);
        }
        
        responseText = "❌ Вы отклонили приглашение";
        
        // Log activity
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser?.id || null,
          action: "group_call_declined",
          metadata: { call_request_id: callRequestId },
        });
        
      } else if (callbackData.startsWith("join_group:")) {
        const callRequestId = callbackData.split(":")[1];
        
        // Get call request
        const { data: callRequest } = await supabase
          .from("call_requests")
          .select("room_name, expires_at")
          .eq("id", callRequestId)
          .single();
        
        if (callRequest && new Date(callRequest.expires_at) > new Date()) {
          // Update participant status
          if (fromUser?.id) {
            await supabase
              .from("call_participants")
              .update({ status: "joined", responded_at: new Date().toISOString() })
              .eq("call_request_id", callRequestId)
              .eq("telegram_id", fromUser.id);
          }
          
          responseText = "🎥 Присоединяйтесь к звонку!";
          
          // Send message with web app button
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `🎥 Нажмите кнопку ниже, чтобы присоединиться к комнате *${callRequest.room_name}*`,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: "🎥 Открыть APLink", web_app: { url: `${WEB_APP_URL}/room/${callRequest.room_name}` } }
                ]]
              }
            })
          });
        } else {
          responseText = "⏰ Приглашение истекло";
        }
        
      } else if (callbackData === "clear_logs") {
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
        responseText = `🗑 Удалено:\n• Логов: ${deletedLogs?.length || 0}\n• Групп: ${deletedGroups?.length || 0}`;
        
      } else if (callbackData === "show_stats") {
        const today = new Date().toISOString().split("T")[0];
        const { count: totalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true });
        const { count: todayLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", today);
        const { count: criticalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).eq("severity", "critical");
        const { count: activeGroups } = await supabase.from("error_groups").select("*", { count: "exact", head: true });
        responseText = `📊 Статистика:\n• Всего: ${totalLogs || 0}\n• Сегодня: ${todayLogs || 0}\n• Критических: ${criticalLogs || 0}\n• Групп: ${activeGroups || 0}`;
      
      } else if (callbackData.startsWith("callback_5min:") || callbackData.startsWith("callback_15min:") || callbackData.startsWith("callback_busy:")) {
        // Quick reply callbacks
        const parts = callbackData.split(":");
        const action = parts[0];
        const callerId = parts[1];
        
        // Get caller's profile
        const { data: callerProfile } = await supabase
          .from("profiles")
          .select("telegram_id, display_name, username")
          .eq("user_id", callerId)
          .single();
        
        // Get responder's profile
        const { data: responderProfile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        const responderName = responderProfile?.display_name || responderProfile?.username || "Пользователь";
        
        let callerMessage = "";
        let buttonText = "";
        
        if (action === "callback_5min") {
          callerMessage = `📞 *${responderName}* перезвонит через 5 минут`;
          buttonText = "✅ Перезвоню через 5 мин";
          responseText = "Отправлено: перезвоню через 5 минут";
        } else if (action === "callback_15min") {
          callerMessage = `📞 *${responderName}* перезвонит через 15 минут`;
          buttonText = "✅ Перезвоню через 15 мин";
          responseText = "Отправлено: перезвоню через 15 минут";
        } else if (action === "callback_busy") {
          callerMessage = `💬 *${responderName}* сейчас занят. Напишите сообщение.`;
          buttonText = "✅ Занят, напишите";
          responseText = "Отправлено: занят, напишите";
        }
        
        // Send message to caller
        if (callerProfile?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: callerProfile.telegram_id,
              text: callerMessage,
              parse_mode: "Markdown",
            }),
          });
        }
        
        // Update original message markup
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: { inline_keyboard: [[{ text: buttonText, callback_data: "noop" }]] },
            }),
          });
        }
        
        // Log activity
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser?.id || null,
          action: `quick_reply_${action.replace("callback_", "")}`,
          metadata: { caller_id: callerId },
        });
      
      } else if (callbackData === "noop") {
        // No-op for already handled buttons
        responseText = "";
      }

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

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat?.id;
      const text = update.message.text;
      const fromUser = update.message.from;
      
      // Log activity
      if (fromUser?.id) {
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser.id,
          action: "bot_command",
          metadata: { command: text, username: fromUser.username },
        });
      }
      
      if (text === "/stats" || text === "/status") {
        const today = new Date().toISOString().split("T")[0];
        const { count: totalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true });
        const { count: todayLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", today);
        const { count: totalCalls } = await supabase.from("call_requests").select("*", { count: "exact", head: true });
        const { count: todayCalls } = await supabase.from("call_requests").select("*", { count: "exact", head: true }).gte("created_at", today);
        
        const statsMessage = `📊 *Статистика APLink*\n\n*Ошибки:*\n• Всего: ${totalLogs || 0}\n• Сегодня: ${todayLogs || 0}\n\n*Звонки:*\n• Всего: ${totalCalls || 0}\n• Сегодня: ${todayCalls || 0}\n\n_${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: statsMessage, parse_mode: "Markdown" })
        });
        
      } else if (text === "/clear") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: deletedLogs } = await supabase.from("error_logs").delete().lt("created_at", weekAgo).select("id");
        const { data: deletedGroups } = await supabase.from("error_groups").delete().lt("last_seen", weekAgo).select("id");
        
        const clearMessage = `🗑 *Очистка завершена*\n\nУдалено:\n• Логов: ${deletedLogs?.length || 0}\n• Групп: ${deletedGroups?.length || 0}`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: clearMessage, parse_mode: "Markdown" })
        });
        
      } else if (text.startsWith("/groupcall")) {
        // Parse usernames from command: /groupcall @user1 @user2 @user3
        const parts = text.split(/\s+/).slice(1);
        const usernames = parts.filter(p => p.startsWith("@")).map(p => p.slice(1).toLowerCase());
        
        if (usernames.length === 0) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ *Использование:*\n`/groupcall @user1 @user2 @user3`\n\nУкажите хотя бы одного пользователя.",
              parse_mode: "Markdown"
            })
          });
        } else {
          // Find caller's user_id by telegram_id
          const { data: callerProfile } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .eq("telegram_id", fromUser?.id)
            .single();
          
          if (!callerProfile) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "❌ Ваш аккаунт не привязан. Используйте /link для привязки.",
                parse_mode: "Markdown"
              })
            });
          } else {
            // Invoke group call function
            const response = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-group-call`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  created_by: callerProfile.user_id,
                  participants: usernames,
                }),
              }
            );
            
            const result = await response.json();
            
            if (result.success) {
              const notifiedCount = result.participants.filter((p: { status: string }) => p.status === "notified").length;
              
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `✅ *Групповой звонок создан!*\n\n📍 Комната: \`${result.room_name}\`\n👥 Приглашено: ${usernames.length}\n📨 Уведомлено: ${notifiedCount}\n⏱ Истекает через 2 минуты`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [[
                      { text: "🎥 Присоединиться", web_app: { url: result.room_url } }
                    ]]
                  }
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `❌ Ошибка: ${result.error}`,
                  parse_mode: "Markdown"
                })
              });
            }
          }
        }
        
      } else if (text === "/mycalls") {
        // Get user's call history
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: calls } = await supabase
            .from("call_requests")
            .select("room_name, is_group_call, created_at, status")
            .eq("created_by", profile.user_id)
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (calls && calls.length > 0) {
            const callsList = calls.map(c => {
              const icon = c.is_group_call ? "👥" : "📞";
              const status = c.status === "active" ? "🟢" : c.status === "ended" ? "⚫" : "⏳";
              const date = new Date(c.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
              return `${icon} ${status} ${c.room_name}\n   _${date}_`;
            }).join("\n\n");
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `📋 *История звонков:*\n\n${callsList}`,
                parse_mode: "Markdown"
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "📋 У вас пока нет звонков.",
                parse_mode: "Markdown"
              })
            });
          }
        } else {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ Аккаунт не привязан. Используйте /link",
              parse_mode: "Markdown"
            })
          });
        }
        
      } else if (text === "/contacts") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("nickname, contact_user_id")
            .eq("user_id", profile.user_id)
            .limit(20);
          
          if (contacts && contacts.length > 0) {
            // Get profiles for contacts
            const contactsList = await Promise.all(contacts.map(async (c) => {
              const { data: contactProfile } = await supabase
                .from("profiles")
                .select("display_name, username, telegram_id")
                .eq("user_id", c.contact_user_id)
                .single();
              
              const name = c.nickname || contactProfile?.display_name || "Пользователь";
              const username = contactProfile?.username ? `@${contactProfile.username}` : "";
              const hasTelegram = contactProfile?.telegram_id ? "📱" : "";
              return `• ${name} ${username} ${hasTelegram}`;
            }));
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `⭐ *Ваши контакты:*\n\n${contactsList.join("\n")}\n\n📱 = Telegram привязан`,
                parse_mode: "Markdown"
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "⭐ У вас пока нет контактов.",
                parse_mode: "Markdown"
              })
            });
          }
        } else {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ Аккаунт не привязан. Используйте /link",
              parse_mode: "Markdown"
            })
          });
        }
        
      } else if (text === "/link") {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "🔗 *Привязка аккаунта*\n\nОткройте APLink через кнопку ниже и войдите в свой аккаунт. Telegram будет автоматически привязан.",
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "🔗 Открыть APLink", web_app: { url: WEB_APP_URL } }
              ]]
            }
          })
        });
        
      } else if (text === "/help" || text === "/start") {
        const helpMessage = `🎥 *APLink Bot*\n\nДоступные команды:\n\n📞 /call - Создать звонок\n👥 /groupcall @user1 @user2 - Групповой звонок\n📋 /mycalls - История звонков\n⭐ /contacts - Мои контакты\n🔗 /link - Привязать аккаунт\n📊 /stats - Статистика\n🗑 /clear - Очистить старые логи\n\nИспользуйте кнопку меню для быстрого доступа к приложению!`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMessage,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: "🎥 Открыть APLink", web_app: { url: WEB_APP_URL } }
              ]]
            }
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
