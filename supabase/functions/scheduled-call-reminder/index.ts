import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Checking for scheduled calls needing reminders...");

    // Find calls scheduled 15 minutes from now that haven't had reminders sent
    const fifteenMinutesFromNow = new Date(Date.now() + 15 * 60 * 1000);
    const twentyMinutesFromNow = new Date(Date.now() + 20 * 60 * 1000);

    const { data: scheduledCalls, error } = await supabase
      .from("scheduled_calls")
      .select("*")
      .eq("status", "scheduled")
      .eq("reminder_sent", false)
      .gte("scheduled_at", fifteenMinutesFromNow.toISOString())
      .lt("scheduled_at", twentyMinutesFromNow.toISOString());

    if (error) {
      throw error;
    }

    console.log(`Found ${scheduledCalls?.length || 0} calls needing reminders`);

    const remindersSent: string[] = [];

    for (const call of scheduledCalls || []) {
      const scheduledTime = new Date(call.scheduled_at);
      const timeUntil = Math.round((scheduledTime.getTime() - Date.now()) / 60000);
      
      // Get participant telegram IDs
      const participantIds = call.participants_telegram_ids || [];
      
      if (participantIds.length === 0) {
        console.log(`No participants for call ${call.id}, skipping reminder`);
        continue;
      }

      // Get creator's profile for the notification
      let creatorName = "Пользователь";
      if (call.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("user_id", call.created_by)
          .single();
        
        if (profile) {
          creatorName = profile.display_name || profile.username || "Пользователь";
        }
      }

      const message = `🔔 *Напоминание о звонке!*

📞 *${call.room_name}*
⏰ Начало через ${timeUntil} минут
👤 Организатор: ${creatorName}
${call.description ? `📝 ${call.description}` : ""}

Ожидается ${participantIds.length} участник(ов)

[Присоединиться к звонку](https://aplink.live/meeting?room=${encodeURIComponent(call.room_name)})`;

      // Send to all participants
      for (const telegramId of participantIds) {
        try {
          const telegramRes = await fetch(
            `https://api.telegram.org/bot${telegramToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "📞 Присоединиться",
                        url: `https://aplink.live/meeting?room=${encodeURIComponent(call.room_name)}`,
                      },
                    ],
                  ],
                },
              }),
            }
          );

          if (telegramRes.ok) {
            console.log(`Reminder sent to ${telegramId} for call ${call.room_name}`);
          } else {
            const errorData = await telegramRes.json();
            console.error(`Failed to send to ${telegramId}:`, errorData);
          }
        } catch (err) {
          console.error(`Error sending to ${telegramId}:`, err);
        }
      }

      // Mark reminder as sent
      await supabase
        .from("scheduled_calls")
        .update({ reminder_sent: true })
        .eq("id", call.id);

      remindersSent.push(call.room_name);
    }

    // Also send to the creator's Telegram if available
    for (const call of scheduledCalls || []) {
      if (call.created_by) {
        const { data: creatorProfile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("user_id", call.created_by)
          .single();

        if (creatorProfile?.telegram_id) {
          const participantIds = call.participants_telegram_ids || [];
          // Don't send duplicate if creator is already in participants
          if (!participantIds.includes(creatorProfile.telegram_id)) {
            const scheduledTime = new Date(call.scheduled_at);
            const timeUntil = Math.round((scheduledTime.getTime() - Date.now()) / 60000);
            
            const creatorMessage = `🔔 *Ваш звонок скоро начнётся!*

📞 *${call.room_name}*
⏰ Начало через ${timeUntil} минут
👥 Участников: ${participantIds.length}
${call.description ? `📝 ${call.description}` : ""}`;

            try {
              await fetch(
                `https://api.telegram.org/bot${telegramToken}/sendMessage`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: creatorProfile.telegram_id,
                    text: creatorMessage,
                    parse_mode: "Markdown",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "📞 Начать звонок",
                            url: `https://aplink.live/meeting?room=${encodeURIComponent(call.room_name)}`,
                          },
                        ],
                      ],
                    },
                  }),
                }
              );
            } catch (err) {
              console.error(`Error sending creator reminder:`, err);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent: remindersSent.length,
        calls: remindersSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Reminder error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
