import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  prompt: string;
  model?: 'gemini' | 'nano-banana' | 'nana-banana' | 'seedream' | 'flux';  // 'gemini' = легаси-алиас → Fal nano-banana (старая внешняя ветка удалена)
  aspect_ratio?: string;
  save_to_storage?: boolean;
  num_images?: number; // 1-4 images at once
}

// ─────────────────────────────────────────────────────────────────────────────
// Higgsfield platform API (PRIMARY) — submit + poll, как у Fal (queued → status).
// Base https://platform.higgsfield.ai, auth `Authorization: Key KEY_ID:KEY_SECRET`.
// POST /{model_id} → {status:"queued", request_id, status_url}. Poll
// GET /requests/{id}/status → status queued|in_progress|completed|failed|nsfw,
// при completed → {images:[{url}]}. Возвращает массив внешних URL картинок (или null при ошибке).
// ─────────────────────────────────────────────────────────────────────────────
const HIGGSFIELD_MODELS: Record<string, string> = {
  // Маппинг наших model-имён → higgsfield model_id. Soul = флагман (тренированная Mia),
  // seedream/reve = альтернатива. Неизвестное имя → soul.
  'soul': 'higgsfield-ai/soul/standard',
  'gemini': 'higgsfield-ai/soul/standard',
  'nano-banana': 'higgsfield-ai/soul/standard',
  'nana-banana': 'higgsfield-ai/soul/standard',
  'flux': 'higgsfield-ai/soul/standard',
  'seedream': 'reve/text-to-image',
};

