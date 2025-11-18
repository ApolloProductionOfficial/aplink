import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ManualNewsFetch = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-adult-news');

      if (error) throw error;

      toast({
        title: "Успешно!",
        description: `Добавлено ${data.count} новост${data.count === 1 ? 'ь' : data.count < 5 ? 'и' : 'ей'}`,
      });
    } catch (error) {
      console.error('Error fetching news:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить новости",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={fetchNews}
      disabled={isLoading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Загрузка...' : 'Обновить новости'}
    </Button>
  );
};

export default ManualNewsFetch;
