import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Activity, CheckCircle, AlertTriangle, XCircle, Clock, 
  Brain, Loader2, Code, Copy, Check, Search, Shield, 
  Trash2, History, Bug, TrendingUp, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  source: string | null;
  severity: string;
}

interface ErrorStats {
  total: number;
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  today: number;
  week: number;
  notified: number;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  errorType: string;
  problem: string;
  solution: string;
  file?: string;
}

interface CodeExample {
  title: string;
  code: string;
}

interface DiagnosticsResult {
  category: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

interface AnalysisResult {
  analysis: string;
  recommendations: Recommendation[];
  codeExamples?: CodeExample[];
  summary: { total: number; patterns: number; analyzedAt: string };
  diagnostics?: {
    results: DiagnosticsResult[];
    fixes: string[];
    summary: { total: number; ok: number; warnings: number; errors: number };
  };
}

interface DiagnosticsRecord {
  id: string;
  created_at: string;
  trigger_type: string;
  summary: { total: number; ok: number; warnings: number; errors: number };
  results: DiagnosticsResult[];
  fixes: string[];
  telegram_sent: boolean;
}

interface TrendData {
  date: string;
  errors: number;
  critical: number;
  warnings: number;
}

interface SystemStatusDashboardProps {
  errorLogs: ErrorLog[];
  errorStats: ErrorStats | null;
  onClearOldLogs: () => Promise<void>;
  clearingLogs: boolean;
}

const SystemStatusDashboard = ({ errorLogs, errorStats, onClearOldLogs, clearingLogs }: SystemStatusDashboardProps) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [history, setHistory] = useState<DiagnosticsRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticsRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [trendData, setTrendData] = useState<TrendData[]>([]);

  // Calculate 7-day trend data
  useEffect(() => {
    const last7Days: TrendData[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const nextDay = startOfDay(subDays(new Date(), i - 1));
      
      const dayErrors = errorLogs.filter(e => {
        const errorDate = new Date(e.created_at);
        return errorDate >= day && errorDate < nextDay;
      });
      
      last7Days.push({
        date: format(day, 'dd.MM', { locale: ru }),
        errors: dayErrors.length,
        critical: dayErrors.filter(e => e.severity === 'critical' || e.severity === 'error').length,
        warnings: dayErrors.filter(e => e.severity === 'warning').length
      });
    }
    setTrendData(last7Days);
  }, [errorLogs]);

  // Fetch diagnostics history
  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("diagnostics_history")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        
        const typedData = (data || []).map(item => ({
          ...item,
          summary: item.summary as unknown as DiagnosticsRecord['summary'],
          results: item.results as unknown as DiagnosticsResult[],
          fixes: (item.fixes as unknown as string[]) || [],
        }));
        
