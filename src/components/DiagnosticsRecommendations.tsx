import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Lightbulb, Wrench, ExternalLink, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface DiagnosticResult {
  category: string;
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  fixable?: boolean;
  fixAction?: string;
  details?: Record<string, unknown>;
}

interface DiagnosticsRecommendationsProps {
  results: DiagnosticResult[];
  onOpenLogs?: () => void;
}

const DiagnosticsRecommendations = ({ results, onOpenLogs }: DiagnosticsRecommendationsProps) => {
  // Get only non-OK results
  const issues = results.filter(r => r.status !== "ok");
  
  if (issues.length === 0) {
    return (
      <Card className="bg-green-500/10 border-green-500/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-medium text-green-500">Всё в порядке!</p>
              <p className="text-sm text-muted-foreground">
                Диагностика не выявила проблем. Система работает стабильно.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate recommendations based on issue type
  const getRecommendation = (result: DiagnosticResult): { 
    title: string; 
    description: string; 
    actions: string[];
    canAutofix: boolean;
    severity: "high" | "medium" | "low";
  } => {
    const details = result.details || {};
    
    // Error rate issues
    if (result.name.includes("Error Rate") || result.name.includes("Error Spike")) {
      return {
        title: "Повышенная частота ошибок",
        description: "Система фиксирует больше ошибок, чем обычно. Это может указывать на проблемы с внешними сервисами или ошибки в коде.",
        actions: [
          "Проверьте вкладку 'Последние ошибки' ниже для деталей",
          "Убедитесь, что все API-ключи актуальны (ElevenLabs, Telegram)",
          "Проверьте сетевое соединение и доступность внешних сервисов",
          "Если ошибки связаны с Jitsi — проверьте настройки CORS"
        ],
        canAutofix: false,
        severity: result.status === "error" ? "high" : "medium"
      };
    }

    // Recurring error patterns
    if (result.name.includes("Recurring Error") || result.name.includes("Error Pattern")) {
      const recommendations = (details.recommendations as string[]) || [];
      return {
        title: "Повторяющиеся ошибки",
        description: "Обнаружены ошибки, которые происходят многократно. Автофикс может очистить старые логи, но не устранит причину.",
        actions: [
          ...recommendations,
          "Автофикс удалит старые логи (7+ дней), но НЕ исправит код",
          "Для устранения причины нужно проанализировать паттерны ошибок"
        ],
        canAutofix: true,
        severity: "medium"
      };
    }

    // Stuck presence
    if (result.name.includes("Presence") || result.name.includes("Online Status")) {
      return {
        title: "Застрявшие статусы онлайн",
        description: "Некоторые пользователи отображаются онлайн, хотя они неактивны более 30 минут.",
        actions: [
          "Автофикс пометит их как offline",
          "Это безопасная операция, не влияет на реальных пользователей"
        ],
        canAutofix: true,
        severity: "low"
      };
    }

    // Stuck participants
    if (result.name.includes("Participant") && result.name.includes("Stuck")) {
      return {
        title: "Незакрытые сессии участников",
        description: "Есть участники, которые присоединились к звонку более 24 часов назад, но не покинули его.",
        actions: [
          "Автофикс пометит их как покинувших звонок",
          "Это очистит данные и улучшит статистику"
        ],
        canAutofix: true,
        severity: "low"
      };
    }

    // Telegram sync issues
    if (result.name.includes("Telegram")) {
      return {
        title: "Проблемы синхронизации с Telegram",
        description: "Некоторые уведомления об ошибках не были отправлены в Telegram.",
        actions: [
          "Проверьте, что REPORTS_BOT_TOKEN настроен корректно",
          "Убедитесь, что бот не заблокирован",
          "Запустите диагностику повторно — она отправит отчёт в Telegram"
        ],
        canAutofix: false,
        severity: "medium"
      };
    }

    // Translation history
    if (result.name.includes("Translation")) {
      return {
        title: "Большой объём истории переводов",
        description: "Накопилось много записей в истории переводов. Это может замедлить работу.",
        actions: [
          "Автофикс удалит переводы старше 30 дней",
          "Это освободит место и ускорит запросы к БД"
        ],
        canAutofix: true,
        severity: "low"
      };
    }

    // Empty transcripts
    if (result.name.includes("Transcript")) {
      return {
        title: "Встречи без транскриптов",
        description: "Есть записи о встречах, но транскрипты не были сохранены.",
        actions: [
          "Это может быть нормально для коротких звонков",
          "Проверьте, работает ли сервис транскрипции (ElevenLabs/Whisper)"
        ],
        canAutofix: false,
        severity: "low"
      };
    }

    // Default recommendation
    return {
      title: result.name,
      description: result.message,
      actions: [
        result.fixable ? "Автофикс может помочь с этой проблемой" : "Требуется ручное вмешательство"
      ],
      canAutofix: result.fixable || false,
      severity: result.status === "error" ? "high" : "medium"
    };
  };

  return (
    <Card className="bg-amber-500/10 border-amber-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Что делать, если автофикс не помогает?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-card/50 rounded-lg border border-border/50">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Автофикс выполняет только очистку:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Удаляет старые логи ошибок (7+ дней)</li>
                <li>Исправляет застрявшие статусы онлайн</li>
                <li>Закрывает незавершённые сессии участников</li>
                <li>Очищает старую историю переводов</li>
              </ul>
              <p className="mt-2 text-amber-500">
                ⚠️ Автофикс НЕ исправляет ошибки в коде и НЕ решает проблемы с внешними сервисами!
              </p>
            </div>
          </div>
        </div>

        <Accordion type="multiple" className="w-full">
          {issues.map((issue, i) => {
            const rec = getRecommendation(issue);
            return (
              <AccordionItem key={i} value={`issue-${i}`} className="border-border/50">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    {issue.status === "error" ? (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span>{rec.title}</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${
                        rec.severity === "high" ? "bg-red-500/20 text-red-500" :
                        rec.severity === "medium" ? "bg-amber-500/20 text-amber-500" :
                        "bg-blue-500/20 text-blue-500"
                      }`}
                    >
                      {rec.severity === "high" ? "Важно" : rec.severity === "medium" ? "Внимание" : "Инфо"}
                    </Badge>
                    {rec.canAutofix && (
                      <Badge variant="outline" className="bg-green-500/20 text-green-500">
                        <Wrench className="w-3 h-3 mr-1" />
                        Автофикс
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Рекомендуемые действия:</p>
                      <ul className="space-y-1.5">
                        {rec.actions.map((action, j) => (
                          <li key={j} className="text-sm flex items-start gap-2">
                            <span className="text-primary">→</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {onOpenLogs && (
          <Button variant="outline" size="sm" onClick={onOpenLogs} className="w-full gap-2">
            <ExternalLink className="w-4 h-4" />
            Посмотреть детальные логи
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagnosticsRecommendations;
