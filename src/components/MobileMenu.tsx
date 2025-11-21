import { useState, useEffect } from "react";
import { Menu, X, Newspaper, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  
  // Use scroll visibility hook - mobile only, hide during scroll
  const isVisible = useScrollVisibility(true, 200);

  // Слушаем событие открытия меню из других компонентов
  useEffect(() => {
    const handleOpenMenu = () => setOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);

  const services = [
    { title: t.sidebar.trafficSources.title, path: '/traffic-sources' },
    { title: t.sidebar.cryptoUnlock.title, path: '/crypto-unlock' },
    { title: t.sidebar.modelVerification.title, path: '/model-verification' },
    { title: t.sidebar.partnership.title, path: '/partnership-program' },
    { title: t.modelRecruitment.title, path: '/model-recruitment' },
    { title: t.sidebar.dubaiResidency.title, path: '/dubai-residency' },
    { title: t.sidebar.webcamServices.title, path: '/webcam-services' },
    { title: t.sidebar.instagramAutomation.title, path: '/instagram-automation' },
  ];

  const servicesTitle = language === 'ru' ? 'Услуги' : language === 'uk' ? 'Послуги' : 'Services';
  const newsTitle = language === 'ru' ? 'Новости' : language === 'uk' ? 'Новини' : 'News';
  const viewAllNews = language === 'ru' ? 'Смотреть все новости' : language === 'uk' ? 'Переглянути всі новини' : 'View all news';

  const handleNavigation = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <>
      {/* Кнопка меню в виде вертикальной линии справа */}
      <div className={`md:hidden fixed top-1/2 -translate-y-1/2 right-0 z-40 transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}>
        <Button
          size="icon"
          className="h-20 w-2 rounded-l-full shadow-lg bg-gradient-to-b from-primary via-primary/80 to-primary hover:w-3 transition-all duration-200"
          onClick={() => setOpen(true)}
        >
          <span className="sr-only">Открыть меню</span>
        </Button>
      </div>

      {/* Само мобильное меню с анимациями */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-background/80 backdrop-blur-sm animate-fade-in">
          {/* Кликабельный фон для закрытия */}
          <div className="flex-1" onClick={() => setOpen(false)} />

          {/* Нижняя панель меню с анимацией выезда снизу */}
          <div className="h-[85vh] bg-background border-t border-border rounded-t-2xl p-3 space-y-5 overflow-y-auto animate-slide-in-bottom shadow-2xl">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Меню</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:rotate-90 transition-transform duration-300"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <h3 className="text-base font-semibold mb-2.5 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4" />
                {servicesTitle}
              </h3>
              <div className="space-y-1.5">
                {services.map((service, index) => (
                  <button
                    key={index}
                    onClick={() => handleNavigation(service.path)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-card hover:bg-muted transition-all duration-200 hover:translate-x-1 border border-border"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="text-xs font-medium leading-tight">{service.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold mb-2.5 flex items-center gap-1.5">
                <Newspaper className="h-4 w-4" />
                {newsTitle}
              </h3>
              <button
                onClick={() => {
                  const newsElement = document.querySelector('[data-news-widget]');
                  if (newsElement) {
                    newsElement.scrollIntoView({ behavior: 'smooth' });
                  }
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-card hover:bg-muted transition-all duration-200 hover:translate-x-1 border border-border"
              >
                <span className="text-xs font-medium">
                  {viewAllNews}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileMenu;

// Экспортируем функцию для открытия меню из других компонентов
export const openMobileMenu = () => {
  const event = new CustomEvent('open-mobile-menu');
  window.dispatchEvent(event);
};
