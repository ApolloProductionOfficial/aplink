import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

const ManualNewsFetch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useTranslation();

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-adult-news', {
        body: { language }
      });

      if (error) throw error;

      const successTitle = language === 'ru' ? "Успешно!" : language === 'uk' ? "Успішно!" : "Success!";
      const successDesc = language === 'ru' 
        ? `Добавлено ${data.count} новост${data.count === 1 ? 'ь' : data.count < 5 ? 'и' : 'ей'}` 
        : language === 'uk' 
        ? `Додано ${data.count} новин` 
        : `Added ${data.count} news items`;

      toast({
        title: successTitle,
        description: successDesc,
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      const errorTitle = language === 'ru' ? "Ошибка" : language === 'uk' ? "Помилка" : "Error";
      const errorDesc = language === 'ru' ? "Не удалось загрузить новости" : language === 'uk' ? "Не вдалося завантажити новини" : "Failed to fetch news";
      toast({
        title: errorTitle,
        description: errorDesc,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText = isLoading 
    ? (language === 'ru' ? 'Загрузка...' : language === 'uk' ? 'Завантаження...' : 'Loading...')
    : (language === 'ru' ? 'Обновить новости' : language === 'uk' ? 'Оновити новини' : 'Refresh news');

  return (
    <Button
      onClick={fetchNews}
      disabled={isLoading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {buttonText}
    </Button>
  );
};

export default ManualNewsFetch;
