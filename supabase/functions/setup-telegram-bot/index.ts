import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot commands for Telegram menu
const BOT_COMMANDS = [
  { command: "start", description: "🎥 Начать работу с ботом" },
  { command: "call", description: "📞 Позвонить пользователю" },
  { command: "groupcall", description: "👥 Групповой звонок" },
  { command: "missed", description: "📵 Пропущенные звонки" },
  { command: "mycalls", description: "📋 История звонков" },
  { command: "contacts", description: "⭐ Мои контакты" },
  { command: "link", description: "🔗 Привязать аккаунт" },
  { command: "settings", description: "⚙️ Настройки уведомлений" },
  { command: "stats", description: "📊 Статистика" },
  { command: "help", description: "❓ Помощь" },
];

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: "TELEGRAM_BOT_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown> = {};

    // 1. Set bot commands (menu)
    const setCommandsResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: BOT_COMMANDS }),
      }
    );
    const setCommandsResult = await setCommandsResponse.json();
    results.setCommands = setCommandsResult;
    console.log("Set commands result:", setCommandsResult);

    // 2. Set webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-bot-webhook`;
    const setWebhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query", "my_chat_member"],
          drop_pending_updates: false,
        }),
      }
    );
    const setWebhookResult = await setWebhookResponse.json();
    results.setWebhook = setWebhookResult;
    console.log("Set webhook result:", setWebhookResult);

    // 3. Get webhook info for verification
    const getWebhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const webhookInfo = await getWebhookResponse.json();
    results.webhookInfo = webhookInfo;
    console.log("Webhook info:", webhookInfo);

    // 4. Get bot info
    const getMeResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    );
    const botInfo = await getMeResponse.json();
    results.botInfo = botInfo;
    console.log("Bot info:", botInfo);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Bot setup completed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Setup error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
