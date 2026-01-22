import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingDown, Clock, RefreshCw, AlertTriangle, ArrowRight, LogOut } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ExitPageData {
  path: string;
  exits: number;
  totalViews: number;
  exitRate: number;
}

interface SessionDuration {
  entryPage: string;
  avgDuration: number;
  sessions: number;
}

interface RoomFunnel {
  step: string;
  count: number;
  percentage: number;
}

interface ShortSession {
  sessionId: string;
  duration: number;
  pages: string[];
  timestamp: string;
}

type TabType = "exits" | "duration" | "funnel" | "anomalies";

export default function UXAnomaliesPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("exits");
  const [loading, setLoading] = useState(true);
  const [exitPages, setExitPages] = useState<ExitPageData[]>([]);
  const [sessionDurations, setSessionDurations] = useState<SessionDuration[]>([]);
  const [roomFunnel, setRoomFunnel] = useState<RoomFunnel[]>([]);
  const [shortSessions, setShortSessions] = useState<ShortSession[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadExitPages(),
        loadSessionDurations(),
        loadRoomFunnel(),
        loadShortSessions(),
      ]);
    } catch (err) {
      console.error("Error loading UX data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadExitPages = async () => {
    // Get all page views grouped by session with last page
    const { data, error } = await supabase
      .from("site_analytics")
      .select("session_id, page_path, created_at")
      .eq("event_type", "page_view")
      .order("created_at", { ascending: true });

    if (error || !data) return;

    // Group by session and find exit pages
    const sessionPages: Record<string, { pages: string[]; lastTime: string }> = {};
    data.forEach((row) => {
      const sid = row.session_id || "unknown";
      if (!sessionPages[sid]) {
        sessionPages[sid] = { pages: [], lastTime: row.created_at };
      }
      sessionPages[sid].pages.push(row.page_path || "/");
      if (new Date(row.created_at) > new Date(sessionPages[sid].lastTime)) {
        sessionPages[sid].lastTime = row.created_at;
      }
    });

    // Count exits per page
    const exitCounts: Record<string, number> = {};
    const viewCounts: Record<string, number> = {};

    Object.values(sessionPages).forEach(({ pages }) => {
      const lastPage = pages[pages.length - 1];
      exitCounts[lastPage] = (exitCounts[lastPage] || 0) + 1;
      pages.forEach((p) => {
        viewCounts[p] = (viewCounts[p] || 0) + 1;
      });
    });

    const exitData: ExitPageData[] = Object.keys(exitCounts)
      .map((path) => ({
        path: path.length > 25 ? path.substring(0, 22) + "..." : path,
        exits: exitCounts[path],
        totalViews: viewCounts[path] || 1,
        exitRate: Math.round((exitCounts[path] / (viewCounts[path] || 1)) * 100),
      }))
      .sort((a, b) => b.exits - a.exits)
      .slice(0, 10);

    setExitPages(exitData);
    setTotalSessions(Object.keys(sessionPages).length);
  };

  const loadSessionDurations = async () => {
    const { data, error } = await supabase
      .from("site_analytics")
      .select("session_id, page_path, created_at")
      .eq("event_type", "page_view")
      .order("created_at", { ascending: true });

    if (error || !data) return;

    // Group by session
    const sessions: Record<string, { firstPage: string; firstTime: Date; lastTime: Date }> = {};
    data.forEach((row) => {
      const sid = row.session_id || "unknown";
      const time = new Date(row.created_at);
      if (!sessions[sid]) {
        sessions[sid] = { firstPage: row.page_path || "/", firstTime: time, lastTime: time };
      } else {
        if (time < sessions[sid].firstTime) {
          sessions[sid].firstTime = time;
          sessions[sid].firstPage = row.page_path || "/";
        }
        if (time > sessions[sid].lastTime) {
          sessions[sid].lastTime = time;
        }
      }
    });

    // Calculate avg duration per entry page
    const entryPageDurations: Record<string, { total: number; count: number }> = {};
    Object.values(sessions).forEach(({ firstPage, firstTime, lastTime }) => {
      const duration = (lastTime.getTime() - firstTime.getTime()) / 1000;
      if (!entryPageDurations[firstPage]) {
        entryPageDurations[firstPage] = { total: 0, count: 0 };
      }
      entryPageDurations[firstPage].total += duration;
      entryPageDurations[firstPage].count += 1;
    });

    const durations: SessionDuration[] = Object.entries(entryPageDurations)
      .map(([entryPage, { total, count }]) => ({
        entryPage: entryPage.length > 20 ? entryPage.substring(0, 17) + "..." : entryPage,
        avgDuration: Math.round(total / count),
        sessions: count,
      }))
      .sort((a, b) => a.avgDuration - b.avgDuration)
      .slice(0, 10);

    setSessionDurations(durations);
  };

  const loadRoomFunnel = async () => {
    const { data, error } = await supabase
      .from("site_analytics")
      .select("session_id, page_path")
      .eq("event_type", "page_view");

    if (error || !data) return;

    // Group pages by session
    const sessionPaths: Record<string, Set<string>> = {};
    data.forEach((row) => {
      const sid = row.session_id || "unknown";
      if (!sessionPaths[sid]) sessionPaths[sid] = new Set();
      sessionPaths[sid].add(row.page_path || "/");
    });

    const totalSessions = Object.keys(sessionPaths).length;
    const visitedAuth = Object.values(sessionPaths).filter((s) => s.has("/auth")).length;
    const visitedDashboard = Object.values(sessionPaths).filter((s) => s.has("/dashboard")).length;
    const visitedRoom = Object.values(sessionPaths).filter((s) => 
      Array.from(s).some((p) => p.startsWith("/room"))
    ).length;

    const funnel: RoomFunnel[] = [
      { step: "Все сессии", count: totalSessions, percentage: 100 },
      { step: "/auth", count: visitedAuth, percentage: Math.round((visitedAuth / totalSessions) * 100) || 0 },
      { step: "/dashboard", count: visitedDashboard, percentage: Math.round((visitedDashboard / totalSessions) * 100) || 0 },
      { step: "/room/*", count: visitedRoom, percentage: Math.round((visitedRoom / totalSessions) * 100) || 0 },
    ];

    setRoomFunnel(funnel);
  };

  const loadShortSessions = async () => {
    const { data, error } = await supabase
      .from("site_analytics")
      .select("session_id, page_path, created_at")
      .eq("event_type", "page_view")
      .order("created_at", { ascending: true });

    if (error || !data) return;

    // Group by session
    const sessions: Record<string, { pages: string[]; firstTime: Date; lastTime: Date }> = {};
    data.forEach((row) => {
      const sid = row.session_id || "unknown";
      const time = new Date(row.created_at);
      if (!sessions[sid]) {
        sessions[sid] = { pages: [], firstTime: time, lastTime: time };
      }
      sessions[sid].pages.push(row.page_path || "/");
      if (time < sessions[sid].firstTime) sessions[sid].firstTime = time;
      if (time > sessions[sid].lastTime) sessions[sid].lastTime = time;
    });

    // Find sessions < 10 seconds
    const shortList: ShortSession[] = Object.entries(sessions)
      .map(([sessionId, { pages, firstTime, lastTime }]) => ({
        sessionId: sessionId.substring(0, 12) + "...",
        duration: Math.round((lastTime.getTime() - firstTime.getTime()) / 1000),
        pages,
        timestamp: firstTime.toISOString(),
      }))
      .filter((s) => s.duration < 10 && s.pages.length >= 1)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    setShortSessions(shortList);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}с`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}м ${secs}с`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          UX Аномалии
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{totalSessions} сессий</Badge>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeTab === "exits" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("exits")}
        >
          <LogOut className="w-4 h-4 mr-1" />
          Страницы выхода
        </Button>
        <Button
          variant={activeTab === "duration" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("duration")}
        >
          <Clock className="w-4 h-4 mr-1" />
          Время сессий
        </Button>
        <Button
          variant={activeTab === "funnel" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("funnel")}
        >
          <TrendingDown className="w-4 h-4 mr-1" />
          Воронка /room
        </Button>
        <Button
          variant={activeTab === "anomalies" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("anomalies")}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Короткие сессии
        </Button>
      </div>

      {/* Content */}
      {activeTab === "exits" && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-500" />
              Топ страниц выхода
            </CardTitle>
          </CardHeader>
          <CardContent>
            {exitPages.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={exitPages} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="path" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    formatter={(value: number, name: string) => [value, name === "exits" ? "Выходов" : name]}
                  />
                  <Bar dataKey="exits" radius={[0, 4, 4, 0]}>
                    {exitPages.map((entry, index) => (
                      <Cell key={index} fill={entry.exitRate > 70 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 space-y-2">
              {exitPages.slice(0, 5).map((page, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{page.path}</span>
                  <Badge variant={page.exitRate > 70 ? "destructive" : "secondary"}>
                    {page.exitRate}% выходов
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "duration" && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Среднее время сессии по странице входа
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionDurations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <div className="space-y-3">
                {sessionDurations.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{item.entryPage}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{item.sessions} сессий</Badge>
                      <Badge variant={item.avgDuration < 10 ? "destructive" : "secondary"}>
                        {formatDuration(item.avgDuration)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "funnel" && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-amber-500" />
              Воронка до /room
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roomFunnel.map((step, i) => (
                <div key={i} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{step.step}</span>
                    <span className="text-muted-foreground">{step.count} ({step.percentage}%)</span>
                  </div>
                  <div className="h-8 bg-muted/30 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
                      style={{ width: `${step.percentage}%` }}
                    />
                  </div>
                  {i < roomFunnel.length - 1 && (
                    <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
                      <TrendingDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "anomalies" && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Сессии &lt; 10 секунд
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shortSessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Нет коротких сессий</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {shortSessions.map((session, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{session.sessionId}</span>
                      <div className="text-sm mt-1">
                        {session.pages.slice(0, 3).map((p, j) => (
                          <span key={j}>
                            {j > 0 && <ArrowRight className="w-3 h-3 inline mx-1" />}
                            <code className="text-xs bg-muted px-1 rounded">{p}</code>
                          </span>
                        ))}
                        {session.pages.length > 3 && <span className="text-muted-foreground">...</span>}
                      </div>
                    </div>
                    <Badge variant="destructive">{session.duration}с</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
