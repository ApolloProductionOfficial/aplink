import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  source: string | null;
  severity: string;
  details: Record<string, unknown> | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent errors for analysis
    const { data: recentErrors, error: fetchError } = await supabase
      .from("error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch errors: ${fetchError.message}`);
    }

    if (!recentErrors || recentErrors.length === 0) {
      return new Response(
        JSON.stringify({
          analysis: "✅ Отлично! В системе нет ошибок для анализа.",
          recommendations: [],
          summary: { total: 0, patterns: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group errors by type and source
    const errorGroups = new Map<string, ErrorLog[]>();
    recentErrors.forEach((err: ErrorLog) => {
      const key = `${err.error_type}::${err.source || 'unknown'}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(err);
    });

    // Prepare error summary for AI
    const errorSummary = Array.from(errorGroups.entries())
      .map(([key, errors]) => {
        const [type, source] = key.split('::');
        const sample = errors[0];
        return {
          type,
          source,
          count: errors.length,
          message: sample.error_message.substring(0, 200),
          severity: sample.severity,
          lastOccurred: sample.created_at
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Call Lovable AI for analysis
    const prompt = `Ты — эксперт по отладке веб-приложений на React/TypeScript/Supabase. Проанализируй следующие группы ошибок и дай конкретные рекомендации по их устранению.

ОШИБКИ ДЛЯ АНАЛИЗА:
${JSON.stringify(errorSummary, null, 2)}

Дай ответ в следующем формате JSON:
{
  "analysis": "Краткий общий анализ ситуации (2-3 предложения)",
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "errorType": "тип ошибки",
      "problem": "краткое описание проблемы",
      "solution": "конкретное решение с примером кода если нужно",
      "file": "предполагаемый файл где искать проблему (если известно)"
    }
  ],
  "codeExamples": [
    {
      "title": "название примера",
      "code": "пример кода для исправления"
    }
  ]
}

Важно:
- Давай КОНКРЕТНЫЕ решения, не общие советы
- Если ошибка связана с API ключами — укажи какой именно
- Если ошибка в коде — покажи как исправить
- Приоритизируй по критичности`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Ты эксперт по отладке React/TypeScript/Supabase приложений. Отвечай только валидным JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Слишком много запросов. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Требуется пополнение баланса Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response
    let analysisResult;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiText.match(/```json\n?([\s\S]*?)\n?```/) || aiText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiText);
      analysisResult = {
        analysis: aiText.substring(0, 500),
        recommendations: [],
        codeExamples: []
      };
    }

    return new Response(
      JSON.stringify({
        ...analysisResult,
        summary: {
          total: recentErrors.length,
          patterns: errorGroups.size,
          analyzedAt: new Date().toISOString()
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error analysis failed:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