        setHistory(typedData);
      } catch (error) {
        console.error("Failed to load history:", error);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Auto-trigger on high error count
  useEffect(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = errorLogs.filter(e => new Date(e.created_at) > oneHourAgo);
    
    if (recentErrors.length >= 10 && !result && !loading) {
      toast.warning(`⚠️ ${recentErrors.length} ошибок за час! Запускаю AI-анализ...`);
      runAIDiagnostics(true);
    }
  }, [errorLogs]);

  const runAIDiagnostics = async (autoTrigger = false) => {
    setLoading(true);
    setResult(null);
    
    try {
      // Run both diagnostics and AI analysis
      const [diagRes, aiRes] = await Promise.all([
        supabase.functions.invoke("run-diagnostics", { body: { action: "scan" } }),
        supabase.functions.invoke("analyze-errors", { body: { autoTrigger } })
      ]);
      
      if (diagRes.error) throw diagRes.error;
      if (aiRes.error) throw aiRes.error;
      
      if (aiRes.data.error) {
        toast.error(aiRes.data.error);
        return;
      }
      
      setResult({
        ...aiRes.data,
        diagnostics: diagRes.data
      });
      
      // Save to AI history
      await supabase.from('ai_analysis_history').insert({
        analysis: aiRes.data.analysis || '',
        recommendations: aiRes.data.recommendations || [],
        code_examples: aiRes.data.codeExamples || [],
        error_count: aiRes.data.summary?.total || 0,
        pattern_count: aiRes.data.summary?.patterns || 0,
        trigger_type: autoTrigger ? 'auto' : 'manual'
      });
      
      toast.success("🧠 AI-диагностика завершена!");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Ошибка анализа");
    } finally {
      setLoading(false);
    }
  };

  const runAutofix = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-diagnostics", {
        body: { action: "fix" }
      });
      if (error) throw error;
      
      setResult(prev => prev ? { ...prev, diagnostics: data } : null);
      toast.success("🔧 Автофикс завершён!");
    } catch (err) {
      console.error("Autofix error:", err);
      toast.error("Ошибка автофикса");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllErrors = () => {
    const errorsSummary = errorLogs.slice(0, 50).map(e => 
      `[${e.severity.toUpperCase()}] ${e.error_type}: ${e.error_message}\nИсточник: ${e.source || 'unknown'}\nВремя: ${e.created_at}\n`
    ).join('\n---\n');
    
    const fullReport = `# Отчёт об ошибках APLink\nВсего: ${errorLogs.length}\n\n${errorsSummary}${result ? `\n\n## AI-анализ:\n${result.analysis}\n\n## Рекомендации:\n${result.recommendations?.map((r, i) => 
      `${i+1}. [${r.priority}] ${r.errorType}: ${r.problem}\n   → ${r.solution}`
    ).join('\n') || 'Нет'}` : ''}`;

    navigator.clipboard.writeText(fullReport);
    toast.success("📋 Скопировано для Lovable!");
  };

  const getOverallStatus = () => {
    const criticalCount = errorStats?.bySeverity.find(s => s.severity === 'critical')?.count || 0;
    const errorCount = errorStats?.bySeverity.find(s => s.severity === 'error')?.count || 0;
    
    if (criticalCount > 0) return { color: "bg-red-500", text: "Критично", icon: XCircle };
    if (errorCount > 5) return { color: "bg-red-500", text: "Требует внимания", icon: AlertTriangle };
    if (errorStats?.today && errorStats.today > 10) return { color: "bg-amber-500", text: "Повышенная активность", icon: AlertTriangle };
    return { color: "bg-green-500", text: "Всё в порядке", icon: CheckCircle };
  };

  const overallStatus = getOverallStatus();
  const StatusIcon = overallStatus.icon;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "low": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Status Card */}
      <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-white/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-primary" />
              <CardTitle className="text-xl text-white">Статус системы</CardTitle>
              <Badge className={`${overallStatus.color} text-white border-0 px-3`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {overallStatus.text}
              </Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={copyAllErrors} className="gap-2">
                <Copy className="w-4 h-4" /> Скопировать всё
              </Button>
              <Button onClick={() => runAIDiagnostics()} disabled={loading} size="sm" className="gap-2 bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                AI Диагностика
              </Button>
              <Button onClick={runAutofix} disabled={loading} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                <Shield className="w-4 h-4" /> Автофикс
              </Button>
              <Button onClick={onClearOldLogs} disabled={clearingLogs} size="sm" variant="destructive" className="gap-2">
                {clearingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Очистка
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-gray-700/30 text-center">
              <div className="text-2xl font-bold text-white">{errorStats?.total || 0}</div>
              <div className="text-xs text-gray-400">Всего</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/20 text-center">
              <div className="text-2xl font-bold text-amber-400">{errorStats?.today || 0}</div>
              <div className="text-xs text-gray-400">Сегодня</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/20 text-center">
              <div className="text-2xl font-bold text-blue-400">{errorStats?.week || 0}</div>
              <div className="text-xs text-gray-400">Неделя</div>
            </div>
            <div className="p-3 rounded-lg bg-red-500/20 text-center">
              <div className="text-2xl font-bold text-red-400">
                {errorStats?.bySeverity.find(s => s.severity === 'critical')?.count || 0}
              </div>
              <div className="text-xs text-gray-400">Критических</div>
            </div>
            <div className="p-3 rounded-lg bg-green-500/20 text-center">
              <div className="text-2xl font-bold text-green-400">{errorStats?.notified || 0}</div>
              <div className="text-xs text-gray-400">Отправлено</div>
            </div>
          </div>

          {/* 7-Day Trend Chart */}
          <div className="p-4 rounded-lg bg-gray-700/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-white">Тренд за 7 дней</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="errors" stroke="#ef4444" fill="url(#colorErrors)" name="Ошибки" />
                  <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} dot={false} name="Критические" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabs for details */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800/50">
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="types">По типу</TabsTrigger>
              <TabsTrigger value="recent">Последние</TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {/* Severity breakdown */}
              <div className="grid grid-cols-4 gap-2">
                {errorStats?.bySeverity.map(({ severity, count }) => (
                  <div key={severity} className={`p-2 rounded-lg text-center ${
                    severity === 'critical' ? 'bg-red-500/20' :
                    severity === 'error' ? 'bg-orange-500/20' :
                    severity === 'warning' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                  }`}>
                    <div className={`text-lg font-bold ${
                      severity === 'critical' ? 'text-red-400' :
                      severity === 'error' ? 'text-orange-400' :
                      severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                    }`}>{count}</div>
                    <div className="text-xs text-gray-400 capitalize">{severity}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="types" className="mt-4">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {errorStats?.byType.slice(0, 10).map(({ type, count }) => (
                    <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-gray-700/30">
                      <span className="text-sm text-white font-mono truncate max-w-[70%]">{type}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {errorLogs.slice(0, 10).map((error) => (
                    <div key={error.id} className={`p-2 rounded-lg border text-sm ${
                      error.severity === 'critical' ? 'border-red-500/30 bg-red-500/10' :
                      error.severity === 'error' ? 'border-orange-500/30 bg-orange-500/10' :
                      'border-amber-500/30 bg-amber-500/10'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-gray-400">{error.error_type}</span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(error.created_at), 'dd.MM HH:mm')}
                        </span>
                      </div>
                      <p className="text-white text-xs mt-1 truncate">{error.error_message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {history.map((record) => (
                      <div
                        key={record.id}
                        className="p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => { setSelectedRecord(record); setShowDetails(true); }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">
                              {format(new Date(record.created_at), 'dd MMM HH:mm', { locale: ru })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {record.trigger_type === 'auto' || record.trigger_type === 'scheduled' ? '🤖' : '👤'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-400">✓{record.summary.ok}</span>
                            <span className="text-amber-400">⚠{record.summary.warnings}</span>
                            <span className="text-red-400">✕{record.summary.errors}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* AI Analysis Results */}
      {(loading || result) && (
        <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              AI-анализ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                <span className="ml-3 text-gray-400">Анализирую ошибки...</span>
              </div>
            )}

            {result && !loading && (
              <>
                {/* Diagnostics summary */}
                {result.diagnostics && (
                  <div className="flex gap-2 text-sm">
                    <Badge className="bg-green-500/20 text-green-400">✓ {result.diagnostics.summary.ok}</Badge>
                    <Badge className="bg-amber-500/20 text-amber-400">⚠ {result.diagnostics.summary.warnings}</Badge>
                    <Badge className="bg-red-500/20 text-red-400">✕ {result.diagnostics.summary.errors}</Badge>
                    {result.diagnostics.fixes.length > 0 && (
                      <Badge className="bg-blue-500/20 text-blue-400">🔧 {result.diagnostics.fixes.length} фиксов</Badge>
                    )}
                  </div>
                )}

                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-sm text-white">{result.analysis}</p>
                </div>

                {result.recommendations && result.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Рекомендации:</h4>
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                            {rec.priority === "high" ? "🔴" : rec.priority === "medium" ? "🟡" : "🔵"}
                          </Badge>
                          <span className="font-mono text-xs">{rec.errorType}</span>
                        </div>
                        <p className="text-sm font-medium text-white">{rec.problem}</p>
                        <p className="text-sm text-gray-400">{rec.solution}</p>
                      </div>
                    ))}
                  </div>
                )}

                {result.codeExamples && result.codeExamples.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Код:</h4>
                    {result.codeExamples.map((ex, i) => (
                      <div key={i} className="relative">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-400">{ex.title}</span>
                          <Button variant="ghost" size="sm" onClick={() => copyCode(ex.code, i)} className="h-6 px-2">
                            {copiedIndex === i ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                        <pre className="p-3 bg-gray-900 rounded-lg text-xs overflow-x-auto">
                          <code className="text-green-400">{ex.code}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {result.recommendations?.length === 0 && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Критических проблем не обнаружено!</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl bg-gray-900 border border-white/10 text-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Детали диагностики
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 rounded-lg bg-gray-800">
                  <div className="text-xl font-bold">{selectedRecord.summary.total}</div>
                  <div className="text-xs text-gray-400">Всего</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/20">
                  <div className="text-xl font-bold text-green-400">{selectedRecord.summary.ok}</div>
                  <div className="text-xs text-gray-400">ОК</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/20">
                  <div className="text-xl font-bold text-amber-400">{selectedRecord.summary.warnings}</div>
                  <div className="text-xs text-gray-400">Предупр.</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/20">
                  <div className="text-xl font-bold text-red-400">{selectedRecord.summary.errors}</div>
                  <div className="text-xs text-gray-400">Ошибки</div>
                </div>
              </div>

              <div className="space-y-2">
                {selectedRecord.results.map((r, i) => (
                  <div key={i} className={`p-2 rounded-lg border ${
                    r.status === 'error' ? 'border-red-500/30 bg-red-500/10' :
                    r.status === 'warning' ? 'border-amber-500/30 bg-amber-500/10' :
                    'border-green-500/30 bg-green-500/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      {r.status === 'ok' && <CheckCircle className="w-4 h-4 text-green-400" />}
                      {r.status === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {r.status === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                      <span className="font-medium">{r.name}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{r.message}</p>
                  </div>
                ))}
              </div>

              {selectedRecord.fixes.length > 0 && (
                <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                  <h4 className="text-sm font-medium text-green-400 mb-2">Применённые фиксы:</h4>
                  <ul className="text-sm space-y-1">
                    {selectedRecord.fixes.map((fix, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-300">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemStatusDashboard;