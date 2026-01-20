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
    console.log('Starting cleanup of expired links and stale data...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const now = new Date().toISOString();
    const results: Record<string, number> = {};
    
    // 1. Деактивация просроченных shared_meeting_links
    const { data: expiredLinks, error: linksError } = await supabase
      .from('shared_meeting_links')
      .update({ is_active: false })
      .lt('expires_at', now)
      .eq('is_active', true)
      .select('id');
    
    if (linksError) {
      console.error('Error deactivating expired links:', linksError);
    } else {
      results.deactivated_links = expiredLinks?.length || 0;
      console.log(`Deactivated ${results.deactivated_links} expired shared links`);
    }
    
    // 2. Обновление статусов истекших call_requests
    const { data: expiredCalls, error: callsError } = await supabase
      .from('call_requests')
      .update({ status: 'expired' })
      .lt('expires_at', now)
      .eq('status', 'pending')
      .select('id');
    
    if (callsError) {
      console.error('Error updating expired call requests:', callsError);
    } else {
      results.expired_calls = expiredCalls?.length || 0;
      console.log(`Marked ${results.expired_calls} call requests as expired`);
    }
    
    // 3. Обновление статусов пропущенных scheduled_calls
    const { data: missedCalls, error: scheduledError } = await supabase
      .from('scheduled_calls')
      .update({ status: 'missed' })
      .lt('scheduled_at', now)
      .eq('status', 'pending')
      .select('id');
    
    if (scheduledError) {
      console.error('Error updating missed scheduled calls:', scheduledError);
    } else {
      results.missed_scheduled = missedCalls?.length || 0;
      console.log(`Marked ${results.missed_scheduled} scheduled calls as missed`);
    }
    
    // 4. Очистка старых error_logs (старше 30 дней)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: oldErrors, error: errorsError } = await supabase
      .from('error_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .select('id');
    
    if (errorsError) {
      console.error('Error cleaning old error logs:', errorsError);
    } else {
      results.deleted_errors = oldErrors?.length || 0;
      console.log(`Deleted ${results.deleted_errors} old error logs`);
    }
    
    // 5. Вызов существующих cleanup функций
    const { data: backupsCleared } = await supabase.rpc('cleanup_expired_backups');
    results.expired_backups = backupsCleared || 0;
    
    const { data: translationsCleared } = await supabase.rpc('cleanup_old_translation_history');
    results.old_translations = translationsCleared || 0;
    
    // 6. Обновление user_presence для offline пользователей (не активны > 5 мин)
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
    
    const { data: stalePresence, error: presenceError } = await supabase
      .from('user_presence')
      .update({ is_online: false, current_room: null })
      .lt('last_seen', fiveMinutesAgo.toISOString())
      .eq('is_online', true)
      .select('id');
    
    if (presenceError) {
      console.error('Error updating stale presence:', presenceError);
    } else {
      results.stale_presence = stalePresence?.length || 0;
      console.log(`Updated ${results.stale_presence} stale presence records`);
    }
    
    const totalCleaned = Object.values(results).reduce((a, b) => a + b, 0);
    console.log(`Cleanup complete. Total records processed: ${totalCleaned}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        total_processed: totalCleaned,
        timestamp: now
      }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
