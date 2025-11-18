import { useTranslation } from "@/hooks/useTranslation";
import { Calendar, ExternalLink } from "lucide-react";

interface NewsItem {
  id: number;
  title: string;
  description: string;
  date: string;
  source?: string;
  url?: string;
}

const NewsWidget = () => {
  const { t, language } = useTranslation();

  // Временные новости для демонстрации
  const demoNews: NewsItem[] = [
    {
      id: 1,
      title: language === 'ru' ? "OnlyFans достиг новых рекордов" : language === 'uk' ? "OnlyFans досяг нових рекордів" : "OnlyFans hits new records",
      description: language === 'ru' ? "Платформа зафиксировала рост на 25% в этом квартале" : language === 'uk' ? "Платформа зафіксувала зростання на 25% цього кварталу" : "Platform recorded 25% growth this quarter",
      date: new Date().toLocaleDateString(language),
      source: "Industry News"
    },
    {
      id: 2,
      title: language === 'ru' ? "Новые правила контента" : language === 'uk' ? "Нові правила контенту" : "New content guidelines",
      description: language === 'ru' ? "Обновленные политики для создателей контента" : language === 'uk' ? "Оновлені політики для творців контенту" : "Updated policies for content creators",
      date: new Date(Date.now() - 86400000).toLocaleDateString(language),
      source: "Platform Updates"
    },
    {
      id: 3,
      title: language === 'ru' ? "TikTok трафик растет" : language === 'uk' ? "TikTok трафік зростає" : "TikTok traffic grows",
      description: language === 'ru' ? "Новые возможности для продвижения моделей" : language === 'uk' ? "Нові можливості для просування моделей" : "New opportunities for model promotion",
      date: new Date(Date.now() - 172800000).toLocaleDateString(language),
      source: "Traffic Insights"
    }
  ];

  const newsTitle = language === 'ru' ? "Новости адалт индустрии" : language === 'uk' ? "Новини адалт індустрії" : "Adult Industry News";
  const comingSoonText = language === 'ru' ? "Скоро: автоматические новости из Telegram" : language === 'uk' ? "Скоро: автоматичні новини з Telegram" : "Coming soon: Auto news from Telegram";

  return (
    <aside className="fixed right-0 top-[120px] bottom-0 w-80 bg-card/95 backdrop-blur-md border-l border-border overflow-y-auto p-6 hidden xl:block z-40">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{newsTitle}</h3>
          <p className="text-xs text-muted-foreground italic">{comingSoonText}</p>
        </div>

        {/* News List */}
        <div className="space-y-4">
          {demoNews.map((news) => (
            <div 
              key={news.id} 
              className="bg-card/50 border border-border rounded-lg p-4 hover:border-primary/30 transition-all duration-300 group"
            >
              {/* Date */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="h-3 w-3" />
                <span>{news.date}</span>
                {news.source && (
                  <span className="ml-auto text-primary/70">{news.source}</span>
                )}
              </div>

              {/* Title */}
              <h4 className="font-semibold text-sm mb-2 group-hover:text-primary transition-colors">
                {news.title}
              </h4>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {news.description}
              </p>

              {/* Link (if available) */}
              {news.url && (
                <a 
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  {language === 'ru' ? 'Читать далее' : language === 'uk' ? 'Читати далі' : 'Read more'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Coming Soon Badge */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 text-center">
          <p className="text-xs text-foreground/80">
            🤖 {language === 'ru' ? 'Интеграция с Telegram ботом' : language === 'uk' ? 'Інтеграція з Telegram ботом' : 'Telegram bot integration'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {language === 'ru' ? 'Автоматическая публикация новостей' : language === 'uk' ? 'Автоматична публікація новин' : 'Automatic news publishing'}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default NewsWidget;
