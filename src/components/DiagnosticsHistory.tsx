import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { 
  History, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  User,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wrench,
  Send
} from "lucide-react";

interface DiagnosticsResult {
  category: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fixable?: boolean;
}

interface DiagnosticsSummary {
  total: number;
  ok: number;
  warnings: number;
  errors: number;
}

interface DiagnosticsRecord {
  id: string;
  created_at: string;
  trigger_type: string;
  summary: DiagnosticsSummary;
  results: DiagnosticsResult[];
  fixes: string[];
  telegram_sent: boolean;
  run_by: string | null;
}

const DiagnosticsHistory = () => {
  const [history, setHistory] = useState<DiagnosticsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<DiagnosticsRecord | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("diagnostics_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Type cast the data
      const typedData = (data || []).map(item => ({
        ...item,
        summary: item.summary as unknown as DiagnosticsSummary,
        results: item.results as unknown as DiagnosticsResult[],
        fixes: (item.fixes as unknown as string[]) || [],
      }));
      
      setHistory(typedData);
    } catch (error) {
      console.error("Failed to load diagnostics history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (summary: DiagnosticsSummary) => {
    if (summary.errors > 0) {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="w-3 h-3 mr-1" />
          {summary.errors} ошибок
        </Badge>
      );
    }
    if (summary.warnings > 0) {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {summary.warnings} предупр.
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle className="w-3 h-3 mr-1" />
        Всё ОК
      </Badge>
    );
  };

  const getTriggerBadge = (type: string) => {
    switch (type) {
      case 'scheduled':
      case 'cron':
        return (
          <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Авто
          </Badge>
        );
      case 'manual':
      default:
        return (
          <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            <User className="w-3 h-3 mr-1" />
            Ручной
          </Badge>
        );
    }
  };

  const getResultIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-white/10">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            История диагностик
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>История диагностик пуста</p>
              <p className="text-sm mt-1">Запустите первую диагностику</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="p-4 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors cursor-pointer border border-white/5 hover:border-white/10"
                    onClick={() => {
                      setSelectedRecord(record);
                      setShowDetails(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {formatDate(record.created_at)}
                        </span>
                        {getTriggerBadge(record.trigger_type)}
                      </div>
                      {getStatusBadge(record.summary)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {record.summary.ok}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                        {record.summary.warnings}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-400" />
                        {record.summary.errors}
                      </span>
                      {record.fixes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-blue-400" />
                          {record.fixes.length} фиксов
                        </span>
                      )}
                      {record.telegram_sent && (
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3 text-blue-400" />
                          Telegram
                        </span>
                      )}
                    </div>
                    
                    {record.run_by && (
                      <div className="mt-2 text-xs text-gray-500">
                        Запустил: {record.run_by}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl bg-gray-900 border border-white/10 text-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Детали диагностики
              {selectedRecord && (
                <span className="text-sm font-normal text-gray-400 ml-2">
                  {formatDate(selectedRecord.created_at)}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 rounded-lg bg-gray-800">
                  <div className="text-2xl font-bold text-white">{selectedRecord.summary.total}</div>
                  <div className="text-xs text-gray-400">Всего</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/20">
                  <div className="text-2xl font-bold text-green-400">{selectedRecord.summary.ok}</div>
                  <div className="text-xs text-gray-400">ОК</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/20">
                  <div className="text-2xl font-bold text-yellow-400">{selectedRecord.summary.warnings}</div>
                  <div className="text-xs text-gray-400">Предупр.</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/20">
                  <div className="text-2xl font-bold text-red-400">{selectedRecord.summary.errors}</div>
                  <div className="text-xs text-gray-400">Ошибки</div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-300">Результаты проверок:</h4>
                <div className="space-y-2">
                  {selectedRecord.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        result.status === 'error' ? 'bg-red-500/10 border-red-500/30' :
                        result.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-green-500/10 border-green-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getResultIcon(result.status)}
                        <span className="font-medium">{result.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {result.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{result.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fixes Applied */}
              {selectedRecord.fixes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-400" />
                    Применённые исправления:
                  </h4>
                  <ul className="space-y-1">
                    {selectedRecord.fixes.map((fix, idx) => (
                      <li key={idx} className="text-sm text-gray-400 flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        {fix}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t border-white/10">
                {getTriggerBadge(selectedRecord.trigger_type)}
                {selectedRecord.telegram_sent && (
                  <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    <Send className="w-3 h-3 mr-1" />
                    Отправлено в Telegram
                  </Badge>
                )}
                {selectedRecord.run_by && (
                  <span>Запустил: {selectedRecord.run_by}</span>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DiagnosticsHistory;
