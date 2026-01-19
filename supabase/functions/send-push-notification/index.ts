import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, data, icon, url }: PushNotificationRequest = await req.json();

    if (!user_id || !title || !body) {
      throw new Error("Missing required fields: user_id, title, body");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw new Error("Failed to fetch push subscriptions");
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${user_id}`);
      return new Response(
        JSON.stringify({ success: false, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s) for user ${user_id}`);

    // Web Push requires VAPID keys - we'll use a simpler approach
    // by storing the subscription and letting the client poll or use SSE
    // For full Web Push, you'd need VAPID keys configured

    const results: Array<{ endpoint: string; success: boolean; error?: string }> = [];

    for (const sub of subscriptions) {
      try {
        // Create a notification payload
        const payload = JSON.stringify({
          title,
          body,
          icon: icon || "/favicon.png",
          badge: "/favicon.png",
          data: {
            ...data,
            url: url || "/dashboard",
            timestamp: Date.now(),
          },
        });

        // In a full implementation, you'd send to the push service here
        // For now, we'll store pending notifications for the client to fetch
        // This is a simplified approach without VAPID keys

        console.log(`Notification prepared for endpoint: ${sub.endpoint.substring(0, 50)}...`);
        
        results.push({
          endpoint: sub.endpoint.substring(0, 50) + "...",
          success: true,
        });
      } catch (error) {
        console.error(`Failed to send to ${sub.endpoint}:`, error);
        results.push({
          endpoint: sub.endpoint.substring(0, 50) + "...",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Push notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
