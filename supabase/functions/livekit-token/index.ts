import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LiveKit token generation using JWT
async function createToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  participantName: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  // Create JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  // Calculate expiration (24 hours from now)
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 86400;
  
  // Create JWT payload with LiveKit claims
  const payload = {
    iss: apiKey,
    sub: participantIdentity,
    nbf: now,
    exp: exp,
    name: participantName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ['camera', 'microphone', 'screen_share', 'screen_share_audio'],
      canUpdateOwnMetadata: true,
    },
    metadata: JSON.stringify({
      name: participantName,
      identity: participantIdentity
    })
  };
  
  // Base64URL encode helper
  const base64UrlEncode = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const base64UrlEncodeString = (str: string): string => {
    return base64UrlEncode(encoder.encode(str));
  };
  
  // Encode header and payload
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  
  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureInput)
  );
  
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  
  return `${signatureInput}.${encodedSignature}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomName, participantName, participantIdentity } = await req.json();
    
    console.log(`[livekit-token] Generating token for room: ${roomName}, participant: ${participantName}`);
    
    if (!roomName || !participantName) {
      console.error('[livekit-token] Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'roomName and participantName are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    
    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error('[livekit-token] Missing LiveKit configuration');
      return new Response(
        JSON.stringify({ error: 'LiveKit configuration missing' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Generate identity if not provided
    const identity = participantIdentity || `user-${crypto.randomUUID().slice(0, 8)}`;
    
    // Create access token
    const token = await createToken(
      apiKey,
      apiSecret,
      roomName,
      identity,
      participantName
    );
    
    console.log(`[livekit-token] Token generated successfully for ${participantName} in room ${roomName}`);
    
    return new Response(
      JSON.stringify({ 
        token,
        url: livekitUrl,
        room: roomName,
        identity
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('[livekit-token] Error generating token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to generate token', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
