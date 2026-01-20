import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone,
  PhoneMissed,
  Loader2,
  RefreshCw,
  Clock,
  User,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface MissedCall {
  id: string;
  call_request_id: string;
  telegram_id: number | null;
  status: string;
  invited_at: string;
  call_request: {
    room_name: string;
    is_group_call: boolean;
    created_by: string | null;
    created_at: string;
    status: string;
    creator_profile?: {
      display_name: string | null;
      username: string | null;
    } | null;
  } | null;
}

const MissedCallsHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingBack, setCallingBack] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadMissedCalls();
    }
  }, [user]);

  const loadMissedCalls = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get user's telegram_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.telegram_id) {
        setMissedCalls([]);
        setLoading(false);
        return;
      }

      // Get missed/declined/expired calls for this user
      const { data: participants, error } = await supabase
        .from("call_participants")
        .select(`
          id,
          call_request_id,
          telegram_id,
          status,
          invited_at
        `)
        .eq("telegram_id", profile.telegram_id)
        .in("status", ["invited", "declined"])
        .order("invited_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get call request details
      const callRequestIds = participants?.map(p => p.call_request_id) || [];
      
      if (callRequestIds.length === 0) {
        setMissedCalls([]);
        setLoading(false);
        return;
      }

      const { data: callRequests } = await supabase
        .from("call_requests")
        .select("id, room_name, is_group_call, created_by, created_at, status")
        .in("id", callRequestIds);

      // Get creator profiles
      const creatorIds = callRequests?.map(c => c.created_by).filter(Boolean) || [];
      const { data: creatorProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", creatorIds);

      // Combine data
      const enrichedCalls: MissedCall[] = (participants || []).map(p => {
        const callRequest = callRequests?.find(c => c.id === p.call_request_id);
        const creatorProfile = creatorProfiles?.find(
          cp => cp.user_id === callRequest?.created_by
        );
        
        return {
          ...p,
          call_request: callRequest ? {
            ...callRequest,
            creator_profile: creatorProfile || null,
          } : null,
        };
      }).filter(c => c.call_request !== null);

      setMissedCalls(enrichedCalls);
    } catch (err) {
      console.error("Error loading missed calls:", err);
      toast.error("Ошибка загрузки пропущенных звонков");
    } finally {
      setLoading(false);
    }
  };

  const handleCallback = async (creatorUserId: string, creatorUsername?: string | null) => {
    if (!user || !creatorUserId) return;

    // Get creator's username if not provided
    let username = creatorUsername;
    if (!username) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", creatorUserId)
        .single();
      username = profile?.username;
    }

    if (!username) {
      toast.error("Невозможно перезвонить - пользователь не найден");
      return;
    }

    setCallingBack(creatorUserId);

    try {
      const { data, error } = await supabase.functions.invoke("telegram-group-call", {
        body: {
          created_by: user.id,
          participants: [username],
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Звонок @${username} - уведомление отправлено!`);
        navigate(`/room/${data.room_name}`);
      } else {
        throw new Error(data.error || "Ошибка создания звонка");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + message);
    } finally {
      setCallingBack(null);
    }
  };

  const getCallerName = (call: MissedCall) => {
    if (call.call_request?.creator_profile?.display_name) {
      return call.call_request.creator_profile.display_name;
    }
    if (call.call_request?.creator_profile?.username) {
      return `@${call.call_request.creator_profile.username}`;
    }
    return "Неизвестный";
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneMissed className="w-5 h-5 text-destructive" />
            Пропущенные звонки
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <PhoneMissed className="w-5 h-5 text-destructive" />
            Пропущенные звонки
            {missedCalls.length > 0 && (
              <span className="bg-destructive/20 text-destructive text-xs px-2 py-0.5 rounded-full">
                {missedCalls.length}
              </span>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMissedCalls}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {missedCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <PhoneMissed className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет пропущенных звонков</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-2">
              {missedCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 hover:bg-background/80 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    {call.call_request?.is_group_call ? (
                      <Users className="w-5 h-5 text-destructive" />
                    ) : (
                      <User className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {getCallerName(call)}
                      </span>
                      {call.status === "declined" && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                          Отклонён
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(call.invited_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                      {call.call_request?.is_group_call && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Групповой
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleCallback(
                      call.call_request?.created_by || "",
                      call.call_request?.creator_profile?.username
                    )}
                    disabled={callingBack === call.call_request?.created_by || !call.call_request?.created_by}
                  >
                    {callingBack === call.call_request?.created_by ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                    Перезвонить
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default MissedCallsHistory;
