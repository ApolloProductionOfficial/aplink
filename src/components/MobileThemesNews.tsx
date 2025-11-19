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
    <div className="lg:hidden px-3 py-6 bg-card/20 backdrop-blur-sm">
      <div className="grid grid-cols-2 gap-3">
        {/* Левая колонка - Темы */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <Briefcase className="h-3.5 w-3.5" />
            {t.sidebar.themes}
          </h2>
          <div className="space-y-1.5">
            {themes.map((theme, index) => (
              <button
                key={index}
                onClick={() => navigate(theme.path)}
                className="w-full text-left px-2.5 py-2 rounded-md bg-card/60 hover:bg-card border border-border/40 transition-all duration-200 hover:scale-[1.02]"
              >
                <span className="text-[11px] font-medium leading-tight line-clamp-2">
                  {theme.title}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Правая колонка - Новости */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
            <Newspaper className="h-3.5 w-3.5" />
            {newsTitle}
          </h2>
          <div className="space-y-1.5">
            {news && news.length > 0 ? (
              news.map((item) => (
                <a
                  key={item.id}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-2.5 py-2 rounded-md bg-card/60 hover:bg-card border border-border/40 transition-all duration-200 hover:scale-[1.02]"
                >
                  <h3 className="text-[11px] font-medium leading-tight line-clamp-2 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-[9px] text-muted-foreground line-clamp-1">
                    {item.source || 'News'}
                  </p>
                </a>
              ))
            ) : (
              <div className="px-2.5 py-3 rounded-md bg-card/40 border border-border/30">
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
