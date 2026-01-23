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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    console.log(`Generating ${theme} background...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { 
            role: "user", 
            content: prompt 
          }
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI image generation error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Image generation response received");

    // Extract image URL from response
    const message = data.choices?.[0]?.message;
    let imageUrl: string | null = null;

    // Check for inline_data in parts (Gemini format)
    if (message?.content && Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'image' && part.image_url?.url) {
          imageUrl = part.image_url.url;
          break;
        }
        if (part.inline_data?.data && part.inline_data?.mime_type) {
          imageUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          break;
        }
      }
    }

    // Check for images array
    if (!imageUrl && message?.images && Array.isArray(message.images)) {
      const firstImage = message.images[0];
      if (firstImage?.image_url?.url) {
        imageUrl = firstImage.image_url.url;
      } else if (firstImage?.url) {
        imageUrl = firstImage.url;
      }
    }

    if (!imageUrl) {
      console.error("No image URL found in response:", JSON.stringify(data, null, 2));
      
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
