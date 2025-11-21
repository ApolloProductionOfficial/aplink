import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { HandshakeIcon, Unlock, Shield, Users, TrendingUp } from "lucide-react";

const Sidebar = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    },
    {
      title: t.sidebar.instagramAutomation?.title || "Автоматизация и Софты",
      description: t.sidebar.instagramAutomation?.description || "Instagram ферм для трафика на OnlyFans",
      route: "/instagram-automation"
    },
    {
      title: t.sidebar.modelVerification.title,
      description: t.sidebar.modelVerification.description,
      route: "/model-verification"
    },
    {
      title: t.modelRecruitment?.title || "Набор моделей",
      description: t.modelRecruitment?.subtitle || "Ищем моделей для работы на всех платформах: OnlyFans, Fansly, MYM, 4based и других",
      route: "/model-recruitment"
    },
    {
      title: t.sidebar.partnership.title,
      description: t.sidebar.partnership.description,
      route: "/partnership-program"
    },
    {
      title: t.sidebar.dubaiResidency.title,
      description: t.sidebar.dubaiResidency.description,
      route: "/dubai-residency"
    },
    {
      title: t.sidebar.webcamServices.title,
      description: t.sidebar.webcamServices.description,
      route: "/webcam-services"
    }
  ];

  const quickLinks = [
    { 
      text: t.rightSidebar.partnership40, 
      url: "/partnership-program", 
      highlight: true, 
      internal: true,
      icon: HandshakeIcon,
      color: 'from-primary/30 to-primary/20'
    },
    { 
      text: t.rightSidebar.cryptoUnlock, 
      url: "/crypto-unlock", 
      highlight: true, 
      internal: true,
      icon: Unlock,
      color: 'from-primary/30 to-primary/20'
    },
    { 
      text: t.rightSidebar.verificationRF, 
      url: "/model-verification", 
      highlight: true, 
      internal: true,
      icon: Shield,
      color: 'from-primary/20 to-primary/10'
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

        {/* Quick Links */}
        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center border border-primary/40 shadow-lg shadow-primary/20 animate-pulse-glow">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{t.rightSidebar.title}</h3>
          </div>
          <div className="space-y-3">
            {quickLinks.map((link, i) => {
              const Icon = link.icon;
              return link.internal ? (
                <button
                  key={i}
                  onClick={() => {
                    playClickSound();
                    navigate(link.url);
                  }}
                  className={`w-full group relative overflow-hidden px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 ${
                    link.highlight
                      ? 'bg-gradient-to-r from-primary/25 to-primary/15 border-2 border-primary/60 shadow-lg shadow-primary/20'
                      : 'bg-gradient-to-r from-card/80 to-card/60 border border-border/50 hover:border-primary/40'
                  }`}
                >
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Icon circle */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${link.color} flex items-center justify-center border border-primary/40 group-hover:border-primary/70 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-primary/20`}>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  
                  {/* Text */}
                  <span className="relative z-10 text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left flex-1">
                    {link.text}
                  </span>
                  
                  {/* Arrow indicator */}
                  <div className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ) : (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={playClickSound}
                  className={`w-full group relative overflow-hidden px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 ${
                    link.highlight
                      ? 'bg-gradient-to-r from-primary/25 to-primary/15 border-2 border-primary/60 shadow-lg shadow-primary/20'
                      : 'bg-gradient-to-r from-card/80 to-card/60 border border-border/50 hover:border-primary/40'
                  }`}
                >
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                  
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Icon circle */}
                  <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${link.color} flex items-center justify-center border border-primary/40 group-hover:border-primary/70 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-primary/20`}>
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  
                  {/* Text */}
                  <span className="relative z-10 text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left flex-1">
                    {link.text}
                  </span>
                  
                  {/* Arrow indicator */}
                  <div className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
