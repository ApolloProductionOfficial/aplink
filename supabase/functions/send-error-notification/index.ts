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
    
    // Create JSON file content for download
    const errorReport = {
      timestamp,
      source: source || "Неизвестно",
      errorType: errorType || "Общая ошибка",
      errorMessage: errorMessage || "Нет описания",
      details: details || null,
      userAgent: details?.userAgent || "Unknown",
      url: details?.url || "Unknown",
    };
    
    const jsonContent = JSON.stringify(errorReport, null, 2);
    const base64Json = btoa(unescape(encodeURIComponent(jsonContent)));
    
    // Create attachment for the email
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; }
            .error-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px; word-break: break-all; }
            .details { background: #f8fafc; padding: 15px; border-radius: 4px; margin-top: 15px; }
            .label { font-weight: bold; color: #475569; }
            .footer { background: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; }
            .json-block { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; margin: 15px 0; max-height: 300px; overflow-y: auto; }
            .copy-hint { background: #3b82f6; color: white; padding: 10px 15px; border-radius: 6px; margin: 15px 0; text-align: center; }
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
              
          <div class="copy-hint">
                📥 Скачайте JSON файл для анализа
              </div>
              
              <div style="text-align: center; margin: 15px 0;">
                <a href="data:application/json;charset=utf-8;base64,${base64Json}" 
                   download="error-report-${Date.now()}.json"
                   style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);">
                  📥 Скачать JSON отчёт
                </a>
              </div>
              
              <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #3b82f6; font-weight: bold;">📋 Или скопируйте JSON вручную</summary>
                <div class="json-block">${jsonContent}</div>
              </details>
              
              ${details ? `
                <div class="details">
                  <strong>Дополнительные детали:</strong><br/>
                  <pre style="white-space: pre-wrap; word-wrap: break-word; font-size: 11px;">${JSON.stringify(details, null, 2)}</pre>
                </div>
              ` : ""}
            </div>
            <div class="footer">
              Apollo Production - Автоматическое уведомление<br/>
              <small>Скачайте JSON отчёт и отправьте в чат для анализа</small>
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
