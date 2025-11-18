import { useState } from "react";
import { Button } from "@/components/ui/button";

const Sidebar = () => {
  const [activeTheme, setActiveTheme] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const themes = [
    {
      title: "5 лет на рынке",
      subtitle: "О нас",
      description: "Помогали открывать агентства, собрали лучший опыт и ошибки — строим своё OnlyFans‑агентство полного цикла. Вы — создаёте, мы — масштабируем.",
      links: [
        { text: "Связаться в Telegram", url: "https://t.me/Apollo_Production" },
        { text: "Анкета для моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform" }
      ]
    },
    {
      title: "5 лет на рынке",
      subtitle: "О нас",
      description: "Помогали открывать агентства, собрали лучший опыт и ошибки — строим своё OnlyFans‑агентство полного цикла. Вы — создаёте, мы — масштабируем.",
      links: [
        { text: "Связаться в Telegram", url: "https://t.me/Apollo_Production" },
        { text: "Анкета для моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform" }
      ]
    },
    {
      title: "5 лет на рынке",
      subtitle: "О нас",
      description: "Помогали открывать агентства, собрали лучший опыт и ошибки — строим своё OnlyFans‑агентство полного цикла. Вы — создаёте, мы — масштабируем.",
      links: [
        { text: "Связаться в Telegram", url: "https://t.me/Apollo_Production" },
        { text: "Анкета для моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform" }
      ]
    },
    {
      title: "5 лет на рынке",
      subtitle: "О нас",
      description: "Помогали открывать агентства, собрали лучший опыт и ошибки — строим своё OnlyFans‑агентство полного цикла. Вы — создаёте, мы — масштабируем.",
      links: [
        { text: "Связаться в Telegram", url: "https://t.me/Apollo_Production" },
        { text: "Анкета для моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform" }
      ]
    }
  ];

  const quickLinks = [
    { text: "Разблокировка крипты (Fansly)", url: "/#/onlyfans" },
    { text: "Telegram", url: "https://t.me/Apollo_Production" },
    { text: "Консалтинг", url: "https://t.me/Apollo_Production" },
    { text: "Запуск", url: "https://t.me/Apollo_Production" },
    { text: "Анкета для новых моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform" },
    { text: "Telegram‑группа", url: "https://t.me/MenuOnly4Friends" }
  ];

  const handleThemeChange = (newTheme: number) => {
    setDirection(newTheme > activeTheme ? 'next' : 'prev');
    setActiveTheme(newTheme);
  };

  const handlePrev = () => {
    setDirection('prev');
    setActiveTheme((prev) => (prev === 0 ? themes.length - 1 : prev - 1));
  };

  const handleNext = () => {
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
                  onClick={() => window.open(link.url, '_blank')}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {link.text}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Быстрые ссылки</h4>
          <ul className="space-y-2">
            {quickLinks.map((link, i) => (
              <li key={i}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Recruitment CTA */}
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Рекрут моделей открыт — заполните анкету и получите стартовый план.
          </p>
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank')}
          >
            Заполнить анкету
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
