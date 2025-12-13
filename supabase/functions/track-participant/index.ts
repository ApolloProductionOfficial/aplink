import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, userName, action } = await req.json();
    
    // Get client IP from headers
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
    
    console.log('Tracking participant:', { roomId, userName, action, ip });
    
    // Get geolocation from IP
    let geoData = { city: 'Unknown', country: 'Unknown', countryCode: '', region: '' };
    
    if (ip && ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        // Using ip-api.com (free, no API key required)
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,city`);
        const geo = await geoResponse.json();
        
        if (geo.status === 'success') {
          geoData = {
            city: geo.city || 'Unknown',
            country: geo.country || 'Unknown',
            countryCode: geo.countryCode || '',
            region: geo.region || ''
          };
        }
        console.log('Geolocation result:', geoData);
      } catch (geoError) {
        console.error('Geolocation error:', geoError);
      }
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (action === 'join') {
      // Insert new participant record
      const { data, error } = await supabase
        .from('meeting_participants')
        .insert({
          room_id: roomId,
          user_name: userName,
          ip_address: ip,
          city: geoData.city,
          country: geoData.country,
          country_code: geoData.countryCode,
          region: geoData.region
        })
        .select()
        .single();
      
      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      console.log('Participant joined:', data);
      
      return new Response(JSON.stringify({ success: true, participant: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'leave') {
      // Update left_at timestamp
      const { error } = await supabase
        .from('meeting_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_name', userName)
        .is('left_at', null)
        .order('joined_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Update error:', error);
        throw error;
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
