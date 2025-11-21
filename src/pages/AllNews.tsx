import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Calendar } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string | null;
  source: string | null;
  published_at: string;
}

const AllNews = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { playClickSound } = useButtonSound();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const heroAnim = useScrollAnimation();

  const handleBack = () => {
    playClickSound();
    // На мобильных открываем меню, на десктопе идём на главную
    if (window.innerWidth < 768) {
      const event = new CustomEvent('open-mobile-menu');
      window.dispatchEvent(event);
    } else {
      navigate("/");
    }
  };

  useEffect(() => {
    fetchAllNews();
  }, [language]);

  const fetchAllNews = async () => {
    try {
      setLoading(true);
      
      // First, fetch fresh translated news from the edge function
      const { error: fetchError } = await supabase.functions.invoke('fetch-adult-news', {
        body: { language }
      });

      if (fetchError) {
        console.warn('Could not fetch fresh news:', fetchError);
      }
      
      // Then load news from database
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq('language', language)
        .order("published_at", { ascending: false });

      if (error) throw error;
      if (data) setNews(data);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'uk' ? 'uk-UA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-8 hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {language === 'ru' ? 'Назад' : language === 'uk' ? 'Назад' : 'Back'}
        </Button>

        <div
          ref={heroAnim.elementRef}
          className={`max-w-5xl mx-auto transition-all duration-700 ${
            heroAnim.isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-12'
          }`}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {language === 'ru' ? 'Все новости' : language === 'uk' ? 'Всі новини' : 'All News'}
            </h1>
            <p className="text-xl text-muted-foreground">
              {language === 'ru' 
                ? 'Последние новости адалт индустрии' 
                : language === 'uk' 
                ? 'Останні новини адалт індустрії' 
                : 'Latest adult industry news'}
            </p>
          </div>

          {loading ? (
            <div className="grid gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-muted rounded w-full mb-2"></div>
                  <div className="h-4 bg-muted rounded w-5/6"></div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              {news.map((item, index) => (
                <Card
                  key={item.id}
                  className="p-6 border-2 border-primary/20 bg-card/60 backdrop-blur hover:border-primary/40 transition-all duration-300 hover:shadow-xl"
                  style={{
                    animation: `fade-in 0.5s ease-out ${index * 0.1}s both`
                  }}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(item.published_at)}</span>
                          {item.source && (
                            <>
                              <span>•</span>
                              <span className="text-primary">{item.source}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-foreground">
                          {item.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    {item.url && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto self-start"
                        onClick={() => {
                          playClickSound();
                          window.open(item.url!, "_blank");
                        }}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {language === 'ru' 
                          ? 'Читать полностью' 
                          : language === 'uk' 
                          ? 'Читати повністю' 
                          : 'Read more'}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!loading && news.length === 0 && (
            <Card className="p-12 text-center border-2 border-primary/20 bg-card/60 backdrop-blur">
              <p className="text-xl text-muted-foreground">
                {language === 'ru' 
                  ? 'Новости пока недоступны' 
                  : language === 'uk' 
                  ? 'Новини поки недоступні' 
                  : 'No news available yet'}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllNews;
