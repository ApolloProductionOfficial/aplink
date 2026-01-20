import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

interface CallbackRequest {
  callback_query?: {
    id: string;
    from: { id: number };
    data: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body: CallbackRequest = await req.json();
    const callback = body.callback_query;

    if (!callback) {
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { id: callbackId, from, data, message } = callback;
    const telegramId = from.id;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    console.log(`Processing callback: ${data} from ${telegramId}`);

    // Answer callback query first
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId }),
    });

    // Handle different callback actions
    if (data.startsWith("callback_5min:")) {
      const callerId = data.split(":")[1];
      
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
        .eq("telegram_id", telegramId)
        .single();
      
      const responderName = responderProfile?.display_name || responderProfile?.username || "Пользователь";
      
      if (callerProfile?.telegram_id) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callerProfile.telegram_id,
            text: `📞 *${responderName}* перезвонит через 5 минут`,
            parse_mode: "Markdown",
          }),
        });
      }

      // Update original message
      if (chatId && messageId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [[{ text: "✅ Отправлено: перезвоню через 5 мин", callback_data: "noop" }]] },
          }),
        });
      }

      // Log activity
      await supabase.from("telegram_activity_log").insert({
        telegram_id: telegramId,
        action: "quick_reply_5min",
        metadata: { caller_id: callerId },
      });
    }
    
    else if (data.startsWith("callback_busy:")) {
      const callerId = data.split(":")[1];
      
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("telegram_id, display_name, username")
        .eq("user_id", callerId)
        .single();
      
      const { data: responderProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("telegram_id", telegramId)
        .single();
      
      const responderName = responderProfile?.display_name || responderProfile?.username || "Пользователь";
      
      if (callerProfile?.telegram_id) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callerProfile.telegram_id,
            text: `💬 *${responderName}* сейчас занят. Напишите сообщение.`,
            parse_mode: "Markdown",
          }),
        });
      }

      if (chatId && messageId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [[{ text: "✅ Отправлено: занят, напишите", callback_data: "noop" }]] },
          }),
        });
      }

      await supabase.from("telegram_activity_log").insert({
        telegram_id: telegramId,
        action: "quick_reply_busy",
        metadata: { caller_id: callerId },
      });
    }
    
    else if (data.startsWith("callback_15min:")) {
      const callerId = data.split(":")[1];
      
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("telegram_id, display_name, username")
        .eq("user_id", callerId)
        .single();
      
      const { data: responderProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("telegram_id", telegramId)
        .single();
      
      const responderName = responderProfile?.display_name || responderProfile?.username || "Пользователь";
      
      if (callerProfile?.telegram_id) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callerProfile.telegram_id,
            text: `📞 *${responderName}* перезвонит через 15 минут`,
            parse_mode: "Markdown",
          }),
        });
      }

      if (chatId && messageId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [[{ text: "✅ Отправлено: перезвоню через 15 мин", callback_data: "noop" }]] },
          }),
        });
      }

      await supabase.from("telegram_activity_log").insert({
        telegram_id: telegramId,
        action: "quick_reply_15min",
        metadata: { caller_id: callerId },
      });
    }
    
    else if (data.startsWith("decline_call:") || data.startsWith("decline_group:")) {
      const callId = data.split(":")[1];
      
      // Update call participant status
      await supabase
        .from("call_participants")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("call_request_id", callId)
        .eq("telegram_id", telegramId);

      if (chatId && messageId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [[{ text: "❌ Звонок отклонён", callback_data: "noop" }]] },
          }),
        });
      }

      await supabase.from("telegram_activity_log").insert({
        telegram_id: telegramId,
        action: "call_declined",
        metadata: { call_id: callId },
      });
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (error: unknown) {
    console.error("Callback handler error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
