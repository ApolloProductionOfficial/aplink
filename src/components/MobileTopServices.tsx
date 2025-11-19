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
    { title: t.rightSidebar?.partnership40 || "Партнёрская программа 40%", path: '/partnership-program' },
    { title: t.rightSidebar?.cryptoUnlock || "Разблокировка крипты Fansly/OF", path: '/crypto-unlock' },
    { title: t.rightSidebar?.verificationRF || "Верификация RF/CIS для OnlyFans", path: '/model-verification' },
  ];

  return (
    <div className="lg:hidden px-2 py-3 bg-background/95 backdrop-blur-sm border-y border-border">
      <div className="space-y-2">
        <div className="flex items-center gap-1 justify-center">
          <Star className="h-3 w-3 text-primary fill-primary" />
          <h2 className="text-[11px] font-bold text-foreground">
            {topServicesTitle}
          </h2>
          <Star className="h-3 w-3 text-primary fill-primary" />
        </div>
        <div className="space-y-1.5">
          {topServices.map((service, index) => (
            <button
              key={index}
              onClick={() => navigate(service.path)}
              className="w-full text-left px-2.5 py-2 rounded-lg bg-card hover:bg-card/80 border border-border transition-all duration-200 shadow-sm"
            >
              <span className="text-[10px] font-semibold leading-tight text-foreground block">
                {service.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileTopServices;
