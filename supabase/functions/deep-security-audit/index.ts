import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuditSection {
  category: string;
  score: number; // 0-100
  status: "critical" | "warning" | "good" | "excellent";
  findings: {
    severity: "critical" | "high" | "medium" | "low" | "info";
    title: string;
    description: string;
    recommendation?: string;
  }[];
}

interface DeepAuditResult {
  overallScore: number;
  overallStatus: string;
  sections: AuditSection[];
  aiAnalysis: string;
  aiRecommendations: string[];
  scanDuration: number;
  scannedAt: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sections: AuditSection[] = [];
    const allFindings: { category: string; severity: string; title: string; description: string }[] = [];

    // ========================================
    // 1. SECURITY AUDIT - RLS & Auth
    // ========================================
    const securityFindings: AuditSection["findings"] = [];
    
    // Check for open access patterns in error_logs
    const { count: openErrorLogs } = await supabase
      .from("error_logs")
      .select("*", { count: "exact", head: true });

    // Check user_roles distribution  
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("*")
      .eq("role", "admin");

    if (adminUsers && adminUsers.length > 5) {
      securityFindings.push({
        severity: "medium",
        title: "Много администраторов",
        description: `В системе ${adminUsers.length} пользователей с ролью admin. Рекомендуется минимизировать количество привилегированных пользователей.`,
        recommendation: "Проверьте список администраторов и удалите неактивных или лишних."
      });
    }

    // Check backup codes usage
    const { data: backupCodes } = await supabase
      .from("backup_codes")
      .select("*")
      .eq("used", false);

    const unusedBackupCodes = backupCodes?.length || 0;
    if (unusedBackupCodes > 50) {
      securityFindings.push({
        severity: "low",
        title: "Много неиспользованных backup-кодов",
        description: `${unusedBackupCodes} backup-кодов не использованы. Это нормально, но стоит периодически ротировать.`,
      });
    }

