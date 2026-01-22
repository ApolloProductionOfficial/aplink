import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EventPayload {
  eventType: string;
  pagePath?: string;
  eventData?: Record<string, unknown>;
  sessionId?: string;
  referrer?: string;
  userAgent?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EventPayload = await req.json();
    const { eventType, pagePath, eventData, sessionId, referrer, userAgent } = payload;

    if (!eventType) {
      return new Response(
        JSON.stringify({ error: "eventType is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS for anonymous tracking
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate session ID if not provided
    const finalSessionId = sessionId || `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Insert analytics event (user_id = null for anonymous)
    const { error } = await supabase.from("site_analytics").insert({
      event_type: eventType,
      page_path: pagePath || null,
      event_data: eventData || {},
      session_id: finalSessionId,
      referrer: referrer || null,
      user_agent: userAgent || req.headers.get("user-agent") || null,
      user_id: null, // Anonymous
    });

    if (error) {
      console.error("Failed to insert analytics:", error);
      return new Response(
        JSON.stringify({ error: "Failed to track event", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sessionId: finalSessionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in track-anonymous-event:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
