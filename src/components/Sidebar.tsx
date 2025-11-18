import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";

const Sidebar = () => {
  const { playClickSound } = useButtonSound();
  const [activeTheme, setActiveTheme] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const themes = [
    {
      title: "Источники трафика",
      subtitle: "Все платформы",
      description: "Полный спектр источников трафика для OnlyFans: TikTok (UGC-сетки, Spark Ads, фермы), Instagram (мобильные фермы, рилсы, автоворонки), X/Twitter (NSFW-friendly треды, рост аудитории), Telegram (лиды в чат, SFS, рекламные сетки), Dating (Tinder - тёплые диалоги с высокой конверсией), PPC (Google/Meta, pre-landing, ретаргет), Microsites/SEO (прокладки, индексация, контент-кластеры), Influencers (коллаборации, взаимный прогрев), Reddit (специальные стратегии).",
      links: [
        { text: "Консультация по трафику", url: "https://t.me/Apollo_Production" },
        { text: "Полный аудит", url: "https://t.me/Apollo_Production" }
      ]
    },
    {
      title: "TikTok & Instagram",
      subtitle: "Социальные сети",
      description: "UGC-сетки, Spark Ads, фермы для Instagram. Мобильные фермы, рилсы, прогрев, автоворонки и безопасные сетапы для масштабирования вашего присутствия.",
      links: [
        { text: "Консультация по TikTok", url: "https://t.me/Apollo_Production" },
        { text: "Настройка Instagram", url: "https://t.me/Apollo_Production" }
      ]
    },
    {
      title: "X (Twitter) & Telegram",
      subtitle: "Мессенджеры и микроблоги",
      description: "NSFW-friendly треды, медиа контент, рост аудитории. Telegram: лиды в чат, быстрые продажи, SFS и рекламные сетки для моментальной монетизации.",
      links: [
        { text: "Telegram стратегия", url: "https://t.me/Apollo_Production" },
        { text: "X (Twitter) настройка", url: "https://t.me/Apollo_Production" }
      ]
    },
    {
      title: "Dating & PPC",
      subtitle: "Платный трафик",
      description: "Дейтинговые конверсии в офферы (Tinder и др.) с тёплыми диалогами. Google/Meta реклама (где возможно), pre-landing, ретаргет и детальная атрибуция.",
      links: [
        { text: "Настройка Dating", url: "https://t.me/Apollo_Production" },
        { text: "Запуск PPC кампаний", url: "https://t.me/Apollo_Production" }
      ]
    },
    {
      title: "SEO & Коллаборации",
      subtitle: "Органический рост",
      description: "Microsites, индексация, трафик из поиска и контент-кластеры. Коллаборации с инфлюенсерами, взаимные прогревы и перекрёстный трафик для максимального охвата.",
      links: [
        { text: "SEO оптимизация", url: "https://t.me/Apollo_Production" },
        { text: "Поиск коллабораций", url: "https://t.me/Apollo_Production" }
      ]
    }
  ];


  const handleThemeChange = (newTheme: number) => {
    playClickSound();
    setDirection(newTheme > activeTheme ? 'next' : 'prev');
    setActiveTheme(newTheme);
  };

  const handlePrev = () => {
    playClickSound();
    setDirection('prev');
    setActiveTheme((prev) => (prev === 0 ? themes.length - 1 : prev - 1));
  };

  const handleNext = () => {
    playClickSound();
    setDirection('next');
    setActiveTheme((prev) => (prev === themes.length - 1 ? 0 : prev + 1));
  };

  return (
    <aside className="fixed left-0 top-[92px] bottom-0 w-80 bg-card border-r border-border overflow-y-auto p-6 hidden lg:block">
      <div className="space-y-6">
        {/* Theme Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Темы</span>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  onClick={() => handleThemeChange(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    activeTheme === i ? 'bg-primary scale-125' : 'bg-muted hover:bg-muted-foreground'
                  }`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handlePrev}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ‹
              </button>
              <button 
                onClick={handleNext}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Active Theme Content */}
        <div className="space-y-4 overflow-hidden">
          <div
            key={activeTheme}
            className={`animate-fade-in ${
              direction === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'
            }`}
          >
            <p className="text-xs text-muted-foreground mb-2">{themes[activeTheme].title}</p>
            <h3 className="text-lg font-semibold mb-2">{themes[activeTheme].subtitle}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {themes[activeTheme].description}
            </p>
            <div className="flex flex-col gap-2">
              {themes[activeTheme].links.map((link, i) => (
                <Button
                  key={i}
                  onClick={() => {
                    playClickSound();
                    window.open(link.url, '_blank');
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {link.text}
                </Button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
};

export default Sidebar;