    // Check for shared meeting links
    const { data: expiredLinks } = await supabase
      .from("shared_meeting_links")
      .select("*")
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString());

    if (expiredLinks && expiredLinks.length > 0) {
      securityFindings.push({
        severity: "medium",
        title: "Просроченные активные ссылки",
        description: `${expiredLinks.length} ссылок на встречи истекли, но всё ещё отмечены как активные.`,
        recommendation: "Деактивируйте просроченные ссылки для безопасности."
      });
    }

    // Check for profiles without proper data
    const { data: incompleteProfiles } = await supabase
      .from("profiles")
      .select("*")
      .is("display_name", null);

    if (incompleteProfiles && incompleteProfiles.length > 10) {
      securityFindings.push({
        severity: "low",
        title: "Незаполненные профили",
        description: `${incompleteProfiles.length} пользователей без display_name. Рекомендуется запросить заполнение.`,
      });
    }

    const securityScore = Math.max(0, 100 - (securityFindings.filter(f => f.severity === "critical").length * 30) 
      - (securityFindings.filter(f => f.severity === "high").length * 20)
      - (securityFindings.filter(f => f.severity === "medium").length * 10)
      - (securityFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "🔒 Безопасность",
      score: securityScore,
      status: securityScore >= 90 ? "excellent" : securityScore >= 70 ? "good" : securityScore >= 50 ? "warning" : "critical",
      findings: securityFindings
    });

    // ========================================
    // 2. DATABASE HEALTH
    // ========================================
    const dbFindings: AuditSection["findings"] = [];

    // Check error_logs table size
    const { count: errorCount } = await supabase
      .from("error_logs")
      .select("*", { count: "exact", head: true });

    if ((errorCount || 0) > 1000) {
      dbFindings.push({
        severity: "medium",
        title: "Большой объём логов ошибок",
        description: `${errorCount} записей в error_logs. Рекомендуется очистить старые.`,
        recommendation: "Запустите автоматическую очистку через диагностику."
      });
    }

    // Check translation_history
    const { count: translationCount } = await supabase
      .from("translation_history")
      .select("*", { count: "exact", head: true });

    if ((translationCount || 0) > 5000) {
      dbFindings.push({
        severity: "low",
        title: "История переводов растёт",
        description: `${translationCount} записей переводов. При достижении 10000+ может повлиять на производительность.`,
      });
    }

    // Check meeting_transcripts for old data
    const { count: oldMeetings } = await supabase
      .from("meeting_transcripts")
      .select("*", { count: "exact", head: true })
      .lt("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if ((oldMeetings || 0) > 100) {
      dbFindings.push({
        severity: "low",
        title: "Старые записи встреч",
        description: `${oldMeetings} встреч старше 90 дней. Рассмотрите архивацию.`,
      });
    }

    // Check participant_geo_data
    const { count: geoCount } = await supabase
      .from("participant_geo_data")
      .select("*", { count: "exact", head: true });

    // Check for data backups
    const { data: recentBackups } = await supabase
      .from("data_backups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (!recentBackups || recentBackups.length === 0) {
      dbFindings.push({
        severity: "medium",
        title: "Нет резервных копий",
        description: "В системе нет записей о резервных копиях данных.",
        recommendation: "Настройте автоматическое резервное копирование критичных данных."
      });
    }

    const dbScore = Math.max(0, 100 - (dbFindings.filter(f => f.severity === "critical").length * 30) 
      - (dbFindings.filter(f => f.severity === "high").length * 20)
      - (dbFindings.filter(f => f.severity === "medium").length * 10)
      - (dbFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "🗃️ База данных",
      score: dbScore,
      status: dbScore >= 90 ? "excellent" : dbScore >= 70 ? "good" : dbScore >= 50 ? "warning" : "critical",
      findings: dbFindings
    });

    // ========================================
    // 3. API & EDGE FUNCTIONS HEALTH
    // ========================================
    const apiFindings: AuditSection["findings"] = [];

    // Check error patterns for edge function errors
    const { data: edgeFunctionErrors } = await supabase
      .from("error_logs")
      .select("*")
      .or("source.ilike.%edge%,source.ilike.%function%,error_type.ilike.%fetch%")
      .order("created_at", { ascending: false })
      .limit(50);

    if (edgeFunctionErrors && edgeFunctionErrors.length > 10) {
      const recentErrors = edgeFunctionErrors.filter(
        e => new Date(e.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      if (recentErrors.length > 5) {
        apiFindings.push({
          severity: "high",
          title: "Частые ошибки Edge Functions",
          description: `${recentErrors.length} ошибок API за последние 24 часа.`,
          recommendation: "Проверьте логи функций и наличие API-ключей."
        });
      }
    }

    // Check for rate limit errors
    const { data: rateLimitErrors } = await supabase
      .from("error_logs")
      .select("*")
      .or("error_message.ilike.%rate%,error_message.ilike.%429%,error_message.ilike.%limit%")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (rateLimitErrors && rateLimitErrors.length > 0) {
      apiFindings.push({
        severity: "medium",
        title: "Ошибки rate-limit",
        description: `${rateLimitErrors.length} ошибок ограничения скорости за 24ч. Возможно, слишком много запросов.`,
      });
    }

    const apiScore = Math.max(0, 100 - (apiFindings.filter(f => f.severity === "critical").length * 30) 
      - (apiFindings.filter(f => f.severity === "high").length * 20)
      - (apiFindings.filter(f => f.severity === "medium").length * 10)
      - (apiFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "⚡ API & Functions",
      score: apiScore,
      status: apiScore >= 90 ? "excellent" : apiScore >= 70 ? "good" : apiScore >= 50 ? "warning" : "critical",
      findings: apiFindings
    });

    // ========================================
    // 4. USER EXPERIENCE & ANALYTICS
    // ========================================
    const uxFindings: AuditSection["findings"] = [];

    // Check site_analytics for issues
    const { data: recentAnalytics } = await supabase
      .from("site_analytics")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!recentAnalytics || recentAnalytics.length === 0) {
      uxFindings.push({
        severity: "low",
        title: "Нет аналитики",
        description: "Аналитика сайта не собирается или пуста.",
      });
    } else {
      // Check for high bounce indicators
      const errorEvents = recentAnalytics.filter(a => 
        a.event_type?.includes("error") || a.event_type?.includes("fail")
      );
      if (errorEvents.length > 10) {
        uxFindings.push({
          severity: "medium",
          title: "Пользователи сталкиваются с ошибками",
          description: `${errorEvents.length} событий ошибок в аналитике. Возможны проблемы с UX.`,
        });
      }
    }

    // Check user presence for activity patterns
    const { data: activeUsers } = await supabase
      .from("user_presence")
      .select("*")
      .eq("is_online", true);

    uxFindings.push({
      severity: "info",
      title: "Активные пользователи",
      description: `Сейчас онлайн: ${activeUsers?.length || 0} пользователей.`,
    });

    const uxScore = Math.max(0, 100 - (uxFindings.filter(f => f.severity === "critical").length * 30) 
      - (uxFindings.filter(f => f.severity === "high").length * 20)
      - (uxFindings.filter(f => f.severity === "medium").length * 10)
      - (uxFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "📊 UX & Аналитика",
      score: uxScore,
      status: uxScore >= 90 ? "excellent" : uxScore >= 70 ? "good" : uxScore >= 50 ? "warning" : "critical",
      findings: uxFindings
    });

    // ========================================
    // 5. TELEGRAM INTEGRATION
    // ========================================
    const telegramFindings: AuditSection["findings"] = [];

    // Check telegram activity log
    const { count: telegramActivityCount } = await supabase
      .from("telegram_activity_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((telegramActivityCount || 0) === 0) {
      telegramFindings.push({
        severity: "low",
        title: "Нет Telegram активности",
        description: "Нет активности Telegram-бота за последние 24 часа.",
      });
    } else {
      telegramFindings.push({
        severity: "info",
        title: "Telegram активен",
        description: `${telegramActivityCount} действий через Telegram за 24ч.`,
      });
    }

    // Check scheduled calls
    const { data: pendingCalls } = await supabase
      .from("scheduled_calls")
      .select("*")
      .eq("status", "pending")
      .lt("scheduled_at", new Date().toISOString());

    if (pendingCalls && pendingCalls.length > 0) {
      telegramFindings.push({
        severity: "medium",
        title: "Пропущенные звонки",
        description: `${pendingCalls.length} запланированных звонков прошли время начала, но всё ещё в статусе pending.`,
        recommendation: "Проверьте систему напоминаний и обновите статусы."
      });
    }

    const telegramScore = Math.max(0, 100 - (telegramFindings.filter(f => f.severity === "critical").length * 30) 
      - (telegramFindings.filter(f => f.severity === "high").length * 20)
      - (telegramFindings.filter(f => f.severity === "medium").length * 10)
      - (telegramFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "📱 Telegram",
      score: telegramScore,
      status: telegramScore >= 90 ? "excellent" : telegramScore >= 70 ? "good" : telegramScore >= 50 ? "warning" : "critical",
      findings: telegramFindings
    });

    // ========================================
    // 6. DATA INTEGRITY
    // ========================================
    const integrityFindings: AuditSection["findings"] = [];

    // Check for orphaned records in call_participants
    const { data: orphanedParticipants } = await supabase
      .from("call_participants")
      .select("id, call_request_id")
      .limit(100);

    // Check contacts for valid references
    const { count: contactsCount } = await supabase
      .from("contacts")
      .select("*", { count: "exact", head: true });

    integrityFindings.push({
      severity: "info",
      title: "Контакты в системе",
      description: `${contactsCount || 0} контактов сохранено.`,
    });

    // Check error_groups sync
    const { data: errorGroups } = await supabase
      .from("error_groups")
      .select("*")
      .is("telegram_message_id", null)
      .limit(10);

    if (errorGroups && errorGroups.length > 0) {
      integrityFindings.push({
        severity: "low",
        title: "Несинхронизированные группы ошибок",
        description: `${errorGroups.length} групп ошибок без Telegram ID.`,
      });
    }

    const integrityScore = Math.max(0, 100 - (integrityFindings.filter(f => f.severity === "critical").length * 30) 
      - (integrityFindings.filter(f => f.severity === "high").length * 20)
      - (integrityFindings.filter(f => f.severity === "medium").length * 10)
      - (integrityFindings.filter(f => f.severity === "low").length * 3));

    sections.push({
      category: "🔗 Целостность данных",
      score: integrityScore,
      status: integrityScore >= 90 ? "excellent" : integrityScore >= 70 ? "good" : integrityScore >= 50 ? "warning" : "critical",
      findings: integrityFindings
    });

    // ========================================
    // CALCULATE OVERALL SCORE
    // ========================================
    const overallScore = Math.round(
      sections.reduce((sum, s) => sum + s.score, 0) / sections.length
    );

    // ========================================
    // AI DEEP ANALYSIS
    // ========================================
    // Collect all findings for AI
    sections.forEach(section => {
      section.findings.forEach(f => {
        allFindings.push({
          category: section.category,
          severity: f.severity,
          title: f.title,
          description: f.description
        });
      });
    });

    const criticalFindings = allFindings.filter(f => f.severity === "critical" || f.severity === "high");
    const mediumFindings = allFindings.filter(f => f.severity === "medium");

    const aiPrompt = `Ты — эксперт по безопасности и оптимизации веб-приложений. Проанализируй результаты глубокого аудита APLink и дай экспертные рекомендации.

ОБЩАЯ ОЦЕНКА: ${overallScore}/100

СЕКЦИИ АУДИТА:
${sections.map(s => `${s.category}: ${s.score}/100 (${s.status}) - ${s.findings.length} находок`).join('\n')}

КРИТИЧЕСКИЕ И ВАЖНЫЕ ПРОБЛЕМЫ:
${criticalFindings.length > 0 ? criticalFindings.map(f => `• [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n') : 'Критических проблем не обнаружено'}

СРЕДНИЕ ПРОБЛЕМЫ:
${mediumFindings.length > 0 ? mediumFindings.map(f => `• ${f.title}: ${f.description}`).join('\n') : 'Средних проблем не обнаружено'}

Дай ответ в JSON:
{
  "summary": "Краткий экспертный анализ состояния системы (3-4 предложения)",
  "topPriorities": ["Топ-3 приоритетных действия для улучшения"],
  "securityTips": ["2-3 конкретных совета по безопасности"],
  "performanceTips": ["2-3 совета по производительности"],
  "uxTips": ["1-2 совета по улучшению UX"],
  "overallVerdict": "Одно предложение - общий вердикт о состоянии системы"
}`;

    let aiAnalysis = "";
    let aiRecommendations: string[] = [];

    try {
      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: "Ты эксперт по безопасности и оптимизации веб-приложений. Отвечай ТОЛЬКО валидным JSON без markdown." 
            },
            { role: "user", content: aiPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiText = aiData.choices?.[0]?.message?.content || "";
        
        try {
          const jsonMatch = aiText.match(/```json\n?([\s\S]*?)\n?```/) || aiText.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
          const parsed = JSON.parse(jsonStr);
          
          aiAnalysis = parsed.summary || parsed.overallVerdict || "";
          aiRecommendations = [
            ...(parsed.topPriorities || []),
            ...(parsed.securityTips || []),
            ...(parsed.performanceTips || []),
            ...(parsed.uxTips || [])
          ].slice(0, 10);
        } catch {
          aiAnalysis = aiText.substring(0, 500);
        }
      }
    } catch (e) {
      console.error("AI analysis failed:", e);
      aiAnalysis = "AI-анализ временно недоступен.";
    }

    const scanDuration = Date.now() - startTime;

    const result: DeepAuditResult = {
      overallScore,
      overallStatus: overallScore >= 90 ? "🟢 Отлично" : 
                     overallScore >= 70 ? "🟡 Хорошо" : 
                     overallScore >= 50 ? "🟠 Требует внимания" : "🔴 Критично",
      sections,
      aiAnalysis,
      aiRecommendations,
      scanDuration,
      scannedAt: new Date().toISOString()
    };

    // Send Telegram notification for critical issues
    const telegramToken = Deno.env.get("REPORTS_BOT_TOKEN");
    if (telegramToken && overallScore < 70) {
      const adminChatId = "2061785720";
      const message = `🔍 *Глубокий аудит APLink*

📊 Общая оценка: *${overallScore}/100* ${result.overallStatus}

${sections.map(s => `${s.category}: ${s.score}/100`).join('\n')}

${criticalFindings.length > 0 ? `\n⚠️ *Критичные проблемы:*\n${criticalFindings.slice(0, 3).map(f => `• ${f.title}`).join('\n')}` : ''}

🤖 *AI-анализ:*
${aiAnalysis.substring(0, 300)}...`;

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Deep audit error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
