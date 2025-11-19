import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { Briefcase } from "lucide-react";

const MobileServices = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const services = [
    { title: t.sidebar.cryptoUnlock.title, path: '/crypto-unlock' },
    { title: t.sidebar.trafficSources.title, path: '/traffic-sources' },
    { title: t.sidebar.modelVerification.title, path: '/model-verification' },
    { title: t.sidebar.partnership.title, path: '/partnership-program' },
    { title: t.modelRecruitment?.title || "Набор моделей", path: '/model-recruitment' },
    { title: t.sidebar.dubaiResidency.title, path: '/dubai-residency' },
    { title: t.sidebar.webcamServices.title, path: '/webcam-services' },
    { title: t.sidebar.instagramAutomation?.title || "Автоматизация", path: '/instagram-automation' },
  ];

  return (
    <div className="lg:hidden px-4 py-6 space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Briefcase className="h-4 w-4" />
        {t.sidebar.themes}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {services.map((service, index) => (
          <button
            key={index}
            onClick={() => navigate(service.path)}
            className="text-left px-3 py-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/50 transition-colors"
          >
            <span className="text-xs font-medium leading-tight line-clamp-2">{service.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MobileServices;
