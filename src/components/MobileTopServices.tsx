import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { Star } from "lucide-react";

const MobileTopServices = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const topServicesTitle = language === 'ru' 
    ? 'Топ актуальных услуг' 
    : language === 'uk' 
    ? 'Топ актуальних послуг' 
    : 'Top Popular Services';

  const topServices = [
    { title: t.sidebar.marketplace?.title || "Marketplace | Only4riend", path: '/marketplace', highlighted: true },
    { title: t.rightSidebar?.partnership40 || "Партнёрская программа 40%", path: '/partnership-program' },
    { title: t.rightSidebar?.cryptoUnlock || "Разблокировка крипты Fansly/OF", path: '/crypto-unlock' },
    { title: t.rightSidebar?.verificationRF || "Верификация RF/CIS для OnlyFans", path: '/model-verification' },
    { title: t.sidebar.marketplace?.title || "Marketplace | Only4riend", path: '/marketplace', highlighted: true },
  ];

  return (
    <div className="lg:hidden px-3 md:px-4 py-2 bg-background/95 backdrop-blur-sm border-y border-border">
      <div className="space-y-1.5 max-w-full overflow-hidden">
        <div className="flex items-center gap-1 justify-center">
          <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />
          <h2 className="text-[11px] font-bold text-foreground text-center">
            {topServicesTitle}
          </h2>
          <Star className="h-3 w-3 text-primary fill-primary flex-shrink-0" />
        </div>
        <div className="space-y-1">
          {topServices.map((service, index) => {
            const isHighlighted = 'highlighted' in service && service.highlighted;
            return (
              <button
                key={index}
                onClick={() => navigate(service.path)}
                className={`w-full text-left px-2 py-1.5 rounded-lg ${
                  isHighlighted 
                    ? 'bg-gradient-to-r from-primary/30 to-cyan-400/20 border-2 border-primary shadow-lg shadow-primary/30 ring-1 ring-primary/50' 
                    : 'bg-card border border-border'
                } hover:bg-card/80 transition-all duration-200 shadow-sm`}
              >
                <span className={`text-[10px] font-semibold leading-tight ${
                  isHighlighted ? 'text-primary animate-pulse' : 'text-foreground'
                } block break-words`}>
                  {service.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileTopServices;
