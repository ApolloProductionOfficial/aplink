import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEB_APP_URL = "https://aplink.live";

// Branded APLink welcome animation (Apollo logo style)
const WELCOME_GIF_URL = "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3FzYmYxcTdmNjRzamlhbHc4Z3kwaG1raGhhdHB2YjQyNjlkZTJ2eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tPnAAJxXTvpLwJy/giphy.gif";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  callback_query?: {
    id: string;
    data: string;
    from?: { id: number; username?: string; first_name?: string };
    message?: {
      chat?: { id: number };
      message_id?: number;
      text?: string;
    };
  };
  message?: {
    chat?: { id: number; title?: string; type?: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
    voice?: {
      file_id: string;
      duration: number;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      duration: number;
      file_size?: number;
    };
    reply_to_message?: {
      text?: string;
      voice?: { file_id: string };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    
    console.log("Webhook received:", JSON.stringify(update).substring(0, 500));
    
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
      
      } else if (callbackData.startsWith("translate:")) {
        // Handle translation callback for voice messages
        const parts = callbackData.split(":");
        const targetLang = parts[1];
        
        // Get the original message text (transcription)
        if (chatId && messageId) {
          // Get message to extract original text
          // Since we can't easily get the original, show a tip
          const langName = targetLang === "en" ? "английский" 
            : targetLang === "ru" ? "русский" 
            : targetLang === "es" ? "испанский" 
            : targetLang;
            
          responseText = `💡 Отправьте голосовое сообщение ещё раз с командой:\n/translate ${langName}`;
          
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText,
              parse_mode: "Markdown"
            })
          });
          
          responseText = `Перевод на ${langName}`;
        }
      
      } else if (callbackData === "link_account") {
        // Handle link account button from welcome message
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
        responseText = "Откройте приложение для привязки";
      
      } else if (callbackData === "settings_dnd_on" || callbackData === "settings_dnd_off") {
        // Toggle DND setting
        const dndEnabled = callbackData === "settings_dnd_on";
        
        if (fromUser?.id) {
          await supabase
            .from("profiles")
            .update({ dnd_enabled: dndEnabled })
            .eq("telegram_id", fromUser.id);
        }
        
        responseText = dndEnabled ? "🔕 Режим 'Не беспокоить' включён" : "🔔 Уведомления включены";
        
        // Update message with new buttons
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: dndEnabled ? "🔔 Включить уведомления" : "🔕 Не беспокоить", callback_data: dndEnabled ? "settings_dnd_off" : "settings_dnd_on" }],
                  [{ text: "⬅️ Назад", callback_data: "settings_back" }]
                ]
              }
            })
          });
        }
        
      } else if (callbackData === "settings_back") {
        // Go back to main settings
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: "⚙️ *Настройки APLink*\n\nВыберите опцию для настройки:",
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "🔕 Не беспокоить", callback_data: "settings_dnd_on" }],
                  [{ text: "🔔 Включить уведомления", callback_data: "settings_dnd_off" }],
                  [{ text: "🎥 Открыть APLink", web_app: { url: WEB_APP_URL } }]
                ]
              }
            })
          });
        }
        responseText = "Настройки";
      
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
      
      if (text === "/settings") {
        // Settings command
        const { data: profile } = await supabase
          .from("profiles")
          .select("dnd_enabled, voice_preference")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        const dndStatus = profile?.dnd_enabled ? "🔕 Включён" : "🔔 Выключен";
        
        const settingsMessage = `⚙️ *Настройки APLink*\n\n*Текущие настройки:*\n• Режим 'Не беспокоить': ${dndStatus}\n\nВыберите опцию для изменения:`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: settingsMessage,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: profile?.dnd_enabled ? "🔔 Выключить 'Не беспокоить'" : "🔕 Включить 'Не беспокоить'", callback_data: profile?.dnd_enabled ? "settings_dnd_off" : "settings_dnd_on" }],
                [{ text: "🎥 Открыть APLink", web_app: { url: WEB_APP_URL } }]
              ]
            }
          })
        });
      
      } else if (text === "/stats" || text === "/status") {
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
        
      } else if (text === "/missed") {
        // Get user's missed calls
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: missedCalls } = await supabase
            .from("call_participants")
            .select("call_request_id, status, invited_at")
            .eq("telegram_id", fromUser?.id)
            .in("status", ["invited", "declined"])
            .order("invited_at", { ascending: false })
            .limit(10);
          
          if (missedCalls && missedCalls.length > 0) {
            // Get call request details
            const callIds = missedCalls.map(c => c.call_request_id);
            const { data: callRequests } = await supabase
              .from("call_requests")
              .select("id, room_name, created_by, created_at")
              .in("id", callIds);
            
            // Get creator profiles
            const creatorIds = callRequests?.map(c => c.created_by).filter(Boolean) || [];
            const { data: creatorProfiles } = await supabase
              .from("profiles")
              .select("user_id, display_name, username")
              .in("user_id", creatorIds);
            
            const callsList = missedCalls.map(c => {
              const request = callRequests?.find(r => r.id === c.call_request_id);
              const creator = creatorProfiles?.find(p => p.user_id === request?.created_by);
              const name = creator?.display_name || (creator?.username ? `@${creator.username}` : "Неизвестный");
              const date = new Date(c.invited_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
              const status = c.status === "declined" ? "❌" : "📵";
              return `${status} От: *${name}*\n   _${date}_`;
            }).join("\n\n");
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `📵 *Пропущенные звонки:*\n\n${callsList}`,
                parse_mode: "Markdown"
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "📵 Нет пропущенных звонков",
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
        
      } else if (text === "/startcall" && chatId && chatId < 0) {
        // Group chat command to start a group call
        // Get chat info
        const chatInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId })
        });
        const chatInfo = await chatInfoResponse.json();
        const chatTitle = chatInfo.result?.title || "Групповой чат";
        
        // Check if caller is linked
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
              text: "❌ Ваш аккаунт не привязан к APLink.\nИспользуйте @aplink\\_live\\_bot в личных сообщениях и команду /link",
              parse_mode: "Markdown"
            })
          });
        } else {
          // Create a room with group chat name
          const roomName = `group-${chatId.toString().replace("-", "")}-${Date.now().toString(36)}`;
          
          // Create call request
          const { data: callRequest, error: insertError } = await supabase
            .from("call_requests")
            .insert({
              room_name: roomName,
              created_by: callerProfile.user_id,
              is_group_call: true,
              status: "pending",
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            })
            .select()
            .single();
          
          if (insertError || !callRequest) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: "❌ Ошибка создания звонка",
                parse_mode: "Markdown"
              })
            });
          } else {
            const callerName = callerProfile.display_name || fromUser?.first_name || "Пользователь";
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `🎥 *Групповой звонок*\n\n👤 Организатор: *${callerName}*\n💬 Чат: *${chatTitle}*\n⏱ Истекает через 5 минут\n\nНажмите кнопку ниже, чтобы присоединиться!`,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "🎥 Присоединиться к звонку", web_app: { url: `${WEB_APP_URL}/room/${roomName}` } }
                    ],
                    [
                      { text: "❌ Отклонить", callback_data: `decline_group:${callRequest.id}` }
                    ]
                  ]
                }
              })
            });
            
            // Log activity
            await supabase.from("telegram_activity_log").insert({
              telegram_id: fromUser?.id || null,
              action: "group_chat_call_started",
              metadata: { chat_id: chatId, room_name: roomName, chat_title: chatTitle },
            });
          }
        }
        
      } else if (text === "/help" || text === "/start") {
        const isGroupChat = chatId && chatId < 0;
        
        // Send branded APLink GIF animation first (only in private chat)
        if (!isGroupChat) {
          try {
            const gifResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                animation: WELCOME_GIF_URL,
                caption: "✨ *Добро пожаловать в APLink!*\n\n_Видеозвонки нового поколения_",
                parse_mode: "Markdown"
              })
            });
            const gifResult = await gifResponse.json();
            console.log("GIF send result:", JSON.stringify(gifResult));
          } catch (gifError) {
            console.log("Failed to send GIF, continuing with text:", gifError);
          }
        }
        
        const helpMessage = isGroupChat
          ? `🎥 *APLink Bot*\n\n📞 /startcall - Начать групповой звонок для этого чата\n📵 /missed - Пропущенные звонки\n\nВсе участники чата могут присоединиться нажав на кнопку!`
          : `🎥 *APLink Bot*\n\n*Доступные команды:*\n\n📞 /call @username - Позвонить\n👥 /groupcall @user1 @user2 - Групповой звонок\n📵 /missed - Пропущенные звонки\n📋 /mycalls - История звонков\n⭐ /contacts - Мои контакты\n🔗 /link - Привязать аккаунт\n⚙️ /settings - Настройки\n📊 /stats - Статистика\n🎤 Голосовое - Транскрипция\n\n💡 _Отправьте голосовое сообщение для транскрипции и перевода!_`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: helpMessage,
            parse_mode: "Markdown",
            reply_markup: isGroupChat ? undefined : {
              inline_keyboard: [
                [{ text: "🎥 Открыть APLink", web_app: { url: WEB_APP_URL } }],
                [{ text: "🔗 Привязать аккаунт", callback_data: "link_account" }]
              ]
            }
          })
        });
      }
    }

    // Handle voice messages
    if (update.message?.voice || update.message?.audio) {
      const chatId = update.message.chat?.id;
      const fromUser = update.message.from;
      const voice = update.message.voice || update.message.audio;
      
      if (voice && chatId && chatId > 0) { // Only in private chats
        console.log("Voice message received:", voice.file_id);
        
        // Send processing message
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, action: "typing" })
        });

        try {
          // Get file path from Telegram
          const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_id: voice.file_id })
          });
          const fileData = await fileResponse.json();
          
          if (!fileData.ok || !fileData.result?.file_path) {
            throw new Error("Failed to get file path");
          }

          // Download the audio file
          const audioUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
          const audioResponse = await fetch(audioUrl);
          const audioBlob = await audioResponse.blob();

          // Prepare form data for transcription
          const formData = new FormData();
          formData.append("file", audioBlob, "voice.ogg");
          formData.append("model_id", "scribe_v1");

          const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
          
          if (!ELEVENLABS_API_KEY) {
            throw new Error("ElevenLabs API key not configured");
          }

          // Transcribe using ElevenLabs
          const transcribeResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
            },
            body: formData,
          });

          if (!transcribeResponse.ok) {
            const errorText = await transcribeResponse.text();
            throw new Error(`Transcription failed: ${errorText}`);
          }

          const transcription = await transcribeResponse.json();
          const originalText = transcription.text || "Не удалось распознать текст";
          
          // Check if user wants translation (by replying with language code)
          const replyText = update.message.reply_to_message?.text?.toLowerCase();
          let translatedText = "";
          let targetLang = "";
          
          // Detect if user mentioned a language for translation
          if (replyText) {
            const langMatch = replyText.match(/перевод(?:и)?(?:\s+на)?\s+(английский|русский|español|english|russian)/i);
            if (langMatch) {
              targetLang = langMatch[1].toLowerCase();
            }
          }
          
          // If no translation needed, just send transcription
          let responseMessage = `🎤 *Транскрипция:*\n\n${originalText}`;
          
          if (targetLang) {
            // Call translation API (using Lovable AI)
            const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
            if (LOVABLE_API_KEY) {
              const translateResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: `Translate the following text to ${targetLang}. Return only the translation, nothing else.` },
                    { role: "user", content: originalText }
                  ]
                }),
              });
              
              if (translateResponse.ok) {
                const translateData = await translateResponse.json();
                translatedText = translateData.choices?.[0]?.message?.content || "";
                
                if (translatedText) {
                  responseMessage = `🎤 *Транскрипция:*\n${originalText}\n\n🌐 *Перевод (${targetLang}):*\n${translatedText}`;
                }
              }
            }
          }
          
          // Send transcription result with translation options
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseMessage,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🇬🇧 English", callback_data: `translate:en:${voice.file_id.slice(0, 20)}` },
                    { text: "🇷🇺 Русский", callback_data: `translate:ru:${voice.file_id.slice(0, 20)}` },
                    { text: "🇪🇸 Español", callback_data: `translate:es:${voice.file_id.slice(0, 20)}` },
                  ]
                ]
              }
            })
          });

          // Log activity
          await supabase.from("telegram_activity_log").insert({
            telegram_id: fromUser?.id || null,
            action: "voice_transcribed",
            metadata: { 
              duration: voice.duration, 
              text_length: originalText.length,
              translated: !!translatedText 
            },
          });

        } catch (transcribeError) {
          console.error("Voice transcription error:", transcribeError);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ Не удалось распознать голосовое сообщение. Попробуйте ещё раз.",
              parse_mode: "Markdown"
            })
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Error", { status: 500 });
  }
});
