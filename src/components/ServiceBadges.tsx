import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { TrendingUp } from "lucide-react";

const ServiceBadges = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const topServices = [
    { title: t.rightSidebar?.partnership40 || "Партнёрская программа 40%", path: '/partnership-program', highlight: true },
    { title: t.rightSidebar?.cryptoUnlock || "Разблокировка крипты", path: '/crypto-unlock', highlight: true },
    { title: t.rightSidebar?.verificationRF || "Верификация RF/CIS", path: '/model-verification' },
    { title: t.sidebar?.dubaiResidency?.title || "Резидентство Дубай", path: '/dubai-residency' },
  ];

  return (
    <div className="w-full px-3 lg:px-0 py-4 lg:py-8 hidden lg:block">
      <div className="space-y-3">
        <div className="flex items-center gap-2 justify-center">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Топ предложений</h3>
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {topServices.map((service, index) => (
            <button
              key={index}
              onClick={() => navigate(service.path)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-1.5 hover:scale-105 hover:-translate-y-1 ${
                service.highlight
                  ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30'
                  : 'bg-card/50 text-foreground border border-border/50 hover:bg-card'
              }`}
            >
              <span className="text-primary">•</span>
              {service.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceBadges;
