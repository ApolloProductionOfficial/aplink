import { useState, useEffect } from "react";
import { Menu, X, Newspaper, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  // Hide menu on scroll down, show on scroll up (mobile only)
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerWidth >= 768) {
        setIsVisible(true);
        return;
      }

      const currentScrollY = window.scrollY;
      
      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [lastScrollY]);

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
    <div className={`md:hidden fixed top-[72px] right-4 z-40 transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'
    }`}>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[85vh] flex flex-col">
          <div className="flex-1 overflow-y-auto p-3 space-y-5">
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
                    className="w-full text-left px-3 py-2 rounded-lg bg-card hover:bg-muted transition-colors border border-border"
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
                  // Scroll to news section or navigate
                  const newsElement = document.querySelector('[data-news-widget]');
                  if (newsElement) {
                    newsElement.scrollIntoView({ behavior: 'smooth' });
                    setOpen(false);
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-card hover:bg-muted transition-colors border border-border"
              >
                <span className="text-xs font-medium">
                  {viewAllNews}
                </span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default MobileMenu;
