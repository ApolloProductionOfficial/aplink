import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

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
    <div className="w-full px-4 lg:px-0 py-6 lg:py-8">
      <div className="flex flex-wrap gap-2 justify-center">
        {topServices.map((service, index) => (
          <button
            key={index}
            onClick={() => navigate(service.path)}
            className={`px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-all duration-300 ${
              service.highlight
                ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30'
                : 'bg-card/50 text-foreground border border-border/50 hover:bg-card'
            }`}
          >
            {service.title}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ServiceBadges;
