import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  MessageCircle, 
  Loader2, 
  CheckCircle,
  ExternalLink,
  Copy,
  Settings,
  AlertTriangle
} from "lucide-react";

interface TelegramSetupCardProps {
  publishedUrl: string;
}

const TelegramSetupCard = ({ publishedUrl }: TelegramSetupCardProps) => {
  const [loading, setLoading] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username?: string; first_name?: string } | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-telegram-webapp", {
        body: { 
          action: "setup",
          webAppUrl: publishedUrl,
        },
      });

      if (error) throw error;

      if (data.success) {
        setBotInfo(data.bot);
        setSetupComplete(true);
        toast.success("✅ Telegram Mini App настроен!");
      } else {
        throw new Error(data.error || "Setup failed");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      toast.error("Ошибка настройки: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-telegram-webapp", {
        body: { action: "getInfo" },
      });

      if (error) throw error;

      if (data.success) {
        setBotInfo(data.bot);
      }
    } catch (err) {
      console.error("Failed to get bot info:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyBotLink = () => {
    if (botInfo?.username) {
      navigator.clipboard.writeText(`https://t.me/${botInfo.username}`);
      toast.success("Ссылка скопирована!");
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/20">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          Telegram Mini App
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-400">
          Настройте бота для открытия APLink как Mini App прямо в Telegram.
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">URL приложения</Label>
          <Input 
            value={publishedUrl}
            readOnly
            className="bg-gray-800/50 border-gray-600 text-gray-300"
          />
        </div>

        {botInfo && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Бот подключён</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-white font-medium">@{botInfo.username}</span>
              <span className="text-gray-400">({botInfo.first_name})</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyBotLink}
                className="bg-transparent border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Copy className="w-3 h-3 mr-1" />
                Копировать ссылку
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`https://t.me/${botInfo.username}`, "_blank")}
                className="bg-transparent border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Открыть бота
              </Button>
            </div>
          </div>
        )}

        {setupComplete && (
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Инструкция</span>
            </div>
            <ol className="list-decimal list-inside text-gray-300 space-y-1">
              <li>Откройте бота в Telegram</li>
              <li>Нажмите кнопку меню "🎥 Открыть APLink"</li>
              <li>Приложение откроется внутри Telegram!</li>
            </ol>
          </div>
        )}

        {!setupComplete && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Важно</span>
            </div>
            <p className="text-gray-300">
              Убедитесь, что токен бота правильно настроен в секретах проекта (TELEGRAM_BOT_TOKEN).
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Настройка...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4 mr-2" />
                {setupComplete ? "Перенастроить" : "Настроить Mini App"}
              </>
            )}
          </Button>
          
          {!botInfo && (
            <Button
              onClick={handleGetInfo}
              disabled={loading}
              variant="outline"
              className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Проверить бота
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TelegramSetupCard;
