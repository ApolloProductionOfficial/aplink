import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  UserPlus, 
  Check, 
  X, 
  Clock, 
  Send, 
  Inbox,
  Loader2,
  Bell
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ContactRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  from_profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  to_profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

interface ContactRequestsPanelProps {
  userId: string;
  onRequestCountChange?: (count: number) => void;
}

export function ContactRequestsPanel({ userId, onRequestCountChange }: ContactRequestsPanelProps) {
  const [incomingRequests, setIncomingRequests] = useState<ContactRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      // Fetch incoming pending requests
      const { data: incoming, error: inError } = await supabase
        .from("contact_requests")
        .select("*")
        .eq("to_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (inError) throw inError;

      // Fetch outgoing requests (all statuses for history)
      const { data: outgoing, error: outError } = await supabase
        .from("contact_requests")
        .select("*")
        .eq("from_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (outError) throw outError;

      // Fetch profiles for incoming requests
      const incomingWithProfiles = await Promise.all(
        (incoming || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("user_id", req.from_user_id)
            .single();
          return { ...req, from_profile: profile };
        })
      );

      // Fetch profiles for outgoing requests
      const outgoingWithProfiles = await Promise.all(
        (outgoing || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username, avatar_url")
            .eq("user_id", req.to_user_id)
            .single();
          return { ...req, to_profile: profile };
        })
      );

      setIncomingRequests(incomingWithProfiles);
      setOutgoingRequests(outgoingWithProfiles);
      
      onRequestCountChange?.(incomingWithProfiles.length);
    } catch (error) {
      console.error("Error fetching contact requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("contact-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
          filter: `to_user_id=eq.${userId}`,
        },
        () => fetchRequests()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_requests",
          filter: `from_user_id=eq.${userId}`,
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from("contact_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) throw error;
      
      toast.success("Запрос принят! Контакт добавлен.");
      fetchRequests();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Ошибка при принятии запроса");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from("contact_requests")
        .update({ status: "declined" })
        .eq("id", requestId);

      if (error) throw error;
      
      toast.success("Запрос отклонён");
      fetchRequests();
    } catch (error) {
      console.error("Error declining request:", error);
      toast.error("Ошибка при отклонении запроса");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from("contact_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
      
      toast.success("Запрос отменён");
      fetchRequests();
    } catch (error) {
      console.error("Error canceling request:", error);
      toast.error("Ошибка при отмене запроса");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
      case "accepted":
        return <Badge variant="outline" className="text-green-500 border-green-500/30"><Check className="w-3 h-3 mr-1" />Принят</Badge>;
      case "declined":
        return <Badge variant="outline" className="text-red-500 border-red-500/30"><X className="w-3 h-3 mr-1" />Отклонён</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card className="glass-dark">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-dark border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="w-5 h-5 text-primary" />
          Запросы в контакты
          {incomingRequests.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {incomingRequests.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="incoming" className="flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              Входящие
              {incomingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {incomingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Исходящие
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming">
            <ScrollArea className="h-[300px]">
              {incomingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Нет входящих запросов</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-3 rounded-lg bg-background/50 border border-border/50 flex items-center gap-3"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.from_profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(request.from_profile?.display_name || request.from_profile?.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {request.from_profile?.display_name || request.from_profile?.username || "Пользователь"}
                        </p>
                        {request.from_profile?.username && (
                          <p className="text-xs text-muted-foreground">@{request.from_profile.username}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ru })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleAccept(request.id)}
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDecline(request.id)}
                          disabled={processingId === request.id}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="outgoing">
            <ScrollArea className="h-[300px]">
              {outgoingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Send className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Нет исходящих запросов</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-3 rounded-lg bg-background/50 border border-border/50 flex items-center gap-3"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.to_profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {(request.to_profile?.display_name || request.to_profile?.username || "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {request.to_profile?.display_name || request.to_profile?.username || "Пользователь"}
                        </p>
                        {request.to_profile?.username && (
                          <p className="text-xs text-muted-foreground">@{request.to_profile.username}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ru })}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        {request.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancel(request.id)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ContactRequestsPanel;
