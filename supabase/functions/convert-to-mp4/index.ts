import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    // Expect multipart form data with the webm file
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[convert-to-mp4] Received file: ${file.name}, size: ${file.size} bytes`);

    // Read file as array buffer
    const webmBuffer = await file.arrayBuffer();
    const webmBytes = new Uint8Array(webmBuffer);

    // Use CloudConvert API for conversion
    // First, check if API key is available
    const cloudConvertApiKey = Deno.env.get('CLOUDCONVERT_API_KEY');
    
    if (!cloudConvertApiKey) {
      // Fallback: return a message that server-side conversion is not configured
      // Client will need to use the WebM file directly
      console.log('[convert-to-mp4] CloudConvert API key not configured, returning guidance');
      
      return new Response(
        JSON.stringify({ 
          error: 'MP4 conversion not configured',
          message: 'Server-side MP4 conversion requires CloudConvert API key. WebM format is recommended.',
          fallback: 'webm'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create CloudConvert job
    console.log('[convert-to-mp4] Starting CloudConvert conversion...');
    
    // Step 1: Create import/upload task
    const createJobResponse = await fetch('https://api.cloudconvert.com/v2/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudConvertApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: {
          'import-file': {
            operation: 'import/upload',
          },
          'convert-file': {
            operation: 'convert',
            input: 'import-file',
            output_format: 'mp4',
            video_codec: 'h264',
            audio_codec: 'aac',
            crf: 23, // Good quality/size balance
          },
          'export-file': {
            operation: 'export/url',
            input: 'convert-file',
          },
        },
      }),
    });

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text();
      console.error('[convert-to-mp4] Failed to create CloudConvert job:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to start conversion', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jobData = await createJobResponse.json();
    const jobId = jobData.data.id;
    const uploadTask = jobData.data.tasks.find((t: any) => t.name === 'import-file');
    
    if (!uploadTask?.result?.form) {
      console.error('[convert-to-mp4] No upload form in response');
      return new Response(
        JSON.stringify({ error: 'Invalid CloudConvert response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Upload the file
    const uploadForm = new FormData();
    Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
      uploadForm.append(key, value as string);
    });
    uploadForm.append('file', new Blob([webmBytes], { type: 'video/webm' }), 'recording.webm');

    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: 'POST',
      body: uploadForm,
    });

    if (!uploadResponse.ok) {
      console.error('[convert-to-mp4] Failed to upload file to CloudConvert');
      return new Response(
        JSON.stringify({ error: 'Failed to upload file for conversion' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[convert-to-mp4] File uploaded, waiting for conversion...');

    // Step 3: Poll for completion (with timeout)
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();
    
    let exportUrl: string | null = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${cloudConvertApiKey}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('[convert-to-mp4] Failed to check job status');
        break;
      }

      const statusData = await statusResponse.json();
      const job = statusData.data;

      if (job.status === 'finished') {
        const exportTask = job.tasks.find((t: any) => t.name === 'export-file');
        if (exportTask?.result?.files?.[0]?.url) {
          exportUrl = exportTask.result.files[0].url;
          console.log('[convert-to-mp4] Conversion complete!');
          break;
        }
      } else if (job.status === 'error') {
        console.error('[convert-to-mp4] Conversion failed:', job);
        return new Response(
          JSON.stringify({ error: 'Conversion failed', details: job.tasks?.find((t: any) => t.status === 'error')?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    if (!exportUrl) {
      return new Response(
        JSON.stringify({ error: 'Conversion timeout' }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Download the converted file
    const mp4Response = await fetch(exportUrl);
    if (!mp4Response.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to download converted file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mp4Buffer = await mp4Response.arrayBuffer();
    
    console.log(`[convert-to-mp4] Returning MP4 file, size: ${mp4Buffer.byteLength} bytes`);

    return new Response(mp4Buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="recording.mp4"',
      },
    });

  } catch (error) {
    console.error('[convert-to-mp4] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
