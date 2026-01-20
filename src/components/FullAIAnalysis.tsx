import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, Loader2, AlertTriangle, CheckCircle, XCircle, 
  Copy, Shield, Zap, MousePointer, FileText, TrendingUp,
  Lock, Database, MessageCircle, ArrowRight, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface FullAnalysisResult {
  // Basic stats
  stats: {
    errors: number;
    clicks: number;
    newUsers: number;
    requests: number;
    tasks: number;
    limits: number;
  };
  // Overall health
  health: {
    status: "CRITICAL" | "WARNING" | "GOOD" | "EXCELLENT";
    score: number;
    summary: string;
  };
  // Sections
  sections: {
    errors: { title: string; items: { text: string; type: "error" | "warning" | "info" }[] };
    security: { title: string; severity: string; items: { priority: "high" | "medium" | "low"; text: string; recommendation: string }[] };
    ux: { title: string; pages: string[]; recommendations: string[] };
    conversion: { title: string; rate: string; recommendations: string[] };
    content: { title: string; status: string; recommendations: string[] };
    performance: { title: string; metrics: { label: string; value: string }[]; recommendations: string[] };
  };
  // Action plan
  actionPlan: { priority: "high" | "medium" | "low"; title: string; impact: string }[];
  // AI insights
  aiInsights: string;
  // Scan metadata
  scanDuration: number;
  scannedAt: string;
}

interface FullAIAnalysisProps {
  errorLogs: { id: string; created_at: string; error_type: string; error_message: string; source: string | null; severity: string }[];
  errorStats: { total: number; today: number; week: number } | null;
}

