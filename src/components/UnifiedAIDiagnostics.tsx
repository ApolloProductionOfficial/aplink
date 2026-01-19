import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, Loader2, AlertTriangle, CheckCircle, Code, Copy, Check, 
  Search, Shield, Trash2, History, BarChart3, Clock 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

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
  fixable?: boolean;
}

interface AnalysisResult {
  analysis: string;
  recommendations: Recommendation[];
  codeExamples?: CodeExample[];
  summary: {
    total: number;
    patterns: number;
    analyzedAt: string;
  };
  diagnostics?: {
    results: DiagnosticsResult[];
    fixes: string[];
    summary: { total: number; ok: number; warnings: number; errors: number };
  };
}

interface HistoryEntry {
  id: string;
  created_at: string;
  analysis: string;
  recommendations: Recommendation[];
  code_examples: CodeExample[];
  error_count: number;
  pattern_count: number;
  trigger_type: string;
}

interface UnifiedAIDiagnosticsProps {
  errorLogs: Array<{
    id: string;
    error_type: string;
    error_message: string;
    source: string | null;
    severity: string;
    created_at: string;
  }>;
  onClearOldLogs: () => Promise<void>;
  clearingLogs: boolean;
}

const UnifiedAIDiagnostics = ({ errorLogs, onClearOldLogs, clearingLogs }: UnifiedAIDiagnosticsProps) => {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'diagnose' | 'autofix'>('diagnose');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [comparingId, setComparingId] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<HistoryEntry | null>(null);

  // Check for auto-trigger threshold (10+ errors per hour)
  useEffect(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = errorLogs.filter(e => new Date(e.created_at) > oneHourAgo);
    
    if (recentErrors.length >= 10 && !result && !loading) {
      toast.warning(`⚠️ Обнаружено ${recentErrors.length} ошибок за последний час! Запускаю AI-анализ...`);
      runAnalysis('diagnose', true);
    }
  }, [errorLogs]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_analysis_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Map the database response to our interface
      const mappedData: HistoryEntry[] = (data || []).map((item: {
        id: string;
        created_at: string;
        analysis: string;
        recommendations: unknown;
        code_examples: unknown;
        error_count: number;
        pattern_count: number;
        trigger_type: string;
      }) => ({
        id: item.id,
        created_at: item.created_at,
        analysis: item.analysis,
        recommendations: (item.recommendations as Recommendation[]) || [],
        code_examples: (item.code_examples as CodeExample[]) || [],
        error_count: item.error_count,
        pattern_count: item.pattern_count,
        trigger_type: item.trigger_type
      }));
      
      setHistory(mappedData);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const runAnalysis = async (action: 'diagnose' | 'autofix', autoTrigger = false) => {
    setLoading(true);
    setMode(action);
    setResult(null);
    setCompareResult(null);
    
    try {
      // First run diagnostics
      const { data: diagData, error: diagError } = await supabase.functions.invoke("run-diagnostics", {
        body: { action: action === 'autofix' ? 'fix' : 'scan' }
      });
      
      if (diagError) throw diagError;

      // Then run AI analysis
      const { data: aiData, error: aiError } = await supabase.functions.invoke("analyze-errors", {
        body: { autoTrigger }
      });
      
      if (aiError) throw aiError;
      
      if (aiData.error) {
        toast.error(aiData.error);
        return;
      }
      
      const combinedResult: AnalysisResult = {
        ...aiData,
        diagnostics: diagData
      };
      
      setResult(combinedResult);
      
      // Save to history
      const { error: saveError } = await supabase
        .from('ai_analysis_history')
        .insert({
          analysis: aiData.analysis || '',
          recommendations: aiData.recommendations || [],
          code_examples: aiData.codeExamples || [],
          error_count: aiData.summary?.total || 0,
          pattern_count: aiData.summary?.patterns || 0,
          trigger_type: autoTrigger ? 'auto' : 'manual'
        });
      
      if (saveError) {
        console.error("Failed to save to history:", saveError);
      } else {
        fetchHistory();
      }
      
      toast.success(action === 'autofix' ? "🔧 AI-анализ и автофикс завершены!" : "🧠 AI-диагностика завершена!");
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("Ошибка анализа");
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
      `[${e.severity.toUpperCase()}] ${e.error_type}: ${e.error_message}\nИсточник: ${e.source || 'Неизвестно'}\nВремя: ${e.created_at}\n`
    ).join('\n---\n');
    
    const fullReport = `# Отчёт об ошибках APLink
Сгенерировано: ${new Date().toISOString()}
Всего ошибок: ${errorLogs.length}

## Последние 50 ошибок:

${errorsSummary}

${result ? `## AI-анализ:
${result.analysis}

## Рекомендации:
${result.recommendations?.map((r, i) => 
  `${i+1}. [${r.priority.toUpperCase()}] ${r.errorType}\n   Проблема: ${r.problem}\n   Решение: ${r.solution}${r.file ? `\n   Файл: ${r.file}` : ''}`
).join('\n\n') || 'Нет рекомендаций'}` : ''}`;

    navigator.clipboard.writeText(fullReport);
    toast.success("📋 Все ошибки скопированы для отправки в Lovable!");
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    if (comparingId === entry.id) {
      setComparingId(null);
      setCompareResult(null);
    } else {
      setComparingId(entry.id);
      setCompareResult(entry);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-500 border-red-500/30";
      case "medium": return "bg-amber-500/20 text-amber-500 border-amber-500/30";
      case "low": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI-диагностика и мониторинг
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={copyAllErrors}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Скопировать всё
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="w-4 h-4" />
              История
            </Button>
            <Button
              onClick={() => runAnalysis('diagnose')}
              disabled={loading}
              size="sm"
              className="gap-2"
            >
              {loading && mode === 'diagnose' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Диагностика
            </Button>
            <Button
              onClick={() => runAnalysis('autofix')}
              disabled={loading}
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {loading && mode === 'autofix' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              Автофикс
            </Button>
            <Button
              onClick={onClearOldLogs}
              disabled={clearingLogs}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              {clearingLogs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Очистка
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* History Panel */}
        {showHistory && (
          <div className="p-4 bg-card/50 rounded-lg border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                История анализов
              </h4>
              {historyLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет сохранённых анализов</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map(entry => (
                  <div 
                    key={entry.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      comparingId === entry.id 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-border/50 hover:border-border'
                    }`}
                    onClick={() => loadHistoryEntry(entry)}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span>{format(new Date(entry.created_at), 'dd MMM HH:mm', { locale: ru })}</span>
                        <Badge variant="outline" className="text-xs">
                          {entry.trigger_type === 'auto' ? '🤖 Авто' : '👤 Ручной'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{entry.error_count} ошибок</span>
                        <span className="text-muted-foreground">{entry.pattern_count} паттернов</span>
                      </div>
                    </div>
                    {comparingId === entry.id && (
                      <p className="mt-2 text-xs text-purple-400">Нажмите ещё раз чтобы скрыть</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comparison View */}
        {compareResult && (
          <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30 space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-purple-400">
              <BarChart3 className="w-4 h-4" />
              Сравнение с анализом от {format(new Date(compareResult.created_at), 'dd MMM HH:mm', { locale: ru })}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Ошибок тогда:</p>
                <p className="text-lg font-bold">{compareResult.error_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Ошибок сейчас:</p>
                <p className="text-lg font-bold">{result?.summary?.total || errorLogs.length}</p>
              </div>
            </div>
            <div className="p-3 bg-card/50 rounded-lg">
              <p className="text-sm">{compareResult.analysis}</p>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="text-center py-6">
            <Brain className="w-12 h-12 mx-auto mb-3 text-purple-400/50" />
            <p className="text-muted-foreground">
              AI проанализирует все ошибки и выполнит диагностику системы
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Автоматический запуск при 10+ ошибках в час
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            <span className="ml-3 text-muted-foreground">
              {mode === 'autofix' ? 'Запускаю AI-анализ и автофикс...' : 'Запускаю AI-диагностику...'}
            </span>
          </div>
        )}

        {result && (
          <>
            {/* Diagnostics Summary */}
            {result.diagnostics && (
              <div className="p-4 bg-card/50 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" />
                    Результаты диагностики
                  </h4>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                      ✅ {result.diagnostics.summary.ok}
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-500/20 text-amber-500">
                      ⚠️ {result.diagnostics.summary.warnings}
                    </Badge>
                    <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                      ❌ {result.diagnostics.summary.errors}
                    </Badge>
                  </div>
                </div>
                
                {result.diagnostics.fixes.length > 0 && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg mb-3">
                    <p className="font-medium text-green-500 mb-2">Применённые фиксы:</p>
                    <ul className="text-sm space-y-1">
                      {result.diagnostics.fixes.map((fix, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {result.diagnostics.results
                    .filter(r => r.status !== 'ok')
                    .map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {getStatusIcon(r.status)}
                        <div>
                          <span className="font-medium">{r.name}:</span>
                          <span className="text-muted-foreground ml-1">{r.message}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* AI Analysis Summary */}
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{result.summary.total} ошибок</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Code className="w-4 h-4 text-blue-500" />
                <span>{result.summary.patterns} паттернов</span>
              </div>
            </div>

            {/* Analysis */}
            <div className="p-3 bg-card/50 rounded-lg border border-border/50">
              <p className="text-sm">{result.analysis}</p>
            </div>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Рекомендации:</h4>
                {result.recommendations.map((rec, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-lg border ${getPriorityColor(rec.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                          {rec.priority === "high" ? "🔴 Важно" : 
                           rec.priority === "medium" ? "🟡 Средне" : "🔵 Низкий"}
                        </Badge>
                        <span className="font-mono text-xs">{rec.errorType}</span>
                      </div>
                      {rec.file && (
                        <span className="text-xs text-muted-foreground">{rec.file}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{rec.problem}</p>
                    <p className="text-sm text-muted-foreground">{rec.solution}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Code Examples */}
            {result.codeExamples && result.codeExamples.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Примеры кода:</h4>
                {result.codeExamples.map((example, i) => (
                  <div key={i} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{example.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCode(example.code, i)}
                        className="h-6 px-2"
                      >
                        {copiedIndex === i ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <pre className="p-3 bg-gray-900 rounded-lg text-xs overflow-x-auto">
                      <code className="text-green-400">{example.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {result.recommendations?.length === 0 && (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span>Критических проблем не обнаружено!</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default UnifiedAIDiagnostics;
