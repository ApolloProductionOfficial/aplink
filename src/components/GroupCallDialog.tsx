import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, Phone, Loader2, Check, X, MessageCircle } from "lucide-react";

interface Contact {
  id: string;
  contact_user_id: string;
  nickname: string | null;
  profile?: {
    display_name: string | null;
    username: string | null;
    telegram_id: number | null;
  };
}

interface GroupCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GroupCallDialog = ({ open, onOpenChange }: GroupCallDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [results, setResults] = useState<{ username: string; status: string }[] | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedContacts(new Set());
      setResults(null);
      
      // Safely load contacts only when user is authenticated
      if (user?.id) {
        loadContacts();
      } else {
        setLoading(false);
      }
    }
  }, [open, user?.id]);

  const loadContacts = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      const { data: contactsData, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching contacts:", error);
        setLoading(false);
        return;
      }

      // Fetch profiles for each contact
      const contactsWithProfiles = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, username, telegram_id")
            .eq("user_id", contact.contact_user_id)
            .single();

          return {
            ...contact,
            profile: profile || undefined,
          };
        })
      );

      setContacts(contactsWithProfiles);
    } catch (err) {
      console.error("Error loading contacts:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleStartGroupCall = async () => {
    if (!user) {
      toast.error("Необходимо авторизоваться");
      return;
    }
    
    if (selectedContacts.size < 1) {
      toast.error("Выберите хотя бы одного участника");
      return;
    }

    setCalling(true);

    // Get usernames for selected contacts
    const participants = contacts
      .filter((c) => selectedContacts.has(c.id))
      .map((c) => c.profile?.username)
      .filter(Boolean) as string[];

    try {
      const { data, error } = await supabase.functions.invoke("telegram-group-call", {
        body: {
          created_by: user?.id,
          participants,
        },
      });

      if (error) throw error;

      if (data.success) {
        const notifiedCount = data.participants.filter(
          (p: { status: string }) => p.status === "notified"
        ).length;

        setResults(
          data.participants.map((p: { telegram_id: string | null; status: string }, i: number) => ({
            username: participants[i],
            status: p.status,
          }))
        );

        toast.success(
          `Групповой звонок создан! Уведомлено: ${notifiedCount}/${participants.length}`
        );

        // Navigate to room after short delay
        setTimeout(() => {
          onOpenChange(false);
          navigate(`/room/${data.room_name}`);
        }, 2000);
      } else {
        throw new Error(data.error || "Ошибка создания звонка");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка: " + message);
    } finally {
      setCalling(false);
    }
  };

  const telegramContacts = contacts.filter((c) => c.profile?.telegram_id);
  const selectedWithTelegram = contacts
    .filter((c) => selectedContacts.has(c.id) && c.profile?.telegram_id)
    .length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Групповой звонок
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : results ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Результаты отправки уведомлений:
              </p>
              {results.map((r) => (
                <div
                  key={r.username}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50"
                >
                  <span className="text-sm">@{r.username}</span>
                  <div className="flex items-center gap-2">
                    {r.status === "notified" ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-xs text-green-400">Уведомлен</span>
                      </>
                    ) : r.status === "no_telegram" ? (
                      <>
                        <X className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-yellow-400">Нет Telegram</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-xs text-red-400">Ошибка</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Переход в комнату...
              </p>
            </div>
          ) : telegramContacts.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Нет контактов с привязанным Telegram
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Для групповых звонков через Telegram контактам нужно привязать аккаунт
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-muted-foreground mb-3">
                Выберите участников ({telegramContacts.length} с Telegram):
              </p>
              {contacts.map((contact) => {
                const hasTelegram = !!contact.profile?.telegram_id;
                const isSelected = selectedContacts.has(contact.id);

                return (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                      hasTelegram
                        ? isSelected
                          ? "bg-primary/20 border border-primary/40"
                          : "bg-background/50 hover:bg-background/80"
                        : "bg-background/30 opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => hasTelegram && toggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={!hasTelegram}
                      className="pointer-events-none"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {contact.nickname || contact.profile?.display_name || "Пользователь"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.profile?.username && `@${contact.profile.username}`}
                        {!hasTelegram && " • Telegram не привязан"}
                      </p>
                    </div>
                    {hasTelegram && (
                      <MessageCircle className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!results && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={calling}
            >
              Отмена
            </Button>
            <Button
              onClick={handleStartGroupCall}
              disabled={calling || selectedWithTelegram < 1}
              className="gap-2"
            >
              {calling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Начать ({selectedWithTelegram})
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GroupCallDialog;