const FullAIAnalysis = ({ errorLogs, errorStats }: FullAIAnalysisProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullAnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState("");

  const runFullAnalysis = async () => {
    setLoading(true);
    setResult(null);
    setAnalysisStep("Запуск диагностики...");

    try {
      // Step 1: Run diagnostics
      setAnalysisStep("🔍 Сканирование ошибок...");
      const diagRes = await supabase.functions.invoke("run-diagnostics", { body: { action: "scan" } });
      
      // Step 2: Run deep security audit
      setAnalysisStep("🔒 Проверка безопасности...");
      const auditRes = await supabase.functions.invoke("deep-security-audit");
      
      // Step 3: Run AI analysis
      setAnalysisStep("🧠 AI анализирует данные...");
      const aiRes = await supabase.functions.invoke("analyze-errors", { body: { autoTrigger: false } });
      
      // Step 4: Get site analytics
      setAnalysisStep("📊 Сбор аналитики...");
      const { data: analyticsData } = await supabase
        .from("site_analytics")
        .select("*")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: telegramData } = await supabase
        .from("telegram_activity_log")
        .select("*")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: meetingsData } = await supabase
        .from("meeting_transcripts")
        .select("id")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: scheduledCalls } = await supabase
        .from("scheduled_calls")
        .select("id")
        .eq("status", "pending");

      // Combine all results
      setAnalysisStep("✨ Формирование отчёта...");
      
      const auditData = auditRes.data || {};
      const aiData = aiRes.data || {};
      const diagData = diagRes.data || {};
      
      // Calculate health score
      const errorScore = Math.max(0, 100 - (errorStats?.today || 0) * 5);
      const auditScore = auditData.overallScore || 80;
      const overallScore = Math.round((errorScore + auditScore) / 2);
      
      const healthStatus = overallScore >= 90 ? "EXCELLENT" : 
                          overallScore >= 70 ? "GOOD" : 
                          overallScore >= 50 ? "WARNING" : "CRITICAL";

      // Build sections from audit data
      const auditSections = auditData.sections || [];
      const securitySection = auditSections.find((s: any) => s.category.includes("Безопасность")) || { findings: [] };
      const dbSection = auditSections.find((s: any) => s.category.includes("База")) || { findings: [] };
      const apiSection = auditSections.find((s: any) => s.category.includes("API")) || { findings: [] };
      const telegramSection = auditSections.find((s: any) => s.category.includes("Telegram")) || { findings: [] };

      // Click analytics
      const pageViews = analyticsData?.filter(a => a.event_type === 'page_view') || [];
      const uniquePages = [...new Set(pageViews.map(p => p.page_path).filter(Boolean))].slice(0, 3);

      const fullResult: FullAnalysisResult = {
        stats: {
          errors: errorStats?.total || 0,
          clicks: pageViews.length,
          newUsers: analyticsData?.filter(a => a.event_type === 'signup')?.length || 0,
          requests: meetingsData?.length || 0,
          tasks: scheduledCalls?.length || 0,
          limits: 0
        },
        health: {
          status: healthStatus,
          score: overallScore,
          summary: auditData.aiAnalysis || aiData.analysis || "Анализ завершён. Проверьте результаты ниже."
        },
        sections: {
          errors: {
            title: diagData.summary?.errors > 0 ? "Критическая ошибка" : "Ошибок нет",
            items: (diagData.results || [])
              .filter((r: any) => r.status !== 'ok')
              .slice(0, 3)
              .map((r: any) => ({
                text: r.message,
                type: r.status as "error" | "warning"
              }))
          },
          security: {
            title: securitySection.findings?.some((f: any) => f.severity === 'critical' || f.severity === 'high') 
              ? "Critical Vulnerability" 
              : "Secure",
            severity: securitySection.status || "good",
            items: securitySection.findings
              ?.filter((f: any) => f.severity !== 'info')
              .slice(0, 3)
              .map((f: any) => ({
                priority: f.severity === 'critical' ? 'high' : f.severity === 'high' ? 'high' : 'medium',
                text: f.title,
                recommendation: f.recommendation || f.description
              })) || []
          },
          ux: {
            title: "UX / Клики",
            pages: uniquePages as string[],
            recommendations: [
              pageViews.length < 100 ? "Увеличить трафик на ключевые страницы" : "Хороший уровень посещаемости",
              "Проанализировать путь пользователя от входа к целевому действию"
            ]
          },
          conversion: {
            title: "Конверсия",
            rate: meetingsData?.length && analyticsData?.length 
              ? `${Math.round((meetingsData.length / (analyticsData.length || 1)) * 100)}%`
              : "N/A",
            recommendations: [
              "Масштабировать трафик для увеличения количества звонков",
              "Настроить отслеживание источников трафика"
            ]
          },
          content: {
            title: "Контент",
            status: "Актуальный",
            recommendations: [
              "Поддерживать новостную ленту в актуальном состоянии",
              "Добавить больше обучающего контента"
            ]
          },
          performance: {
            title: "Производительность",
            metrics: [
              { label: "Telegram активность", value: `${telegramData?.length || 0} действий/нед` },
              { label: "Задачи", value: `${scheduledCalls?.length || 0} pending` }
            ],
            recommendations: apiSection.findings
              ?.slice(0, 2)
              .map((f: any) => f.title || f.description) || ["Система работает стабильно"]
          }
        },
        actionPlan: [
          ...(aiData.recommendations || []).slice(0, 2).map((r: any) => ({
            priority: r.priority as "high" | "medium" | "low",
            title: r.problem || r.errorType,
            impact: r.solution
          })),
          ...(auditData.aiRecommendations || []).slice(0, 2).map((rec: string, i: number) => ({
            priority: i === 0 ? "medium" as const : "low" as const,
            title: rec.substring(0, 60) + (rec.length > 60 ? "..." : ""),
            impact: rec
          }))
        ].slice(0, 4),
        aiInsights: auditData.aiAnalysis || aiData.analysis || "",
        scanDuration: auditData.scanDuration || 3000,
        scannedAt: new Date().toISOString()
      };

      setResult(fullResult);
      
      // Save to history
      await supabase.from('ai_analysis_history').insert({
        analysis: fullResult.aiInsights,
        recommendations: fullResult.actionPlan,
        error_count: fullResult.stats.errors,
        pattern_count: fullResult.actionPlan.length,
        trigger_type: 'manual'
      });

      toast.success("🧠 Полный AI-анализ завершён!");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn("Full analysis error:", err);
      toast.error("Ошибка анализа: " + errorMessage.substring(0, 100));
    } finally {
      setLoading(false);
      setAnalysisStep("");
    }
  };

  const copyReport = () => {
    if (!result) return;
    
    const report = `# AI-Анализ APLink
Дата: ${format(new Date(result.scannedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
Оценка: ${result.health.score}/100 (${result.health.status})

## Статистика
- Ошибок: ${result.stats.errors}
- Кликов: ${result.stats.clicks}
- Новых пользователей: ${result.stats.newUsers}
- Звонков: ${result.stats.requests}

## Здоровье сайта
${result.health.summary}

## План действий
${result.actionPlan.map((a, i) => `${i+1}. [${a.priority.toUpperCase()}] ${a.title}\n   ${a.impact}`).join('\n')}

## AI-инсайты
${result.aiInsights}`;

    navigator.clipboard.writeText(report);
    toast.success("📋 Отчёт скопирован!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CRITICAL": return "text-red-500";
      case "WARNING": return "text-amber-500";
      case "GOOD": return "text-blue-400";
      case "EXCELLENT": return "text-green-400";
      default: return "text-gray-400";
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-400 border-l-red-500";
      case "medium": return "bg-amber-500/20 text-amber-300 border-l-amber-500";
      case "low": return "bg-blue-500/20 text-blue-300 border-l-blue-500";
      default: return "bg-gray-500/20 text-gray-400 border-l-gray-500";
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-purple-500/20 overflow-hidden">
      <CardHeader className="pb-4 border-b border-white/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/30">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-white flex items-center gap-2">
                AI-Анализ всего сайта
                <Sparkles className="w-4 h-4 text-purple-400" />
              </CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Полная диагностика: ошибки, безопасность, UX, конверсия, контент
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={runFullAnalysis} 
              disabled={loading}
              className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {analysisStep || "Анализ..."}
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Запустить AI-анализ
                </>
              )}
            </Button>
            {result && (
              <Button variant="outline" size="sm" onClick={copyReport} className="gap-2">
                <Copy className="w-4 h-4" />
                Скопировать отчёт
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center mb-6 border border-purple-500/20">
              <Brain className="w-10 h-10 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Полный AI-анализ сайта</h3>
            <p className="text-gray-400 max-w-md">
              Анализирует ошибки, безопасность, UX, конверсию, контент и производительность. 
              Даёт конкретные рекомендации по улучшению.
            </p>
            <Button 
              onClick={runFullAnalysis}
              className="mt-6 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Brain className="w-4 h-4" />
              Запустить анализ
            </Button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
              <Brain className="w-8 h-8 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-purple-400 mt-6 font-medium">{analysisStep}</p>
            <p className="text-gray-500 text-sm mt-2">Это может занять несколько секунд...</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { icon: AlertTriangle, value: result.stats.errors, label: "Ошибки", color: "text-amber-400" },
                { icon: MousePointer, value: result.stats.clicks, label: "Клики", color: "text-cyan-400" },
                { icon: Zap, value: result.stats.newUsers, label: "Новых", color: "text-green-400" },
                { icon: FileText, value: result.stats.requests, label: "Звонков", color: "text-blue-400" },
                { icon: TrendingUp, value: result.stats.tasks, label: "Задач", color: "text-orange-400" },
                { icon: Lock, value: result.stats.limits, label: "Лимиты", color: "text-gray-400" },
              ].map((stat, i) => (
                <div key={i} className="p-3 rounded-xl bg-gray-800/50 border border-white/5 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                  <div className="text-xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Health Status */}
            <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {result.health.status === "CRITICAL" && <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />}
                  {result.health.status === "WARNING" && <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />}
                  {result.health.status === "GOOD" && <CheckCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />}
                  {result.health.status === "EXCELLENT" && <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <h3 className="font-medium text-white">
                      Здоровье сайта: <span className={getStatusColor(result.health.status)}>{result.health.status}</span>
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{result.health.summary}</p>
                    <Progress 
                      value={result.health.score} 
                      className="mt-3 h-2 bg-gray-700"
                    />
                  </div>
                </div>
                <div className={`text-4xl font-bold ${getStatusColor(result.health.status)}`}>
                  {result.health.score}
                  <span className="text-lg text-gray-500">/100</span>
                </div>
              </div>
            </div>

            {/* Sections Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Errors */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-amber-400 font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  Ошибки
                </h4>
                <p className="text-sm text-gray-400 mb-3">{result.sections.errors.title}</p>
                <div className="space-y-2">
                  {result.sections.errors.items.length > 0 ? result.sections.errors.items.map((item, i) => (
                    <div key={i} className={`p-2 rounded-lg text-sm ${
                      item.type === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-300'
                    }`}>
                      {item.text}
                    </div>
                  )) : (
                    <p className="text-sm text-green-400">✓ Критических ошибок нет</p>
                  )}
                </div>
              </div>

              {/* Security */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-purple-400 font-medium flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  Безопасность
                </h4>
                <p className="text-sm text-gray-400 mb-3">{result.sections.security.title}</p>
                <div className="space-y-2">
                  {result.sections.security.items.length > 0 ? result.sections.security.items.map((item, i) => (
                    <div key={i} className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${
                          item.priority === 'high' ? 'bg-red-500/30 text-red-300' : 'bg-amber-500/30 text-amber-300'
                        }`}>
                          {item.priority.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-red-300">{item.text}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {item.recommendation}
                      </p>
                    </div>
                  )) : (
                    <p className="text-sm text-green-400">✓ Критических уязвимостей нет</p>
                  )}
                </div>
              </div>

              {/* UX */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-cyan-400 font-medium flex items-center gap-2 mb-3">
                  <MousePointer className="w-4 h-4" />
                  {result.sections.ux.title}
                </h4>
                <p className="text-sm text-gray-400 mb-2">Популярные страницы:</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {result.sections.ux.pages.length > 0 ? result.sections.ux.pages.map((page, i) => (
                    <Badge key={i} variant="secondary" className="bg-gray-700 text-gray-300">{page}</Badge>
                  )) : (
                    <span className="text-sm text-gray-500">Нет данных</span>
                  )}
                </div>
                <div className="space-y-1">
                  {result.sections.ux.recommendations.map((rec, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {rec}
                    </p>
                  ))}
                </div>
              </div>

              {/* Conversion */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-green-400 font-medium flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4" />
                  {result.sections.conversion.title}
                </h4>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">Высокая эффективность при малом объеме</span>
                  <Badge className="bg-green-500/20 text-green-300">{result.sections.conversion.rate}</Badge>
                </div>
                <div className="space-y-1">
                  {result.sections.conversion.recommendations.map((rec, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {rec}
                    </p>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-blue-400 font-medium flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" />
                  {result.sections.content.title}
                </h4>
                <p className="text-sm text-gray-400 mb-3">{result.sections.content.status}</p>
                <div className="space-y-1">
                  {result.sections.content.recommendations.map((rec, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {rec}
                    </p>
                  ))}
                </div>
              </div>

              {/* Performance */}
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-orange-400 font-medium flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" />
                  {result.sections.performance.title}
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {result.sections.performance.metrics.map((m, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs text-gray-500">{m.label}</div>
                      <div className="text-sm font-medium text-white">{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  {result.sections.performance.recommendations.map((rec, i) => (
                    <p key={i} className="text-xs text-gray-400 flex items-start gap-1">
                      <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      {rec}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Plan */}
            {result.actionPlan.length > 0 && (
              <div className="p-4 rounded-xl bg-gray-800/50 border border-white/5">
                <h4 className="text-purple-400 font-medium flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4" />
                  План действий
                </h4>
                <div className="space-y-3">
                  {result.actionPlan.map((action, i) => (
                    <div 
                      key={i} 
                      className={`p-3 rounded-lg border-l-4 ${getPriorityStyle(action.priority)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-500">{i + 1}</span>
                          <span className="font-medium">{action.title}</span>
                        </div>
                        <Badge className={`text-xs ${
                          action.priority === 'high' ? 'bg-red-500/30 text-red-300' :
                          action.priority === 'medium' ? 'bg-amber-500/30 text-amber-300' :
                          'bg-blue-500/30 text-blue-300'
                        }`}>
                          {action.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 ml-8">Влияние: {action.impact}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scan metadata */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
              <span>Сканирование: {format(new Date(result.scannedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</span>
              <span>Время: {Math.round(result.scanDuration / 1000)}с</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FullAIAnalysis;
