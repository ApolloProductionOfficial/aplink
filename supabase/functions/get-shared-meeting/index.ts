import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching shared meeting by token');

    // Use service role to bypass RLS (token validation is done here)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: link, error: linkError } = await supabase
      .from('shared_meeting_links')
      .select('meeting_id, is_active, expires_at')
      .eq('share_token', token)
      .maybeSingle();

    if (linkError || !link) {
      console.error('Share link not found:', linkError);
      return new Response(
        JSON.stringify({ error: 'Ссылка не найдена или недействительна' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!link.is_active) {
      return new Response(
        JSON.stringify({ error: 'Эта ссылка была деактивирована' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Срок действия ссылки истёк' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meeting_transcripts')
      .select('id, room_id, room_name, started_at, ended_at, transcript, summary, key_points, participants')
      .eq('id', link.meeting_id)
      .maybeSingle();

    if (meetingError || !meeting) {
      console.error('Error fetching meeting:', meetingError);
      return new Response(
        JSON.stringify({ error: 'Созвон не найден' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ meeting }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
