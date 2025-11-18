import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";

const Sidebar = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  const [activeTheme, setActiveTheme] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const themes = [
    {
      title: t.sidebar.cryptoUnlock.title,
      description: t.sidebar.cryptoUnlock.description,
      route: "/crypto-unlock"
    },
    {
      title: t.sidebar.trafficSources.title,
      description: t.sidebar.trafficSources.description,
      route: "/traffic-sources"
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
    <aside className="fixed left-0 top-[120px] bottom-0 w-80 bg-card/95 backdrop-blur-md border-r border-border overflow-y-auto p-6 hidden lg:block z-40">
      <div className="space-y-6">
        {/* Theme Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{t.sidebar.themes}</span>
            <div className="flex gap-2">
              {themes.map((_, i) => (
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
            <h3 className="text-lg font-semibold mb-3">{themes[activeTheme].title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {themes[activeTheme].description}
            </p>
            <Button
              onClick={() => {
                playClickSound();
                window.location.href = themes[activeTheme].route;
              }}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {t.sidebar.more}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
