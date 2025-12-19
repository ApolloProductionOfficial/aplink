import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "usc954024@gmail.com";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { errorType, errorMessage, details, source } = await req.json();

    console.log("Sending error notification:", { errorType, errorMessage, source });

    const timestamp = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .error-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px; }
            .details { background: #f8fafc; padding: 15px; border-radius: 4px; margin-top: 15px; }
            .label { font-weight: bold; color: #475569; }
            .footer { background: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Ошибка в Apollo Production</h1>
            </div>
            <div class="content">
              <p><span class="label">Время:</span> ${timestamp}</p>
              <p><span class="label">Источник:</span> ${source || "Неизвестно"}</p>
              <p><span class="label">Тип ошибки:</span> ${errorType || "Общая ошибка"}</p>
              
              <div class="error-box">
                <strong>Сообщение:</strong><br/>
                ${errorMessage || "Нет описания"}
              </div>
              
              ${details ? `
                <div class="details">
                  <strong>Дополнительные детали:</strong><br/>
                  <pre style="white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(details, null, 2)}</pre>
                </div>
              ` : ""}
            </div>
            <div class="footer">
              Apollo Production - Автоматическое уведомление
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "Apollo Production <alerts@aplink.live>",
      to: [ADMIN_EMAIL],
      subject: `⚠️ [${errorType || "ERROR"}] Apollo Production - ${source || "System"}`,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", data);
    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-error-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
