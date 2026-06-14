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
    const { roomId, roomName, transcript, participants, userId, durationSeconds, recordingUrl, provider, model } = await req.json();
    
    console.log('Summarizing meeting:', { roomId, roomName, transcriptLength: transcript?.length, userId, durationSeconds, provider, model });
    
    // AI provider selection. PRIMARY = Venice (uncensored); on any Venice
    // error fall back to Groq (free, OpenAI-compatible). OpenRouter only when
    // explicitly requested with a key. Lovable retired.
    const veniceKey =
      Deno.env.get('VENICE_API_KEY') || Deno.env.get('VENICE_INFERENCE_KEY');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');

    const chatMessages = [
      {
        role: 'system',
        content: `You are a meeting summarizer. Analyze the transcript and provide:
1. A brief summary (2-3 sentences)
2. Key points discussed (bullet points)
3. Action items if any
4. Decisions made if any

Format your response as JSON with this structure:
{
  "summary": "Brief summary here",
  "keyPoints": ["Point 1", "Point 2"],
  "actionItems": ["Action 1", "Action 2"],
  "decisions": ["Decision 1", "Decision 2"]
}

If the transcript is empty or unclear, provide a generic response indicating no content was captured.
Respond in the same language as the transcript. If unsure, use Russian.`
      },
      {
        role: 'user',
        content: `Meeting: ${roomName}\nParticipants: ${participants?.join(', ') || 'Unknown'}\n\nTranscript:\n${transcript || 'No transcript available'}`
      }
    ];

    type Attempt = { name: string; url: string; key: string; model: string; extraHeaders?: Record<string, string> };
    const chain: Attempt[] = [];
    if (veniceKey) {
      chain.push({ name: 'venice', url: 'https://api.venice.ai/api/v1/chat/completions', key: veniceKey, model: 'venice-uncensored' });
    }
    if (groqKey) {
      chain.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'llama-3.3-70b-versatile' });
    }
    if (provider === 'openrouter' && openrouterKey) {
      chain.push({
        name: 'openrouter',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        key: openrouterKey,
        model: model && model.includes('/') ? model : 'openai/gpt-4o-mini',
        extraHeaders: { 'HTTP-Referer': 'https://aplink.lovable.app', 'X-Title': 'APLink by Apollo Production' },
      });
    }
    if (chain.length === 0) {
      throw new Error('No AI provider configured (need VENICE_API_KEY or GROQ_API_KEY)');
    }

    let content = '';
    let aiOk = false;
    let lastStatus = 500;
    let lastErr = '';
    for (const attempt of chain) {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${attempt.key}`,
          'Content-Type': 'application/json',
          ...(attempt.extraHeaders || {}),
        };
        console.log(`[summarize-meeting] try provider=${attempt.name} model=${attempt.model}`);
        const aiResponse = await fetch(attempt.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: attempt.model, messages: chatMessages }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          content = aiData.choices?.[0]?.message?.content || '';
          aiOk = true;
          console.log(`[summarize-meeting] ok provider=${attempt.name}`);
          break;
        }
        lastStatus = aiResponse.status;
        lastErr = await aiResponse.text();
        console.error(`[summarize-meeting] provider=${attempt.name} failed`, aiResponse.status, lastErr.slice(0, 300));
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`[summarize-meeting] provider=${attempt.name} threw`, lastErr);
      }
    }

    if (!aiOk) {
      throw new Error(`AI API error: ${lastStatus} ${lastErr.slice(0, 200)}`);
    }
    
    // Parse AI response
    let parsedContent;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        parsedContent = { summary: content, keyPoints: [], actionItems: [], decisions: [] };
      }
    } catch (e) {
      console.error('Parse error:', e);
      parsedContent = { summary: content, keyPoints: [], actionItems: [], decisions: [] };
    }
    
    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // APLink tables live in the `aplink` schema, not `public`.
    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'aplink' } });

    const { data, error } = await supabase
      .from('meeting_transcripts')
      .insert({
        room_id: roomId,
        room_name: roomName,
        transcript: transcript,
        summary: parsedContent.summary,
        key_points: parsedContent,
        participants: participants,
        ended_at: new Date().toISOString(),
        owner_user_id: userId || null,
        duration_seconds: durationSeconds || null,
        recording_url: recordingUrl || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    
    console.log('Meeting saved:', data.id);
    
    return new Response(JSON.stringify({ success: true, meeting: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    console.error('Error:', error);
    // PostgREST/Supabase errors are plain objects with .message/.code, not Error instances.
    const message =
      error instanceof Error
        ? error.message
        : (error as any)?.message || (error as any)?.code || JSON.stringify(error) || 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
