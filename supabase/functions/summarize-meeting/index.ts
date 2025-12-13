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
    const { roomId, roomName, transcript, participants } = await req.json();
    
    console.log('Summarizing meeting:', { roomId, roomName, transcriptLength: transcript?.length });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    
    // Generate summary using Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
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
        ],
      }),
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }
    
    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);
    
    // Parse AI response
    let parsedContent;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        parsedContent = {
          summary: content,
          keyPoints: [],
          actionItems: [],
          decisions: []
        };
      }
    } catch (e) {
      console.error('Parse error:', e);
      parsedContent = {
        summary: content,
        keyPoints: [],
        actionItems: [],
        decisions: []
      };
    }
    
    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .from('meeting_transcripts')
      .insert({
        room_id: roomId,
        room_name: roomName,
        transcript: transcript,
        summary: parsedContent.summary,
        key_points: parsedContent,
        participants: participants,
        ended_at: new Date().toISOString()
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
