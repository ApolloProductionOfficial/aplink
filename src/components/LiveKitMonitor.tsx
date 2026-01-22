import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  Users, 
  Video, 
  Wifi, 
  RefreshCw, 
  Server, 
  HardDrive,
  Radio,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface RoomInfo {
  name: string;
  sid: string;
  participants: number;
  publishers: number;
  createdAt: string | null;
  recording: boolean;
}

interface LiveKitStats {
  activeRooms: number;
  totalParticipants: number;
  totalPublishers: number;
  activeRecordings: number;
  rooms: RoomInfo[];
  resources: {
    estimatedRamMB: number;
    estimatedBandwidthMbps: number;
    serverCapacity: {
      maxParticipantsEstimate: number;
      utilizationPercent: number;
    };
  };
  timestamp: string;
}

export function LiveKitMonitor() {
  const [stats, setStats] = useState<LiveKitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke("livekit-stats");
      
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      
      setStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch stats";
      setError(message);
      console.error("[LiveKitMonitor] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 10000); // 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDuration = (createdAt: string | null) => {
    if (!createdAt) return "N/A";
    const start = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}ч ${mins % 60}м`;
    return `${mins}м`;
  };

  const getUtilizationColor = (percent: number) => {
    if (percent < 30) return "text-green-500";
    if (percent < 70) return "text-yellow-500";
    return "text-red-500";
  };

  if (loading && !stats) {
    return (
      <Card className="glass-dark">
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Загрузка статистики LiveKit...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-dark border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="w-5 h-5 text-primary" />
            LiveKit Server Monitor
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "text-primary" : "text-muted-foreground"}
            >
              <Activity className="w-4 h-4 mr-1" />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {stats && (
          <p className="text-xs text-muted-foreground">
            Обновлено: {new Date(stats.timestamp).toLocaleTimeString("ru-RU")}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}
        
        {stats && (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Video className="w-3 h-3" />
                  Комнаты
                </div>
                <p className="text-2xl font-bold text-primary">{stats.activeRooms}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="w-3 h-3" />
                  Участники
                </div>
                <p className="text-2xl font-bold text-green-500">{stats.totalParticipants}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Radio className="w-3 h-3" />
                  Стримят
                </div>
                <p className="text-2xl font-bold text-blue-500">{stats.totalPublishers}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Wifi className="w-3 h-3" />
                  Записи
                </div>
                <p className="text-2xl font-bold text-orange-500">{stats.activeRecordings}</p>
              </div>
            </div>
            
            {/* Resource Usage */}
            <div className="p-4 rounded-lg bg-background/30 border border-border/30 space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Использование ресурсов
              </h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">RAM (оценка)</span>
                  <span className={getUtilizationColor(stats.resources.serverCapacity.utilizationPercent)}>
                    {stats.resources.estimatedRamMB} MB / 128 GB
                  </span>
                </div>
                <Progress 
                  value={stats.resources.serverCapacity.utilizationPercent} 
                  className="h-2"
                />
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Bandwidth (оценка)</span>
                <span className="text-blue-400">
                  ~{stats.resources.estimatedBandwidthMbps.toFixed(1)} Mbps
                </span>
              </div>
              
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Макс. участников (оценка)</span>
                <span className="text-green-400">
                  ~{stats.resources.serverCapacity.maxParticipantsEstimate}
                </span>
              </div>
            </div>
            
            {/* Active Rooms List */}
            {stats.rooms.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Активные комнаты</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.rooms.map((room) => (
                    <div 
                      key={room.sid}
                      className="p-3 rounded-lg bg-background/40 border border-border/40 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm truncate text-foreground">
                          {room.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(room.createdAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {room.participants}
                        </Badge>
                        {room.recording && (
                          <Badge variant="destructive" className="text-xs animate-pulse">
                            REC
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {stats.rooms.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Нет активных комнат</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default LiveKitMonitor;
