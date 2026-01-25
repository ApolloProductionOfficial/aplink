import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Cleanup] Starting voice messages cleanup...');

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // List all files in voice-messages bucket
    const { data: files, error: listError } = await supabase.storage
      .from('voice-messages')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('[Cleanup] Error listing files:', listError);
      throw listError;
    }

    if (!files || files.length === 0) {
      console.log('[Cleanup] No files found in bucket');
      return new Response(
        JSON.stringify({ success: true, deletedCount: 0, message: 'No files to clean up' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter files older than 24 hours
    const oldFiles = files.filter(file => {
      if (!file.created_at) return false;
      const fileDate = new Date(file.created_at);
      return fileDate < twentyFourHoursAgo;
    });

    console.log(`[Cleanup] Found ${files.length} total files, ${oldFiles.length} older than 24 hours`);

    if (oldFiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deletedCount: 0, message: 'No old files to delete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete old files in batches of 100
    const filePaths = oldFiles.map(f => f.name);
    let deletedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase.storage
        .from('voice-messages')
        .remove(batch);

      if (deleteError) {
        console.error(`[Cleanup] Error deleting batch ${i / batchSize + 1}:`, deleteError);
        // Continue with next batch even if one fails
      } else {
        deletedCount += batch.length;
        console.log(`[Cleanup] Deleted batch ${i / batchSize + 1}: ${batch.length} files`);
      }
    }

    console.log(`[Cleanup] Cleanup complete. Deleted ${deletedCount} files`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount,
        totalFiles: files.length,
        message: `Deleted ${deletedCount} voice messages older than 24 hours`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cleanup] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
