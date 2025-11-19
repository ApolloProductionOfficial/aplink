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
    <div className="lg:hidden px-3 py-4 bg-primary/5 backdrop-blur-sm border-y border-primary/20">
      <div className="space-y-3">
        <div className="flex items-center gap-2 justify-center">
          <Star className="h-4 w-4 text-primary fill-primary" />
          <h2 className="text-sm font-bold text-primary">
            {topServicesTitle}
          </h2>
          <Star className="h-4 w-4 text-primary fill-primary" />
        </div>
        <div className="space-y-2">
          {topServices.map((service, index) => (
            <button
              key={index}
              onClick={() => navigate(service.path)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all duration-200 shadow-sm shadow-primary/10"
            >
              <span className="text-xs font-semibold leading-tight text-primary block">
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
