import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, TrendingUp, Users, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CallStats {
  total_calls: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  calls_last_week: number;
  calls_last_month: number;
}

interface TopContact {
  target_username: string;
  target_user_id: string | null;
  call_count: number;
  last_called_at: string;
}

const CallStatistics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<CallStats | null>(null);
  const [topContacts, setTopContacts] = useState<TopContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchStats = async () => {
      setLoading(true);
      
      try {
        // Fetch call statistics
        const { data: statsData } = await supabase
          .from("call_statistics")
          .select("*")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        
        if (statsData) {
          setStats(statsData as CallStats);
        } else {
          setStats({
            total_calls: 0,
            total_duration_seconds: 0,
            avg_duration_seconds: 0,
            calls_last_week: 0,
            calls_last_month: 0,
          });
        }
        
        // Fetch top contacts
        const { data: contactsData } = await supabase
          .from("top_contacts")
          .select("*")
          .eq("user_id", user.id)
          .limit(5);
        
        if (contactsData) {
          setTopContacts(contactsData as TopContact[]);
        }
      } catch (err) {
        console.error("Error fetching call statistics:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [user]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)} сек`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}ч ${mins}м`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    
    if (diffDays === 0) return "Сегодня";
    if (diffDays === 1) return "Вчера";
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString("ru-RU");
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 border-primary/10">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Phone className="w-4 h-4" />
              <span className="text-xs">Всего звонков</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {stats?.total_calls || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Общее время</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {formatDuration(stats?.total_duration_seconds || 0)}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">За неделю</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {stats?.calls_last_week || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs">Средняя длительность</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {formatDuration(stats?.avg_duration_seconds || 0)}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Top Contacts */}
      {topContacts.length > 0 && (
        <Card className="bg-card/50 border-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              Частые контакты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topContacts.map((contact, index) => (
                <div
                  key={contact.target_username}
                  className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">@{contact.target_username}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(contact.last_called_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{contact.call_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CallStatistics;