async function generateWithHiggsfield(
  prompt: string,
  model: string,
  aspectRatio: string,
  numImages: number,
): Promise<string[] | null> {
  const keyId = Deno.env.get('HIGGSFIELD_KEY_ID');
  const keySecret = Deno.env.get('HIGGSFIELD_KEY_SECRET');
  if (!keyId || !keySecret) {
    console.log('Higgsfield keys not configured — skipping to Fal fallback');
    return null;
  }

  const modelId = HIGGSFIELD_MODELS[model] || HIGGSFIELD_MODELS['soul'];
  const authHeader = `Key ${keyId}:${keySecret}`;
  const base = 'https://platform.higgsfield.ai';

  try {
    // Higgsfield принимает одну картинку за запрос → шлём numImages параллельных задач.
    const jobs = Array.from({ length: Math.min(Math.max(numImages, 1), 4) }, async () => {
      const submit = await fetch(`${base}/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio || '1:1',
          resolution: '1080p',
        }),
      });

      if (!submit.ok) {
        const t = await submit.text();
        console.error('Higgsfield submit error:', submit.status, t);
        throw new Error(`higgsfield_submit_${submit.status}`);
      }

      const submitData = await submit.json();

      // Иногда completed синхронно
      if (submitData.status === 'completed' && submitData.images?.length > 0) {
        return submitData.images[0].url as string;
      }

      const requestId = submitData.request_id;
      const statusUrl = submitData.status_url || `${base}/requests/${requestId}/status`;
      if (!requestId && !submitData.status_url) {
        throw new Error('higgsfield_no_request_id');
      }

      // Poll до 30 попыток × 2s = 60s
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusResp = await fetch(statusUrl, {
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
        });
        if (!statusResp.ok) {
          console.error('Higgsfield status check failed:', statusResp.status);
          continue;
        }
        const statusData = await statusResp.json();
        if (statusData.status === 'completed') {
          if (statusData.images?.length > 0) return statusData.images[0].url as string;
          throw new Error('higgsfield_completed_no_image');
        }
        if (statusData.status === 'failed' || statusData.status === 'nsfw') {
          throw new Error(`higgsfield_${statusData.status}`);
        }
        // queued | in_progress → продолжаем
      }
      throw new Error('higgsfield_timeout');
    });

    const urls = await Promise.all(jobs);
    const valid = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
    return valid.length > 0 ? valid : null;
  } catch (err) {
    console.error('Higgsfield generation failed, falling back to Fal:', err);
    return null;
  }
}

// Helper to upload base64 image to Supabase storage
async function uploadToStorage(
  imageData: string, 
  model: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Extract base64 data
    let base64Data = imageData;
    let mimeType = 'image/png';
    
    if (imageData.startsWith('data:')) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filename = `${model}/${timestamp}-${randomId}.${ext}`;
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('apollo-images')
      .upload(filename, bytes, {
        contentType: mimeType,
        cacheControl: '86400', // 24 hours
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('apollo-images')
      .getPublicUrl(filename);
    
    console.log('Uploaded to storage:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Upload to storage failed:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, model = 'nano-banana', aspect_ratio = '1:1', save_to_storage = true, num_images = 1 }: GenerateRequest = await req.json();
    const imageCount = Math.min(Math.max(num_images, 1), 4); // Clamp to 1-4

    if (!prompt) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Пожалуйста, введите описание изображения',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating ${imageCount} image(s) with model: ${model}, prompt: ${prompt.slice(0, 100)}...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Общий хелпер: скачать внешний URL → залить в Supabase storage → вернуть public URL.
    // Используется и Higgsfield-, и Fal-ветками.
    const downloadAndUpload = async (externalUrl: string): Promise<string> => {
      if (!save_to_storage) return externalUrl;
      try {
        const imgResponse = await fetch(externalUrl);
        if (!imgResponse.ok) return externalUrl;
        const arrayBuffer = await imgResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const timestamp = Date.now();
        const randomId = crypto.randomUUID().slice(0, 8);
        const filename = `${model}/${timestamp}-${randomId}.png`;
        const { error } = await supabase.storage
          .from('apollo-images')
          .upload(filename, bytes, { contentType: 'image/png', cacheControl: '86400', upsert: false });
        if (error) {
          console.error('Storage upload error:', error);
          return externalUrl;
        }
        const { data: urlData } = supabase.storage.from('apollo-images').getPublicUrl(filename);
        console.log('Uploaded image to storage:', urlData.publicUrl);
        return urlData.publicUrl;
      } catch (err) {
        console.error('Download and upload failed:', err);
        return externalUrl;
      }
    };

    // ── PRIMARY: Higgsfield platform API ──────────────────────────────────────
    // Пробуем сначала Higgsfield (Soul/Seedream). При любой ошибке (нет ключей,
    // not_enough_credits, timeout, nsfw) — null → падаем в Fal.ai fallback ниже.
    const higgsfieldUrls = await generateWithHiggsfield(prompt, model, aspect_ratio, imageCount);
    if (higgsfieldUrls && higgsfieldUrls.length > 0) {
      const uploaded = await Promise.all(higgsfieldUrls.map((u) => downloadAndUpload(u)));
      console.log(`Higgsfield produced ${uploaded.length} image(s)`);
      return new Response(JSON.stringify({
        success: true,
        image_url: uploaded[0],
        image_urls: uploaded,
        model,
        provider: 'higgsfield',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Higgsfield unavailable → falling back to Fal.ai');

    // ── FALLBACK: Fal.ai (nana-banana, seedream) — requires FAL_API_KEY ────────
    const FAL_API_KEY = Deno.env.get('FAL_API_KEY');

    if (!FAL_API_KEY) {
      console.error('FAL_API_KEY not found in environment');
      return new Response(JSON.stringify({
        success: false,
        error: 'Генерация изображений временно недоступна. Обратитесь к @Apollo_Production в Telegram.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('FAL_API_KEY found, length:', FAL_API_KEY.length);

    const modelEndpoints: Record<string, string> = {
      'gemini': 'fal-ai/nano-banana',                                  // легаси-алиас (старая ветка удалена)
      'nano-banana': 'fal-ai/nano-banana',
      'nana-banana': 'fal-ai/nano-banana',                             // старое написание-алиас
      'seedream': 'fal-ai/bytedance/seedream/v4/text-to-image',
      'flux': 'fal-ai/flux/schnell',
    };

    const endpoint = modelEndpoints[model] || modelEndpoints['nano-banana'];
    const apiUrl = `https://queue.fal.run/${endpoint}`;

    console.log(`Using Fal.ai endpoint: ${endpoint}`);

    const submitResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: aspect_ratio === '1:1' ? 'square_hd' :
                    aspect_ratio === '16:9' ? 'landscape_16_9' :
                    aspect_ratio === '9:16' ? 'portrait_16_9' : 'square_hd',
        num_images: imageCount, // Generate multiple images at once
        enable_safety_checker: false,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      console.error('Fal.ai submit error:', submitResponse.status, errorText);
      
      if (submitResponse.status === 403 || submitResponse.status === 401) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Ошибка авторизации Fal.ai. API ключ недействителен. Обратитесь к @Apollo_Production в Telegram.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (submitResponse.status === 404) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Модель не найдена. Обратитесь к @Apollo_Production в Telegram.',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Ошибка генерации. Обратитесь к @Apollo_Production в Telegram.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const submitData = await submitResponse.json();
    console.log('Submit response:', JSON.stringify(submitData));

    // (downloadAndUpload объявлен выше — общий для Higgsfield и Fal)

    // If we got images directly (sync response)
    if (submitData.images && submitData.images.length > 0) {
      // Upload all images in parallel
      const uploadPromises = submitData.images.map((img: { url: string }) => downloadAndUpload(img.url));
      const uploadedUrls = await Promise.all(uploadPromises);
      
      return new Response(JSON.stringify({
        success: true,
        image_url: uploadedUrls[0], // For backwards compatibility
        image_urls: uploadedUrls, // Array of all generated images
        model,
        provider: 'fal',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If queued, poll for result
    const requestId = submitData.request_id;
    if (!requestId) {
      throw new Error('No request_id or images in response');
    }

    const statusUrl = `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/${endpoint}/requests/${requestId}`;

    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
        },
      });

      if (!statusResponse.ok) {
        console.error('Status check failed:', await statusResponse.text());
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`Attempt ${attempts}, status:`, statusData.status);

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(resultUrl, {
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
          },
        });

        if (resultResponse.ok) {
          const resultData = await resultResponse.json();
          if (resultData.images && resultData.images.length > 0) {
            // Upload all images in parallel
            const uploadPromises = resultData.images.map((img: { url: string }) => downloadAndUpload(img.url));
            const uploadedUrls = await Promise.all(uploadPromises);
            
            return new Response(JSON.stringify({
              success: true,
              image_url: uploadedUrls[0], // For backwards compatibility
              image_urls: uploadedUrls, // Array of all generated images
              model,
              provider: 'fal',
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        break;
      } else if (statusData.status === 'FAILED') {
        break;
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Не удалось сгенерировать изображение. Попробуйте позже или обратитесь к @Apollo_Production в Telegram.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate image error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Произошла ошибка. Попробуйте позже или обратитесь к @Apollo_Production в Telegram.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});