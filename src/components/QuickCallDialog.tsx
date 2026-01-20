import { useState } from "react";
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
import { Phone, Loader2, UserPlus, AtSign, AlertCircle } from "lucide-react";

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

  const handleQuickCall = async () => {
    if (!user) {
      toast.error("Необходимо авторизоваться");
      return;
    }

    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    
    if (!cleanUsername) {
      setError("Введите имя пользователя");
      return;
    }

    setCalling(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("telegram-group-call", {
        body: {
          created_by: user.id,
          participants: [cleanUsername],
          notify_creator_on_error: true, // Новый флаг для уведомления об ошибках
        },
      });

      if (fnError) throw fnError;

      if (data.success) {
        const participant = data.participants[0];
        
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
        throw new Error(data.error || "Ошибка создания звонка");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError(message);
      toast.error("Ошибка: " + message);
    } finally {
      setCalling(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !calling) {
      handleQuickCall();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            Быстрый звонок
          </DialogTitle>
          <DialogDescription>
            Введите имя пользователя для мгновенного звонка через Telegram
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
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
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Пользователь получит уведомление в Telegram с приглашением в комнату
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={calling}
          >
            Отмена
          </Button>
          <Button
            onClick={handleQuickCall}
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
                <UserPlus className="w-4 h-4" />
                Позвонить
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCallDialog;
