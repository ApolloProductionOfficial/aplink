import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from "recharts";
import { MessageCircle, Users, Phone, TrendingUp, Loader2, Smartphone, Activity, Clock, UserPlus } from "lucide-react";

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
  users: number;
}

interface ActionStats {
  action: string;
  count: number;
}

interface HourlyStats {
  hour: string;
  count: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const TelegramMiniAppAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dailyActivity, setDailyActivity] = useState<DailyStats[]>([]);
  const [actionStats, setActionStats] = useState<ActionStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [todayActive, setTodayActive] = useState(0);
  const [weekActive, setWeekActive] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [groupCalls, setGroupCalls] = useState(0);
  const [newUsersToday, setNewUsersToday] = useState(0);
  const [avgSessionDuration, setAvgSessionDuration] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);

  useEffect(() => {
    loadActivityData();
  }, []);

  const loadActivityData = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs, error } = await supabase
        .from("telegram_activity_log")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      const activities = (logs || []) as ActivityLog[];
      setRecentActivity(activities.slice(0, 20));

      // Calculate daily activity with unique users
      const dailyMap = new Map<string, { count: number; users: Set<number> }>();
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStart = weekAgo.toISOString().split("T")[0];
      
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyMap.set(dateStr, { count: 0, users: new Set() });
      }

      activities.forEach((log) => {
        const date = new Date(log.created_at).toISOString().split("T")[0];
        const existing = dailyMap.get(date) || { count: 0, users: new Set() };
        existing.count++;
        if (log.telegram_id) existing.users.add(log.telegram_id);
        dailyMap.set(date, existing);
      });

      const dailyData = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
          count: data.count,
          users: data.users.size,
        }));

      setDailyActivity(dailyData);

      // Calculate hourly distribution
      const hourlyMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, 0);
      }
      activities.forEach((log) => {
        const hour = new Date(log.created_at).getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      });
      const hourlyData = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          count,
        }));
      setHourlyStats(hourlyData);

      // Calculate action stats
      const actionMap = new Map<string, number>();
      activities.forEach((log) => {
        actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
      });

      const actionData = Array.from(actionMap.entries())
        .map(([action, count]) => ({ action: formatAction(action), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      setActionStats(actionData);

      // Calculate stats
      const uniqueTelegramIds = new Set(activities.filter(a => a.telegram_id).map(a => a.telegram_id));
      setTotalUsers(uniqueTelegramIds.size);

      const todayActivities = activities.filter(a => 
        new Date(a.created_at).toISOString().split("T")[0] === today
      );
      const todayUnique = new Set(todayActivities.filter(a => a.telegram_id).map(a => a.telegram_id));
      setTodayActive(todayUnique.size);

      const weekActivities = activities.filter(a => 
        new Date(a.created_at).toISOString().split("T")[0] >= weekStart
      );
      const weekUnique = new Set(weekActivities.filter(a => a.telegram_id).map(a => a.telegram_id));
      setWeekActive(weekUnique.size);

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

      // Calculate new users today (users who had their first activity today)
      const firstActivityMap = new Map<number, string>();
      activities.forEach((log) => {
        if (log.telegram_id) {
          const date = new Date(log.created_at).toISOString().split("T")[0];
          const existing = firstActivityMap.get(log.telegram_id);
          if (!existing || date < existing) {
            firstActivityMap.set(log.telegram_id, date);
          }
        }
      });
      const newToday = Array.from(firstActivityMap.values()).filter(date => date === today).length;
      setNewUsersToday(newToday);

    } catch (error) {
      console.error("Error loading activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string): string => {
    const map: Record<string, string> = {
      "bot_command": "Команды бота",
      "group_call_created": "Создание звонка",
      "group_call_declined": "Отклонено",
      "group_call_accepted": "Принято",
      "app_opened": "Открытие Mini App",
      "call_started": "Звонки",
      "profile_view": "Просмотр профиля",
      "settings_changed": "Изменение настроек",
    };
    return map[action] || action.replace(/_/g, " ");
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Только что";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    return `${diffDays} дн. назад`;
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
      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Всего пользователей</p>
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
                <p className="text-2xl font-bold text-foreground">{todayActive}</p>
                <p className="text-xs text-muted-foreground">Активных сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{weekActive}</p>
                <p className="text-xs text-muted-foreground">Активных за неделю</p>
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
                <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
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
                <p className="text-2xl font-bold text-foreground">{groupCalls}</p>
                <p className="text-xs text-muted-foreground">Групповых звонков</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/20">
                <UserPlus className="w-5 h-5 text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{newUsersToday}</p>
                <p className="text-xs text-muted-foreground">Новых сегодня</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Активность Mini App за 30 дней
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity}>
                <defs>
                  <linearGradient id="colorTelegramActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTelegramUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
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
                  fill="url(#colorTelegramActivity)"
                  name="Действия"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#colorTelegramUsers)"
                  name="Уникальных пользователей"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Активность по часам
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis 
                    dataKey="hour" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={9}
                    interval={2}
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
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Действия" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Action Distribution */}
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
      </div>

      {/* Recent Activity */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Последние действия в Mini App
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {recentActivity.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-center gap-3 text-sm border-b border-border/30 pb-2 last:border-0"
              >
                <Badge variant="outline" className="shrink-0 text-xs">
                  {formatAction(activity.action)}
                </Badge>
                {activity.telegram_id && (
                  <span className="text-muted-foreground">
                    TG:{activity.telegram_id}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {formatTimeAgo(activity.created_at)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramMiniAppAnalytics;
