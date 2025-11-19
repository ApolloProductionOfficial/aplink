import { useState } from "react";
import { Menu, X, Newspaper, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const MobileMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useTranslation();

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
    <div className="md:hidden fixed top-20 right-4 z-40">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[80vh]">
          <div className="overflow-y-auto p-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                {servicesTitle}
              </h3>
              <div className="space-y-2">
                {services.map((service, index) => (
                  <button
                    key={index}
                    onClick={() => handleNavigation(service.path)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-card hover:bg-muted transition-colors border border-border"
                  >
                    <span className="text-sm font-medium">{service.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
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
                className="w-full text-left px-4 py-3 rounded-lg bg-card hover:bg-muted transition-colors border border-border"
              >
                <span className="text-sm font-medium">
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
