import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TrafficSources = () => {
  const { playClickSound } = useButtonSound();
  const navigate = useNavigate();

  const handleBack = () => {
    playClickSound();
    // На мобильных открываем меню, на десктопе идём на главную
    if (window.innerWidth < 768) {
      const event = new CustomEvent('open-mobile-menu');
      window.dispatchEvent(event);
    } else {
      navigate('/');
    }
  };

  const sources = [
    {
      title: "TikTok",
      description: "UGC-сетки, Spark Ads, фермы аккаунтов. Эффективная стратегия для вирусного охвата и привлечения целевой аудитории через короткие видео.",
      features: ["UGC-сетки", "Spark Ads", "Фермы аккаунтов", "Вирусный контент"]
    },
    {
      title: "Instagram",
      description: "Мобильные фермы, рилсы, прогрев, автоворонки и безопасные сетапы для масштабирования вашего присутствия.",
      features: ["Мобильные фермы", "Рилсы", "Stories", "Автоворонки"]
    },
    {
      title: "X (Twitter)",
      description: "NSFW-friendly треды, медиа контент, рост аудитории. Органический рост через активное взаимодействие с сообществом.",
      features: ["NSFW-friendly", "Треды", "Медиа контент", "Рост аудитории"]
    },
    {
      title: "Telegram",
      description: "Лиды в чат, быстрые продажи, SFS и рекламные сетки для моментальной монетизации.",
      features: ["Лиды в чат", "SFS", "Рекламные сетки", "Быстрые продажи"]
    },
    {
      title: "Dating (Tinder)",
      description: "Дейтинговые конверсии с тёплыми диалогами и высокой конверсией. Персональный подход к каждому лиду.",
      features: ["Тёплые диалоги", "Высокая конверсия", "Персональный подход", "Квалифицированные лиды"]
    },
    {
      title: "PPC (Google/Meta)",
      description: "Платная реклама (где возможно), pre-landing страницы, ретаргет и детальная атрибуция для максимальной эффективности.",
      features: ["Google Ads", "Meta Ads", "Pre-landing", "Ретаргетинг"]
    },
    {
      title: "Microsites & SEO",
      description: "Прокладки, индексация, трафик из поиска и контент-кластеры для долгосрочного органического роста.",
      features: ["Microsites", "Индексация", "Контент-кластеры", "Органический трафик"]
    },
    {
      title: "Influencers",
      description: "Коллаборации с инфлюенсерами, взаимные прогревы и перекрёстный трафик для максимального охвата.",
      features: ["Коллаборации", "Взаимный прогрев", "Перекрёстный трафик", "Расширение охвата"]
    },
    {
      title: "Reddit",
      description: "Специальные стратегии для Reddit: органический рост через активное участие в сообществах и создание ценного контента.",
      features: ["Органический рост", "Активное участие", "Ценный контент", "Community building"]
    }
  ];

  useEffect(() => {
    // On entering this page always fully unlock scroll (fix mobile stuck scroll)
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Источники трафика</h1>
          <p className="text-lg text-muted-foreground">
            Полный спектр источников трафика для OnlyFans. Используем все доступные платформы для максимального роста вашего профиля.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
            >
              <h3 className="text-xl font-semibold mb-3">{source.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {source.description}
              </p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary">Ключевые возможности:</p>
                <ul className="space-y-1">
                  {source.features.map((feature, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-card/50 border border-border rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Готовы начать?</h2>
          <p className="text-muted-foreground mb-6">
            Свяжитесь с нами для консультации по выбору оптимальных источников трафика для вашего профиля
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => {
                playClickSound();
                window.open('https://t.me/Apollo_Production', '_blank');
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Консультация по трафику
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                playClickSound();
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
              }}
              className="border-border hover:bg-accent/10"
            >
              Заполнить анкету
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficSources;