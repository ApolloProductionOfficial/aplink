import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HistoryPoint {
  hour: string;
  rooms: number;
  participants: number;
  publishers: number;
  ram: number;
  bandwidth: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get data for last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('livekit_stats_history')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('[livekit-history] Query error:', error);
      throw error;
    }

    // Group by hour
    const hourlyMap = new Map<string, {
      rooms: number[];
      participants: number[];
      publishers: number[];
      ram: number[];
      bandwidth: number[];
    }>();

    for (const record of data || []) {
      const date = new Date(record.recorded_at);
      const hourKey = `${date.getHours().toString().padStart(2, '0')}:00`;
      
      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, {
          rooms: [],
          participants: [],
          publishers: [],
          ram: [],
          bandwidth: []
        });
      }
      
      const bucket = hourlyMap.get(hourKey)!;
      bucket.rooms.push(record.active_rooms);
      bucket.participants.push(record.total_participants);
      bucket.publishers.push(record.total_publishers);
      bucket.ram.push(record.estimated_ram_mb);
      bucket.bandwidth.push(parseFloat(record.estimated_bandwidth_mbps) || 0);
    }

    // Calculate averages for each hour
    const history: HistoryPoint[] = [];
    
    // Generate all 24 hours
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const targetHour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = `${targetHour.getHours().toString().padStart(2, '0')}:00`;
      
      const bucket = hourlyMap.get(hourKey);
      
      if (bucket && bucket.rooms.length > 0) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        history.push({
          hour: hourKey,
          rooms: Math.round(avg(bucket.rooms)),
          participants: Math.round(avg(bucket.participants)),
          publishers: Math.round(avg(bucket.publishers)),
          ram: Math.round(avg(bucket.ram)),
          bandwidth: Math.round(avg(bucket.bandwidth) * 10) / 10
        });
      } else {
        history.push({
          hour: hourKey,
          rooms: 0,
          participants: 0,
          publishers: 0,
          ram: 0,
          bandwidth: 0
        });
      }
    }

    console.log(`[livekit-history] Returning ${history.length} hourly data points`);

    return new Response(
      JSON.stringify({ history, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[livekit-history] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch history',
        history: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
