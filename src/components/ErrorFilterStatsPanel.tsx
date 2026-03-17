import { useState } from 'react';
import { getErrorFilterStats, resetErrorFilterStats, type ErrorFilterStats } from '@/utils/errorFilterStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Bug, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export default function ErrorFilterStatsPanel() {
  const [stats, setStats] = useState<ErrorFilterStats>(getErrorFilterStats());
  const [expanded, setExpanded] = useState(false);

  const refresh = () => setStats({ ...getErrorFilterStats() });
  const reset = () => {
    resetErrorFilterStats();
    refresh();
  };

  const total = stats.filtered + stats.forwarded;
  const filterRate = total > 0 ? Math.round((stats.filtered / total) * 100) : 0;
  const uptime = Math.round((Date.now() - stats.since) / 60000);

  const topPatterns = Object.entries(stats.filteredByPattern)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Фильтр шума расширений
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh} title="Обновить">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-green-500">{stats.filtered}</div>
            <div className="text-[10px] text-muted-foreground">Отфильтровано</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-500">{stats.forwarded}</div>
            <div className="text-[10px] text-muted-foreground">Реальных</div>
          </div>
          <div>
            <div className="text-lg font-bold text-primary">{filterRate}%</div>
            <div className="text-[10px] text-muted-foreground">Фильтрация</div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground text-center">
          Сессия: {uptime} мин • Всего: {total}
        </div>

        {/* Expanded: pattern breakdown */}
        {expanded && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="text-xs font-medium text-muted-foreground">Топ паттернов</div>
            {topPatterns.length === 0 ? (
              <div className="text-xs text-muted-foreground/60 text-center py-2">Нет данных</div>
            ) : (
              <div className="space-y-1">
                {topPatterns.map(([pattern, count]) => (
                  <div key={pattern} className="flex items-center justify-between text-xs">
                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]">{pattern}</code>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{count}</Badge>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-2" onClick={reset}>
              <Bug className="w-3 h-3 mr-1.5" />
              Сбросить счётчики
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
