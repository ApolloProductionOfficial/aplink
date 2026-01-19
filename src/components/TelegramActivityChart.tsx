import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { MessageCircle, Users, Phone, TrendingUp, Loader2 } from "lucide-react";

interface ActivityLog {
  id: string;
  action: string;
  created_at: string;
  telegram_id: number | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface DailyStats {
  date: string;
  count: number;
}

interface ActionStats {
  action: string;
  count: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const TelegramActivityChart = () => {
  const [loading, setLoading] = useState(true);
  const [dailyActivity, setDailyActivity] = useState<DailyStats[]>([]);
  const [actionStats, setActionStats] = useState<ActionStats[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [todayActive, setTodayActive] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [groupCalls, setGroupCalls] = useState(0);

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    setLoading(true);
    try {
      // Get activity logs for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from("telegram_activity_log")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const activities = (logs || []) as ActivityLog[];

      // Calculate daily activity
      const dailyMap = new Map<string, number>();
      const today = new Date().toISOString().split("T")[0];
      
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyMap.set(dateStr, 0);
      }

      activities.forEach((log) => {
        const date = new Date(log.created_at).toISOString().split("T")[0];
        dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, count]) => ({
          date: new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
          count,
        }));

      setDailyActivity(dailyData);

      // Calculate action stats
      const actionMap = new Map<string, number>();
      activities.forEach((log) => {
        actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
      });

      const actionData = Array.from(actionMap.entries())
        .map(([action, count]) => ({ action: formatAction(action), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setActionStats(actionData);

      // Calculate stats
      const uniqueTelegramIds = new Set(activities.filter(a => a.telegram_id).map(a => a.telegram_id));
      setTotalUsers(uniqueTelegramIds.size);

      const todayActivities = activities.filter(a => 
        new Date(a.created_at).toISOString().split("T")[0] === today
      );
      const todayUnique = new Set(todayActivities.filter(a => a.telegram_id).map(a => a.telegram_id));
      setTodayActive(todayUnique.size);

      // Get call stats
      const { count: callCount } = await supabase
        .from("call_requests")
        .select("*", { count: "exact", head: true });
      setTotalCalls(callCount || 0);

      const { count: groupCount } = await supabase
        .from("call_requests")
        .select("*", { count: "exact", head: true })
        .eq("is_group_call", true);
      setGroupCalls(groupCount || 0);

    } catch (error) {
      console.error("Error loading activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string): string => {
    const map: Record<string, string> = {
      "bot_command": "Команды бота",
      "group_call_created": "Групповые звонки",
      "group_call_declined": "Отклонено",
      "app_opened": "Открытие Mini App",
      "call_started": "Звонки",
    };
    return map[action] || action.replace(/_/g, " ");
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Пользователей Mini App</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{todayActive}</p>
                <p className="text-xs text-muted-foreground">Активных сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Phone className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalCalls}</p>
                <p className="text-xs text-muted-foreground">Всего звонков</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <MessageCircle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{groupCalls}</p>
                <p className="text-xs text-muted-foreground">Групповых звонков</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Активность за 30 дней
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#colorActivity)"
                  name="Действия"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Action Distribution */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Типы действий</CardTitle>
          </CardHeader>
          <CardContent>
            {actionStats.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={actionStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="action"
                    >
                      {actionStats.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Нет данных
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              {actionStats.map((stat, index) => (
                <Badge 
                  key={stat.action} 
                  variant="outline"
                  style={{ borderColor: COLORS[index % COLORS.length], color: COLORS[index % COLORS.length] }}
                >
                  {stat.action}: {stat.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Распределение по типам</CardTitle>
          </CardHeader>
          <CardContent>
            {actionStats.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis 
                      type="category" 
                      dataKey="action" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TelegramActivityChart;
