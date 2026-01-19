import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, AlertTriangle, CheckCircle, Code, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface AnalysisResult {
  analysis: string;
  recommendations: Recommendation[];
  codeExamples?: CodeExample[];
  summary: {
    total: number;
    patterns: number;
    analyzedAt: string;
  };
}

const AIErrorAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("analyze-errors");
      
      if (error) throw error;
      
      if (data.error) {
        toast.error(data.error);
        return;
      }
      
      setResult(data);
      toast.success("🧠 AI-анализ завершён!");
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/20 text-red-500 border-red-500/30";
      case "medium": return "bg-amber-500/20 text-amber-500 border-amber-500/30";
      case "low": return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI-анализ ошибок
          </CardTitle>
          <Button
            onClick={runAnalysis}
            disabled={loading}
            size="sm"
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
            {loading ? "Анализирую..." : "Запустить анализ"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && !loading && (
          <p className="text-sm text-muted-foreground">
            AI проанализирует последние ошибки и даст конкретные рекомендации по их исправлению.
          </p>
        )}

        {result && (
          <>
            {/* Summary */}
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

export default AIErrorAnalysis;
