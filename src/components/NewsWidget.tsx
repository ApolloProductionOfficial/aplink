import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Calendar, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ManualNewsFetch from "./ManualNewsFetch";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url?: string;
  published_at: string;
}

const NewsWidget = () => {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNews();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('news-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'news'
        },
        (payload) => {
          console.log('New news item:', payload);
          setNews(prev => [payload.new as NewsItem, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [language]);

  const fetchNews = async () => {
    setIsLoading(true);
    try {
      // First, fetch fresh translated news from the edge function
      const { error: fetchError } = await supabase.functions.invoke('fetch-adult-news', {
        body: { language }
      });

      if (fetchError) {
        console.warn('Could not fetch fresh news:', fetchError);
      }

      // Then load news from database
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      const errorTitle = language === 'ru' ? "Ошибка" : language === 'uk' ? "Помилка" : "Error";
      const errorDesc = language === 'ru' ? "Не удалось загрузить новости" : language === 'uk' ? "Не вдалося завантажити новини" : "Failed to load news";
      toast({
        title: errorTitle,
        description: errorDesc,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const newsTitle = language === 'ru' 
    ? "Новости адалт индустрии" 
    : language === 'uk' 
    ? "Новини адалт індустрії" 
    : "Adult Industry News";
  const loadingText = language === 'ru' ? "Загрузка новостей..." : language === 'uk' ? "Завантаження новин..." : "Loading news...";
  const noNewsText = language === 'ru' ? "Пока нет новостей" : language === 'uk' ? "Поки немає новин" : "No news yet";
 
  return (
    <aside 
      data-news-widget
      className="fixed right-0 top-[120px] bottom-0 w-80 bg-card/95 backdrop-blur-md border-l border-border overflow-y-auto p-6 hidden xl:block z-40"
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="text-lg font-semibold text-foreground leading-tight">{newsTitle}</h3>
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">
              {language === 'ru' ? 'Обновляется автоматически 2 раза в день' : language === 'uk' ? 'Оновлюється автоматично 2 рази на день' : 'Auto-updates twice daily'}
            </p>
            <ManualNewsFetch />
          </div>
        </div>

        {/* News List */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">{loadingText}</p>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">{noNewsText}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {news.map((item) => {
              const NewsCard = item.url ? 'a' : 'div';
              const linkProps = item.url ? {
                href: item.url,
                target: "_blank",
                rel: "noopener noreferrer"
              } : {};
              
              return (
                <NewsCard
                  key={item.id}
                  {...linkProps}
                  className="bg-card/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-all duration-300 group cursor-pointer block no-underline"
                >
                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(item.published_at).toLocaleDateString(language)}</span>
                    {item.source && (
                      <span className="ml-auto text-primary/70">{item.source}</span>
                    )}
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </NewsCard>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};

export default NewsWidget;
