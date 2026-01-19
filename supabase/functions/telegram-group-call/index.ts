import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEB_APP_URL = "https://aplink.live";

interface GroupCallRequest {
  created_by: string; // user_id
  participants: string[]; // array of telegram_ids or usernames
  room_name?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { created_by, participants, room_name }: GroupCallRequest = await req.json();

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    if (!created_by || !participants || participants.length === 0) {
      throw new Error("Missing required fields: created_by, participants");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate room name if not provided
    const finalRoomName = room_name || `group-${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes

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
      throw new Error("Failed to create call request");
    }

    console.log("Created call request:", callRequest.id);

    // Process participants - find their telegram_ids
    const participantResults: Array<{
      telegram_id: string | null;
      user_id: string | null;
      status: string;
      error?: string;
    }> = [];

    for (const participant of participants) {
      let telegramId: string | null = null;
      let userId: string | null = null;

      // Check if it's a telegram_id (number) or username
      if (/^\d+$/.test(participant)) {
        telegramId = participant;
        // Find user by telegram_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", parseInt(participant))
          .single();
        userId = profile?.user_id || null;
      } else {
        // It's a username, find profile
        const cleanUsername = participant.replace(/^@/, "").toLowerCase();
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, telegram_id")
          .eq("username", cleanUsername)
          .single();
        
        if (profile) {
          userId = profile.user_id;
          telegramId = profile.telegram_id ? String(profile.telegram_id) : null;
        }
      }

      // Insert participant record
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
        participantResults.push({
          telegram_id: telegramId,
          user_id: userId,
          status: "error",
          error: participantError.message,
        });
        continue;
      }

      // Send Telegram notification if telegram_id exists
      if (telegramId) {
        const message = `🎥 *Групповой звонок!*

👤 *Организатор:* ${creatorName}
👥 *Участников:* ${participants.length}
⏱ *Истекает через:* 2 минуты

Нажмите кнопку ниже, чтобы присоединиться.`;

        const keyboard = {
          inline_keyboard: [
            [
              { 
                text: "🎥 Присоединиться", 
                web_app: { url: `${WEB_APP_URL}/room/${finalRoomName}` }
              }
            ],
            [
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

          participantResults.push({
            telegram_id: telegramId,
            user_id: userId,
            status: telegramData.ok ? "notified" : "notification_failed",
          });

          // Try to send voice notification
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
          participantResults.push({
            telegram_id: telegramId,
            user_id: userId,
            status: "notification_failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } else {
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
