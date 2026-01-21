import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bot commands for Telegram menu - 3 languages
const BOT_COMMANDS_RU = [
  { command: "start", description: "🎥 Начать работу с ботом" },
  { command: "call", description: "📞 Позвонить пользователю" },
  { command: "groupcall", description: "👥 Групповой звонок" },
  { command: "missed", description: "📵 Пропущенные звонки" },
  { command: "mycalls", description: "📋 История звонков" },
  { command: "contacts", description: "⭐ Мои контакты" },
  { command: "settings", description: "⚙️ Настройки уведомлений" },
  { command: "stats", description: "📊 Статистика" },
  { command: "lang", description: "🌐 Язык бота (RU/EN/UK)" },
  { command: "setwelcome", description: "🎬 Изменить приветствие (админ)" },
  { command: "help", description: "❓ Помощь" },
];

const BOT_COMMANDS_EN = [
  { command: "start", description: "🎥 Start" },
  { command: "call", description: "📞 Call a user" },
  { command: "groupcall", description: "👥 Group call" },
  { command: "missed", description: "📵 Missed calls" },
  { command: "mycalls", description: "📋 Call history" },
  { command: "contacts", description: "⭐ My contacts" },
  { command: "settings", description: "⚙️ Notification settings" },
  { command: "stats", description: "📊 Stats" },
  { command: "lang", description: "🌐 Bot language (RU/EN/UK)" },
  { command: "setwelcome", description: "🎬 Change welcome (admin)" },
  { command: "help", description: "❓ Help" },
];

const BOT_COMMANDS_UK = [
  { command: "start", description: "🎥 Почати роботу з ботом" },
  { command: "call", description: "📞 Зателефонувати користувачу" },
  { command: "groupcall", description: "👥 Груповий дзвінок" },
  { command: "missed", description: "📵 Пропущені дзвінки" },
  { command: "mycalls", description: "📋 Історія дзвінків" },
  { command: "contacts", description: "⭐ Мої контакти" },
  { command: "settings", description: "⚙️ Налаштування сповіщень" },
  { command: "stats", description: "📊 Статистика" },
  { command: "lang", description: "🌐 Мова бота (RU/EN/UK)" },
  { command: "setwelcome", description: "🎬 Змінити привітання (адмін)" },
  { command: "help", description: "❓ Допомога" },
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

    // 1. Set bot commands (menu) - localized RU/EN/UK
    const setCommandsResponseRu = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: BOT_COMMANDS_RU, language_code: "ru" }),
      }
    );
    const setCommandsResultRu = await setCommandsResponseRu.json();
    results.setCommandsRu = setCommandsResultRu;
    console.log("Set commands (ru) result:", setCommandsResultRu);

    const setCommandsResponseEn = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: BOT_COMMANDS_EN, language_code: "en" }),
      }
    );
    const setCommandsResultEn = await setCommandsResponseEn.json();
    results.setCommandsEn = setCommandsResultEn;
    console.log("Set commands (en) result:", setCommandsResultEn);

    const setCommandsResponseUk = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: BOT_COMMANDS_UK, language_code: "uk" }),
      }
    );
    const setCommandsResultUk = await setCommandsResponseUk.json();
    results.setCommandsUk = setCommandsResultUk;
    console.log("Set commands (uk) result:", setCommandsResultUk);

    // Also set default commands (fallback) to RU
    const setCommandsResponseDefault = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commands: BOT_COMMANDS_RU }),
      }
    );
    const setCommandsResultDefault = await setCommandsResponseDefault.json();
    results.setCommandsDefault = setCommandsResultDefault;
    console.log("Set commands (default) result:", setCommandsResultDefault);

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
        message: "Bot setup completed with 3 languages (RU/EN/UK)",
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
