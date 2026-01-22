import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Phone, 
  Loader2, 
  UserPlus, 
  AtSign, 
  AlertCircle, 
  History, 
  X, 
  Star,
  Check
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QuickCallHistoryItem {
  id: string;
  target_username: string;
  target_user_id: string | null;
  room_name: string;
  status: string;
  created_at: string;
}

interface QuickCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickCallDialog = ({ open, onOpenChange }: QuickCallDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<QuickCallHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [addingToContacts, setAddingToContacts] = useState<string | null>(null);
  const [contactsSet, setContactsSet] = useState<Set<string>>(new Set());
  const [lastCalledUsername, setLastCalledUsername] = useState<string | null>(null);
  const [lastCalledUserId, setLastCalledUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      loadCallHistory();
      loadExistingContacts();
    }
  }, [open, user]);

  const loadCallHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("quick_call_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (fetchError) throw fetchError;
      setCallHistory(data || []);
    } catch (err) {
      console.error("Error loading call history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadExistingContacts = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("contacts")
        .select("contact_user_id")
        .eq("user_id", user.id);

      if (data) {
        setContactsSet(new Set(data.map(c => c.contact_user_id)));
      }
    } catch (err) {
      console.error("Error loading contacts:", err);
    }
  };

  const handleQuickCall = async (targetUsername?: string) => {
    console.log("[QuickCallDialog] handleQuickCall called", { 
      userId: user?.id, 
      targetUsername 
    });
    
    if (!user?.id) {
      console.error("[QuickCallDialog] No user authenticated");
      toast.error("Необходимо авторизоваться");
      return;
    }

    const cleanUsername = (targetUsername || username).replace(/^@/, "").trim().toLowerCase();
    
    if (!cleanUsername) {
      setError("Введите имя пользователя");
      return;
    }

    setCalling(true);
    setError(null);

    console.log("[QuickCallDialog] Invoking telegram-group-call for:", cleanUsername);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("telegram-group-call", {
        body: {
          created_by: user.id,
          participants: [cleanUsername],
          notify_creator_on_error: true,
        },
      });

      console.log("[QuickCallDialog] Response:", { data, error: fnError });

      if (fnError) {
        console.error("[QuickCallDialog] Function error:", fnError);
        throw fnError;
      }

      if (data.success) {
        const participant = data.participants[0];
        
        // Save to call history
        await supabase.from("quick_call_history").insert({
          user_id: user.id,
          target_username: cleanUsername,
          target_user_id: participant.user_id || null,
          room_name: data.room_name,
          status: participant.status,
        });

        setLastCalledUsername(cleanUsername);
        setLastCalledUserId(participant.user_id || null);
        
        if (participant.status === "notified") {
          toast.success(`Звонок @${cleanUsername} - уведомление отправлено!`);
          onOpenChange(false);
          navigate(`/room/${data.room_name}`);
        } else if (participant.status === "no_telegram") {
          setError(`Пользователь @${cleanUsername} не привязал Telegram`);
        } else {
          setError(`Не удалось уведомить @${cleanUsername}`);
        }
      } else {
        console.error("[QuickCallDialog] Call failed:", data.error);
        throw new Error(data.error || "Ошибка создания звонка");
      }
    } catch (err: unknown) {
      console.error("[QuickCallDialog] Catch block:", err);
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast.error("Ошибка: " + message);
    } finally {
      setCalling(false);
    }
  };

  const addToContacts = async (targetUsername: string, targetUserId: string | null) => {
    if (!user || !targetUserId) {
      toast.error("Невозможно добавить в контакты");
      return;
    }

    if (contactsSet.has(targetUserId)) {
      toast.info("Контакт уже добавлен");
      return;
    }

    setAddingToContacts(targetUsername);

    try {
      const { error: insertError } = await supabase.from("contacts").insert({
        user_id: user.id,
        contact_user_id: targetUserId,
        nickname: null,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          toast.info("Контакт уже добавлен");
        } else {
          throw insertError;
        }
      } else {
        toast.success(`@${targetUsername} добавлен в контакты`);
        setContactsSet(prev => new Set([...prev, targetUserId]));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + message);
    } finally {
      setAddingToContacts(null);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      await supabase.from("quick_call_history").delete().eq("id", id);
      setCallHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Error deleting history item:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !calling) {
      handleQuickCall();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "notified":
        return <Check className="w-3 h-3 text-green-400" />;
      case "no_telegram":
        return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      default:
        return <X className="w-3 h-3 text-red-400" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    return date.toLocaleDateString("ru-RU");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Быстрый звонок
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 px-2 ${showHistory ? 'bg-primary/10 text-primary' : ''}`}
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="w-4 h-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            {showHistory 
              ? "История недавних звонков" 
              : "Введите имя пользователя для мгновенного звонка через Telegram"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {showHistory ? (
            <ScrollArea className="h-[280px]">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">История звонков пуста</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {callHistory.map((item) => {
                    const isInContacts = item.target_user_id && contactsSet.has(item.target_user_id);
                    
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className="text-sm font-medium truncate">
                              @{item.target_username}
                            </span>
                            {isInContacts && (
                              <Star className="w-3 h-3 text-primary fill-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.target_user_id && !isInContacts && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => addToContacts(item.target_username, item.target_user_id)}
                              disabled={addingToContacts === item.target_username}
                            >
                              {addingToContacts === item.target_username ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-primary"
                            onClick={() => handleQuickCall(item.target_username)}
                            disabled={calling}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteHistoryItem(item.id)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          ) : (
            <>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                  autoFocus
                  disabled={calling}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-destructive">{error}</p>
                    {lastCalledUserId && !contactsSet.has(lastCalledUserId) && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary mt-1"
                        onClick={() => addToContacts(lastCalledUsername!, lastCalledUserId)}
                        disabled={addingToContacts !== null}
                      >
                        {addingToContacts ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <UserPlus className="w-3 h-3 mr-1" />
                        )}
                        Добавить в контакты
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {callHistory.length > 0 && !error && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Недавние:</p>
                  <div className="flex flex-wrap gap-1">
                    {callHistory.slice(0, 5).map((item) => (
                      <Button
                        key={item.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setUsername(item.target_username)}
                      >
                        {getStatusIcon(item.status)}
                        @{item.target_username}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Пользователь получит уведомление в Telegram с приглашением в комнату
              </p>
            </>
          )}
        </div>

        {!showHistory && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={calling}
            >
              Отмена
            </Button>
            <Button
              onClick={() => handleQuickCall()}
              disabled={calling || !username.trim()}
              className="gap-2"
            >
              {calling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Звоним...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Позвонить
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickCallDialog;
