import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    const { action, webAppUrl } = await req.json();
    const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    if (action === "setup") {
      // Use provided URL or default to aplink.live
      const appUrl = webAppUrl || "https://aplink.live";
      
      // Set up the menu button to open the web app
      const menuButtonResult = await fetch(`${TELEGRAM_API}/setChatMenuButton`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: {
            type: "web_app",
            text: "🎥 Открыть APLink",
            web_app: {
              url: appUrl,
            },
          },
        }),
      });

      const menuButtonData = await menuButtonResult.json();
      console.log("setChatMenuButton result:", menuButtonData);

      // Set bot commands including groupcall
      const commandsResult = await fetch(`${TELEGRAM_API}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "start", description: "🚀 Начать работу" },
            { command: "call", description: "📞 Создать звонок" },
            { command: "groupcall", description: "👥 Групповой звонок" },
            { command: "mycalls", description: "📋 История звонков" },
            { command: "contacts", description: "⭐ Мои контакты" },
            { command: "link", description: "🔗 Привязать аккаунт" },
            { command: "stats", description: "📊 Статистика" },
            { command: "help", description: "❓ Помощь" },
          ],
        }),
      });

      const commandsData = await commandsResult.json();
      console.log("setMyCommands result:", commandsData);

      // Get bot info
      const botInfo = await fetch(`${TELEGRAM_API}/getMe`);
      const botData = await botInfo.json();
      console.log("Bot info:", botData);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Telegram Web App configured successfully!",
          bot: botData.result,
          menuButton: menuButtonData,
          commands: commandsData,
          webAppUrl: appUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getInfo") {
      const botInfo = await fetch(`${TELEGRAM_API}/getMe`);
      const botData = await botInfo.json();

      return new Response(
        JSON.stringify({
          success: true,
          bot: botData.result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Unknown action");
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
