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
    <div className="lg:hidden px-2 py-3 bg-primary/5 backdrop-blur-sm border-y border-primary/20">
      <div className="space-y-2">
        <div className="flex items-center gap-1 justify-center">
          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
          <h2 className="text-xs font-bold text-primary">
            {topServicesTitle}
          </h2>
          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
        </div>
        <div className="space-y-1.5">
          {topServices.map((service, index) => (
            <button
              key={index}
              onClick={() => navigate(service.path)}
              className="w-full text-left px-2 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-all duration-200 shadow-sm shadow-primary/10"
            >
              <span className="text-[10px] font-semibold leading-tight text-primary block">
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
