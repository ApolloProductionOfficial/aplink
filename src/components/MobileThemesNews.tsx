import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Briefcase, Newspaper } from "lucide-react";

const MobileThemesNews = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const themes = [
    { title: t.sidebar.cryptoUnlock.title, path: '/crypto-unlock' },
    { title: t.sidebar.trafficSources.title, path: '/traffic-sources' },
    { title: t.sidebar.modelVerification.title, path: '/model-verification' },
    { title: t.sidebar.partnership.title, path: '/partnership-program' },
    { title: t.modelRecruitment?.title || "Набор моделей", path: '/model-recruitment' },
    { title: t.sidebar.dubaiResidency.title, path: '/dubai-residency' },
  ];

  const { data: news } = useQuery({
    queryKey: ['news', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
  });

  const newsTitle = language === 'ru' ? 'Новости' : language === 'uk' ? 'Новини' : 'News';

  return (
    <div className="lg:hidden px-3 py-6 bg-card/30 backdrop-blur-md border-y border-border/30">
      <div className="grid grid-cols-2 gap-0 divide-x divide-border/50">
        {/* Левая колонка - Темы */}
        <div className="pr-2.5 space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-border/30">
            <Briefcase className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {t.sidebar.themes}
            </h2>
          </div>
          <div className="space-y-2">
            {themes.map((theme, index) => (
              <button
                key={index}
                onClick={() => navigate(theme.path)}
                className="w-full text-left px-2.5 py-2.5 rounded-lg bg-card/80 hover:bg-card border border-border/50 transition-all duration-200 hover:border-primary/50 shadow-sm"
              >
                <span className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground">
                  {theme.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Правая колонка - Новости */}
        <div className="pl-2.5 space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b border-border/30">
            <Newspaper className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              {newsTitle}
            </h2>
          </div>
          <div className="space-y-2">
            {news && news.length > 0 ? (
              news.map((item) => (
                <a
                  key={item.id}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-2.5 py-2.5 rounded-lg bg-card/80 hover:bg-card border border-border/50 transition-all duration-200 hover:border-primary/50 shadow-sm"
                >
                  <h3 className="text-[11px] font-medium leading-tight line-clamp-2 mb-1.5 text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-[9px] text-muted-foreground">
                    {item.source || 'News'}
                  </p>
                </a>
              ))
            ) : (
              <div className="px-2.5 py-4 rounded-lg bg-card/50 border border-border/30">
                <p className="text-[10px] text-muted-foreground text-center">
                  {language === 'ru' ? 'Новостей пока нет' : language === 'uk' ? 'Новин поки немає' : 'No news yet'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileThemesNews;
