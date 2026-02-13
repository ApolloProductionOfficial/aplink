import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { roomName, participantIdentity } = await req.json();
    
    if (!roomName || !participantIdentity) {
      return new Response(JSON.stringify({ error: 'Missing roomName or participantIdentity' }), { 
        status: 400, headers: corsHeaders 
      });
    }

    const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') || 'https://call.aplink.live';
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!;
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!;

    // Create JWT for LiveKit API authentication
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(JSON.stringify({
      iss: LIVEKIT_API_KEY,
      exp: now + 60,
      nbf: now,
      sub: '',
      video: {
        roomAdmin: true,
        room: roomName,
      },
    }));

    // HMAC-SHA256 signing
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(LIVEKIT_API_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`));
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    const jwt = `${header}.${payload}.${sig}`;

    // Call LiveKit API to remove participant
    const livekitApiUrl = LIVEKIT_URL.replace('wss://', 'https://');
    const response = await fetch(`${livekitApiUrl}/twirp/livekit.RoomService/RemoveParticipant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        room: roomName,
        identity: participantIdentity,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiveKit RemoveParticipant failed:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to kick participant', details: errorText }), {
        status: response.status, headers: corsHeaders,
      });
    }

    console.log(`Participant ${participantIdentity} kicked from room ${roomName}`);
    
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (error: any) {
    console.error('kick-participant error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
