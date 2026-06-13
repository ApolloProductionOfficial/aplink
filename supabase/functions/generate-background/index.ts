import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme } = await req.json();
    
    if (!theme) {
      return new Response(
        JSON.stringify({ error: 'No theme provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
    if (!FAL_API_KEY) {
      throw new Error("FAL_API_KEY is not configured");
    }

    const prompts: Record<string, string> = {
      space: "A mesmerizing cosmic scene with swirling galaxies, colorful nebulae, and countless stars scattered across deep space. Dark purple and blue tones with soft ethereal glowing clouds of cosmic dust. Perfect as a professional video call background. Ultra high resolution, 16:9 aspect ratio, cinematic quality.",
      
      office: "A modern minimalist office interior with clean white walls, elegant wooden desk partially visible, green indoor plants, large windows with natural soft daylight streaming in. Slightly blurred background depth effect. Professional, calm, sophisticated atmosphere. Ultra high resolution, 16:9 aspect ratio.",
      
      nature: "A serene forest scene with majestic tall trees, golden sunlight rays filtering through lush green leaves creating a magical atmosphere. Soft morning mist between the trees. Peaceful and calming natural environment. Ultra high resolution, 16:9 aspect ratio, photorealistic.",
      
      beach: "A stunning tropical paradise beach with crystal clear turquoise water, pristine white sand, swaying palm trees gently moving in the breeze. Bright sunny day with a beautiful blue sky and fluffy white clouds. Relaxing vacation atmosphere. Ultra high resolution, 16:9 aspect ratio.",
    };

    const prompt = prompts[theme];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Invalid theme' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating ${theme} background via Fal.ai...`);

    let imageUrl: string | null = null;

    try {
      // Fal.ai image generation (flux/schnell — fast, cheap, 16:9 landscape backgrounds).
      // NOTE: as of 2026-06-13 the Fal.ai account balance is exhausted (HTTP 403
      // "User is locked. Exhausted balance"), so this call will fail and we fall back
      // to the curated Unsplash backgrounds below. Top up at fal.ai/dashboard/billing
      // to re-enable AI generation. Valid alternative slugs: fal-ai/nano-banana,
      // fal-ai/bytedance/seedream/v4/text-to-image.
      const submitResponse = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          image_size: "landscape_16_9",
          num_images: 1,
          enable_safety_checker: false,
        }),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        console.error("Fal.ai image generation error:", submitResponse.status, errorText);
        throw new Error(`Fal.ai error: ${submitResponse.status}`);
      }

      const submitData = await submitResponse.json();

      // Sync response: images returned directly
      if (submitData.images && submitData.images.length > 0) {
        imageUrl = submitData.images[0].url;
      } else if (submitData.status_url || submitData.response_url) {
        // Queued: poll for the result (max ~25s)
        const statusUrl = submitData.status_url;
        const responseUrl = submitData.response_url;
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const statusResp = await fetch(statusUrl, {
            headers: { Authorization: `Key ${FAL_API_KEY}` },
          });
          const statusData = await statusResp.json();
          if (statusData.status === "COMPLETED") {
            const resultResp = await fetch(responseUrl, {
              headers: { Authorization: `Key ${FAL_API_KEY}` },
            });
            const resultData = await resultResp.json();
            if (resultData.images && resultData.images.length > 0) {
              imageUrl = resultData.images[0].url;
            }
            break;
          }
          if (statusData.status === "FAILED") {
            console.error("Fal.ai generation failed:", JSON.stringify(statusData));
            break;
          }
        }
      }
    } catch (genError) {
      console.error("Fal.ai generation exception:", genError);
    }

    if (!imageUrl) {
      console.error("No image URL produced by Fal.ai, falling back to Unsplash");
      
      // Fallback to high-quality Unsplash images
      const fallbackUrls: Record<string, string> = {
        space: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&h=1080&fit=crop&q=90",
        office: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop&q=90",
        nature: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop&q=90",
        beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop&q=90",
      };
      
      imageUrl = fallbackUrls[theme];
    }

    return new Response(
      JSON.stringify({ imageUrl, theme, generated: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Generate background error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
