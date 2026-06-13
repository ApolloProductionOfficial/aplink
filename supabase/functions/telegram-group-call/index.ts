import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEB_APP_URL = "https://aplink.live";

interface GroupCallRequest {
  created_by: string;
  participants: string[];
  room_name?: string;
  notify_creator_on_error?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "aplink" } }
  );

  try {
    const body = await req.json();
    console.log("[telegram-group-call] Incoming request:", JSON.stringify(body));
    
    const { created_by, participants, room_name, notify_creator_on_error }: GroupCallRequest = body;

    if (!TELEGRAM_BOT_TOKEN) {
      console.error("[telegram-group-call] TELEGRAM_BOT_TOKEN not configured");
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    if (!created_by || !participants || participants.length === 0) {
      console.error("[telegram-group-call] Missing required fields:", { created_by, participants });
      throw new Error("Missing required fields: created_by, participants");
    }
    
    console.log("[telegram-group-call] Processing call from:", created_by, "to:", participants);

    // Helper function to send error notification to creator
    const sendErrorToCreator = async (errorMessage: string, details?: Record<string, unknown>) => {
      if (!notify_creator_on_error) return;
      
      const { data: creatorData } = await supabase
        .from("profiles")
        .select("telegram_id")
        .eq("user_id", created_by)
        .single();
      
      if (creatorData?.telegram_id) {
        const message = `❌ *Ошибка создания звонка*\n\n${errorMessage}\n\n${details ? `📋 Детали:\n\`${JSON.stringify(details)}\`` : ""}\n\n⏰ ${new Date().toLocaleString("ru-RU")}`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: creatorData.telegram_id,
            text: message,
            parse_mode: "Markdown",
          }),
        });
      }
    };

    // Generate room name if not provided
    const finalRoomName = room_name || `group-${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    // Get creator's profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("display_name, username, telegram_id")
      .eq("user_id", created_by)
      .single();

    const creatorName = creatorProfile?.display_name || creatorProfile?.username || "Пользователь";

    // Create call request
    const { data: callRequest, error: callError } = await supabase
      .from("call_requests")
      .insert({
        room_name: finalRoomName,
        created_by,
        is_group_call: true,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (callError) {
      console.error("Error creating call request:", callError);
      await sendErrorToCreator("Не удалось создать запрос звонка", { error: callError.message });
      throw new Error("Failed to create call request");
    }

    console.log("Created call request:", callRequest.id);

    // Process participants
    const participantResults: Array<{
      telegram_id: string | null;
      user_id: string | null;
      status: string;
      error?: string;
    }> = [];

    for (const participant of participants) {
      let telegramId: string | null = null;
      let userId: string | null = null;

      if (/^\d+$/.test(participant)) {
        telegramId = participant;
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", parseInt(participant))
          .single();
        userId = profile?.user_id || null;
      } else {
        const cleanUsername = participant.replace(/^@/, "").toLowerCase();
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, telegram_id")
          .eq("username", cleanUsername)
          .single();
        
        if (profile) {
          userId = profile.user_id;
          telegramId = profile.telegram_id ? String(profile.telegram_id) : null;
        } else {
          // User not found - notify creator
          await sendErrorToCreator(`Пользователь @${cleanUsername} не найден в системе`, { username: cleanUsername });
          participantResults.push({
            telegram_id: null,
            user_id: null,
            status: "user_not_found",
            error: "User not found",
          });
          continue;
        }
      }

      const { error: participantError } = await supabase
        .from("call_participants")
        .insert({
          call_request_id: callRequest.id,
          user_id: userId,
          telegram_id: telegramId ? parseInt(telegramId) : null,
          status: "invited",
        });

      if (participantError) {
        console.error("Error adding participant:", participantError);
        await sendErrorToCreator("Ошибка добавления участника", { participant, error: participantError.message });
        participantResults.push({
          telegram_id: telegramId,
          user_id: userId,
          status: "error",
          error: participantError.message,
        });
        continue;
      }

      if (telegramId) {
        // Check if user has DND enabled
        let dndActive = false;
        let dndAutoReply = "";
        
        if (userId) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("dnd_enabled, dnd_start_time, dnd_end_time, dnd_auto_reply")
            .eq("user_id", userId)
            .single();
          
          if (userProfile?.dnd_enabled) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            const startTime = userProfile.dnd_start_time || "22:00";
            const endTime = userProfile.dnd_end_time || "08:00";
            
            // Check if currently in DND time range
            if (startTime > endTime) {
              // Overnight DND (e.g., 22:00 to 08:00)
              dndActive = currentTime >= startTime || currentTime <= endTime;
            } else {
              dndActive = currentTime >= startTime && currentTime <= endTime;
            }
            
            dndAutoReply = userProfile.dnd_auto_reply || "Пользователь сейчас недоступен. Попробуйте позже.";
          }
        }
        
        if (dndActive) {
          // Send DND auto-reply to caller
          const callerTelegramId = creatorProfile?.telegram_id;
          if (callerTelegramId) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: callerTelegramId,
                text: `🌙 *Режим "Не беспокоить"*\n\nУчастник сейчас недоступен:\n_${dndAutoReply}_`,
                parse_mode: "Markdown",
              }),
            });
          }
          
          participantResults.push({
            telegram_id: telegramId,
            user_id: userId,
            status: "dnd_active",
          });
          continue;
        }

        const message = `🎥 *Групповой звонок!*\n\n👤 *Организатор:* ${creatorName}\n👥 *Участников:* ${participants.length}\n⏱ *Истекает через:* 2 минуты\n\nНажмите кнопку ниже, чтобы присоединиться.`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "🎥 Присоединиться", web_app: { url: `${WEB_APP_URL}/room/${finalRoomName}` } }],
            [
              { text: "⏰ 5 мин", callback_data: `callback_5min:${created_by}` },
              { text: "⏰ 15 мин", callback_data: `callback_15min:${created_by}` }
            ],
            [
              { text: "💬 Занят, напишите", callback_data: `callback_busy:${created_by}` },
              { text: "❌ Отклонить", callback_data: `decline_group:${callRequest.id}` }
            ]
          ]
        };

        try {
          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: "Markdown",
                reply_markup: keyboard,
              }),
            }
          );

          const telegramData = await telegramResponse.json();
          console.log(`Notification sent to ${telegramId}:`, telegramData.ok);

          if (!telegramData.ok) {
            await sendErrorToCreator(`Не удалось отправить уведомление участнику`, { 
              telegram_id: telegramId, 
              telegram_error: telegramData.description 
            });
          }

          participantResults.push({
            telegram_id: telegramId,
            user_id: userId,
            status: telegramData.ok ? "notified" : "notification_failed",
          });

          // Voice notification
          try {
            await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-voice-notification`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  telegram_id: telegramId,
                  caller_name: creatorName,
                  is_group_call: true,
                  participant_count: participants.length,
                }),
              }
            );
          } catch (voiceError) {
            console.error("Voice notification error:", voiceError);
          }
        } catch (error) {
          console.error(`Failed to send notification to ${telegramId}:`, error);
          await sendErrorToCreator(`Ошибка отправки уведомления`, { telegram_id: telegramId });
          participantResults.push({
            telegram_id: telegramId,
            user_id: userId,
            status: "notification_failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
        await sendErrorToCreator(`У участника не привязан Telegram`, { participant });
        participantResults.push({
          telegram_id: null,
          user_id: userId,
          status: "no_telegram",
        });
      }
    }

    // Log activity
    await supabase.from("telegram_activity_log").insert({
      user_id: created_by,
      telegram_id: creatorProfile?.telegram_id || null,
      action: "group_call_created",
      metadata: {
        call_request_id: callRequest.id,
        room_name: finalRoomName,
        participant_count: participants.length,
        results: participantResults,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        call_request_id: callRequest.id,
        room_name: finalRoomName,
        room_url: `${WEB_APP_URL}/room/${finalRoomName}`,
        participants: participantResults,
        expires_at: expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Group call error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
