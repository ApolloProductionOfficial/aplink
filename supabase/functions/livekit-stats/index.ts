import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Generate LiveKit API JWT for server-to-server calls
async function createApiToken(apiKey: string, apiSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  // Server API token with roomList grant
  const payload = {
    iss: apiKey,
    nbf: now,
    exp: now + 3600, // 1 hour
    video: {
      roomList: true,
      roomAdmin: true,
    }
  };
  
  const base64UrlEncode = (data: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const base64UrlEncodeString = (str: string): string => {
    return base64UrlEncode(encoder.encode(str));
  };
  
  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  
  return `${signatureInput}.${encodedSignature}`;
}

interface LiveKitRoom {
  sid: string;
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
  creationTime: string;
  turnPassword: string;
  enabledCodecs: Array<{ mime: string }>;
  metadata: string;
  numParticipants: number;
  numPublishers: number;
  activeRecording: boolean;
}

interface ListRoomsResponse {
  rooms: LiveKitRoom[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    
    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error('[livekit-stats] Missing LiveKit configuration');
      return new Response(
        JSON.stringify({ 
          error: 'LiveKit configuration missing',
          activeRooms: 0,
          totalParticipants: 0,
          totalPublishers: 0,
          activeRecordings: 0,
          rooms: [],
          resources: { estimatedRamMB: 0, estimatedBandwidthMbps: 0, serverCapacity: { maxParticipantsEstimate: 2000, utilizationPercent: 0 } },
          timestamp: new Date().toISOString(),
          status: 'config_missing'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate API token
    const token = await createApiToken(apiKey, apiSecret);
    
    // Convert wss:// to https:// for API calls
    const apiUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    
    console.log(`[livekit-stats] Fetching rooms from ${apiUrl}`);
    
    // Create AbortController for timeout (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // Call LiveKit Twirp API to list rooms
      const response = await fetch(`${apiUrl}/twirp/livekit.RoomService/ListRooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[livekit-stats] LiveKit API error: ${response.status} - ${errorText}`);
        throw new Error(`LiveKit API error: ${response.status}`);
      }
      
      const data: ListRoomsResponse = await response.json();
      const rooms = data.rooms || [];
      
      console.log(`[livekit-stats] Found ${rooms.length} active rooms`);
      
      // Calculate statistics
      const totalParticipants = rooms.reduce((sum, r) => sum + (r.numParticipants || 0), 0);
      const totalPublishers = rooms.reduce((sum, r) => sum + (r.numPublishers || 0), 0);
      const activeRecordings = rooms.filter(r => r.activeRecording).length;
      
      // Estimate resource usage (rough calculation)
      const estimatedRamMB = totalParticipants * 50;
      const estimatedBandwidthMbps = totalPublishers * 1.5;
      
      const currentRoomNames = rooms.map(r => r.name);
      
      // Initialize Supabase client for storing snapshots
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      let newRooms: string[] = [];
      let snapshotSaved = false;
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        try {
          // Get last snapshot to check timing and detect new rooms
          const { data: lastSnapshot } = await supabase
            .from('livekit_stats_history')
            .select('room_names, recorded_at')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();
          
          const timeSinceLastSnapshot = lastSnapshot 
            ? Date.now() - new Date(lastSnapshot.recorded_at).getTime() 
            : Infinity;
          
          // Detect new rooms
          const previousRoomNames = lastSnapshot?.room_names || [];
          newRooms = currentRoomNames.filter(name => !previousRoomNames.includes(name));
          
          if (newRooms.length > 0) {
            console.log(`[livekit-stats] New rooms detected: ${newRooms.join(', ')}`);
          }
          
          // Save snapshot every 5 minutes
          if (timeSinceLastSnapshot > SNAPSHOT_INTERVAL_MS) {
            const { error: insertError } = await supabase
              .from('livekit_stats_history')
              .insert({
                active_rooms: rooms.length,
                total_participants: totalParticipants,
                total_publishers: totalPublishers,
                active_recordings: activeRecordings,
                estimated_ram_mb: estimatedRamMB,
                estimated_bandwidth_mbps: estimatedBandwidthMbps,
                room_names: currentRoomNames
              });
            
            if (insertError) {
              console.error('[livekit-stats] Failed to save snapshot:', insertError);
            } else {
              snapshotSaved = true;
              console.log('[livekit-stats] Snapshot saved to history');
            }
          }
        } catch (dbError) {
          console.warn('[livekit-stats] Database operation failed:', dbError);
        }
      }
      
      const stats = {
        activeRooms: rooms.length,
        totalParticipants,
        totalPublishers,
        activeRecordings,
        rooms: rooms.map(r => ({
          name: r.name,
          sid: r.sid,
          participants: r.numParticipants || 0,
          publishers: r.numPublishers || 0,
          createdAt: r.creationTime ? new Date(parseInt(r.creationTime) * 1000).toISOString() : null,
          recording: r.activeRecording || false,
        })),
        resources: {
          estimatedRamMB,
          estimatedBandwidthMbps,
          serverCapacity: {
            maxParticipantsEstimate: 2000,
            utilizationPercent: Math.round((estimatedRamMB / (128 * 1024)) * 100 * 10) / 10,
          }
        },
        newRooms: newRooms.length > 0 ? newRooms : undefined,
        snapshotSaved,
        timestamp: new Date().toISOString(),
        status: 'connected'
      };
      
      return new Response(
        JSON.stringify(stats),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Return fallback data when LiveKit server is unreachable
      console.warn('[livekit-stats] LiveKit server unreachable, returning fallback data:', fetchError);
      
      const fallbackStats = {
        activeRooms: 0,
        totalParticipants: 0,
        totalPublishers: 0,
        activeRecordings: 0,
        rooms: [],
        resources: {
          estimatedRamMB: 0,
          estimatedBandwidthMbps: 0,
          serverCapacity: {
            maxParticipantsEstimate: 2000,
            utilizationPercent: 0,
          }
        },
        timestamp: new Date().toISOString(),
        status: 'server_unreachable',
        error: 'LiveKit сервер недоступен из Supabase. Проверьте Caddy конфигурацию и firewall.',
        hint: 'Добавьте в Caddyfile: reverse_proxy /twirp/* localhost:7880'
      };
      
      return new Response(
        JSON.stringify(fallbackStats),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('[livekit-stats] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch stats', 
        details: message,
        status: 'error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
