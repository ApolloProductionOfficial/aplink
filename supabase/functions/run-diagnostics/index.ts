import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DiagnosticResult {
  category: string;
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
  fixable?: boolean;
  fixAction?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let action = "scan";
    let scheduled = false;
    
    try {
      const body = await req.json();
      action = body.action || "scan";
      scheduled = body.scheduled || false;
    } catch {
      // Body may be empty for some requests
    }
    
    const results: DiagnosticResult[] = [];
    const fixes: string[] = [];

    // 1. Check error_logs for patterns
    const { data: recentErrors, error: errorLogsError } = await supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (errorLogsError) {
      results.push({
        category: "Database",
        name: "Error Logs Access",
        status: "error",
        message: `Cannot access error_logs: ${errorLogsError.message}`,
      });
    } else {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentCount = (recentErrors || []).filter(
        (e) => new Date(e.created_at) > hourAgo
      ).length;

      if (recentCount > 20) {
        results.push({
          category: "Errors",
          name: "Error Spike Detected",
          status: "error",
          message: `${recentCount} errors in the last hour - investigate immediately`,
          details: { count: recentCount },
          fixable: false,
        });
      } else if (recentCount > 5) {
        results.push({
          category: "Errors",
          name: "Elevated Error Rate",
          status: "warning",
          message: `${recentCount} errors in the last hour`,
          details: { count: recentCount },
        });
      } else {
        results.push({
          category: "Errors",
          name: "Error Rate",
          status: "ok",
          message: `${recentCount} errors in the last hour - normal`,
        });
      }

      // Check for recurring error patterns
      const errorPatterns = new Map<string, number>();
      (recentErrors || []).forEach((err) => {
        const key = `${err.error_type}:${err.source || "unknown"}`;
        errorPatterns.set(key, (errorPatterns.get(key) || 0) + 1);
      });

      const recurringErrors = Array.from(errorPatterns.entries())
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);

      if (recurringErrors.length > 0) {
        results.push({
          category: "Errors",
          name: "Recurring Error Patterns",
          status: "warning",
          message: `Found ${recurringErrors.length} recurring error pattern(s)`,
          details: { patterns: recurringErrors.slice(0, 5) },
          fixable: true,
          fixAction: "clear_old_errors",
        });
      }
    }

    // 2. Check meeting_transcripts for orphaned records
    const { count: transcriptCount } = await supabase
      .from("meeting_transcripts")
      .select("*", { count: "exact", head: true });

    const { count: emptyTranscriptsCount } = await supabase
      .from("meeting_transcripts")
      .select("*", { count: "exact", head: true })
      .is("transcript", null);

    if ((emptyTranscriptsCount || 0) > 10) {
      results.push({
        category: "Meetings",
        name: "Empty Transcripts",
        status: "warning",
        message: `${emptyTranscriptsCount} meetings have no transcript`,
        fixable: true,
        fixAction: "cleanup_empty_transcripts",
      });
    } else {
      results.push({
        category: "Meetings",
        name: "Transcript Health",
        status: "ok",
        message: `${transcriptCount || 0} total meetings, ${emptyTranscriptsCount || 0} without transcript`,
      });
    }

    // 3. Check participant_geo_data for stale entries
    const { count: geoDataCount } = await supabase
      .from("participant_geo_data")
      .select("*", { count: "exact", head: true });

    results.push({
      category: "Participants",
      name: "Geo Data",
      status: "ok",
      message: `${geoDataCount || 0} participant geo records stored`,
    });

    // 4. Check error_groups for Telegram notification issues
    const { data: errorGroups } = await supabase
      .from("error_groups")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(10);

    if (errorGroups && errorGroups.length > 0) {
      const groupsWithoutTelegram = errorGroups.filter(
        (g) => !g.telegram_message_id
      );
      if (groupsWithoutTelegram.length > 0) {
        results.push({
          category: "Notifications",
          name: "Telegram Sync",
          status: "warning",
          message: `${groupsWithoutTelegram.length} error groups missing Telegram message ID`,
        });
      } else {
        results.push({
          category: "Notifications",
          name: "Telegram Sync",
          status: "ok",
          message: "All error groups synced with Telegram",
        });
      }
    }

    // 5. Check user_presence for stuck users
    const { data: stuckPresence } = await supabase
      .from("user_presence")
      .select("*")
      .eq("is_online", true)
      .lt("last_seen", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (stuckPresence && stuckPresence.length > 0) {
      results.push({
        category: "Users",
        name: "Stuck Online Status",
        status: "warning",
        message: `${stuckPresence.length} users marked online but inactive for 30+ min`,
        fixable: true,
        fixAction: "cleanup_stale_presence",
      });
    } else {
      results.push({
        category: "Users",
        name: "Presence Health",
        status: "ok",
        message: "No stuck online statuses detected",
      });
    }

    // 6. Check translation_history size
    const { count: translationCount } = await supabase
      .from("translation_history")
      .select("*", { count: "exact", head: true });

    if ((translationCount || 0) > 5000) {
      results.push({
        category: "Storage",
        name: "Translation History",
        status: "warning",
        message: `${translationCount} translation records - consider cleanup`,
        fixable: true,
        fixAction: "cleanup_old_translations",
      });
    } else {
      results.push({
        category: "Storage",
        name: "Translation History",
        status: "ok",
        message: `${translationCount || 0} translation records`,
      });
    }

    // 7. Check for old meeting_participants without left_at
    const { data: stuckParticipants } = await supabase
      .from("meeting_participants")
      .select("*")
      .is("left_at", null)
      .lt("joined_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (stuckParticipants && stuckParticipants.length > 0) {
      results.push({
        category: "Meetings",
        name: "Stuck Participants",
        status: "warning",
        message: `${stuckParticipants.length} participants joined 24+ hours ago without leaving`,
        fixable: true,
        fixAction: "cleanup_old_participants",
      });
    } else {
      results.push({
        category: "Meetings",
        name: "Participant Tracking",
        status: "ok",
        message: "No stuck participants detected",
      });
    }

    // Apply fixes if action is "fix"
    if (action === "fix") {
      // Fix: Clear old errors (7+ days)
      const { count: deletedErrors } = await supabase
        .from("error_logs")
        .delete()
        .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      if (deletedErrors && deletedErrors > 0) {
        fixes.push(`Deleted ${deletedErrors} old error logs (7+ days)`);
      }

      // Fix: Cleanup stale presence
      const { count: cleanedPresence } = await supabase
        .from("user_presence")
        .update({ is_online: false })
        .eq("is_online", true)
        .lt("last_seen", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (cleanedPresence && cleanedPresence > 0) {
        fixes.push(`Fixed ${cleanedPresence} stuck online statuses`);
      }

      // Fix: Mark old participants as left
      const { count: fixedParticipants } = await supabase
        .from("meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .is("left_at", null)
        .lt("joined_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (fixedParticipants && fixedParticipants > 0) {
        fixes.push(`Marked ${fixedParticipants} old participants as left`);
      }

      // Fix: Cleanup old translation history (30+ days)
      const { count: deletedTranslations } = await supabase
        .from("translation_history")
        .delete()
        .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (deletedTranslations && deletedTranslations > 0) {
        fixes.push(`Deleted ${deletedTranslations} old translations (30+ days)`);
      }

      if (fixes.length === 0) {
        fixes.push("No fixes needed - everything is healthy!");
      }
    }

    // Calculate summary
    const errorCount = results.filter((r) => r.status === "error").length;
    const warningCount = results.filter((r) => r.status === "warning").length;
    const okCount = results.filter((r) => r.status === "ok").length;

    // Send summary to Telegram
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const adminChatId = "2061785720";

    if (telegramToken) {
      const statusEmoji =
        errorCount > 0 ? "🔴" : warningCount > 0 ? "🟡" : "🟢";
      const scheduledLabel = scheduled ? " (⏰ по расписанию)" : "";
      const summary = `${statusEmoji} *Диагностика APLink*${scheduledLabel}

✅ OK: ${okCount}
⚠️ Warnings: ${warningCount}
❌ Errors: ${errorCount}

${results
  .filter((r) => r.status !== "ok")
  .map((r) => `• ${r.status === "error" ? "❌" : "⚠️"} ${r.name}: ${r.message}`)
  .join("\n") || "Всё в порядке!"}

${fixes.length > 0 && action === "fix" ? `\n*Применённые фиксы:*\n${fixes.map((f) => `✔️ ${f}`).join("\n")}` : ""}`;

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: summary,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        fixes,
        summary: {
          total: results.length,
          ok: okCount,
          warnings: warningCount,
          errors: errorCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Diagnostics error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
