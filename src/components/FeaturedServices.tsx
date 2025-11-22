import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";
import { Users, Wallet, ShieldCheck, UserPlus } from "lucide-react";

const FeaturedServices = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();

  const topServices = [
    {
      title: t.services.partnership.title,
      description: t.services.partnership.description,
      icon: Users,
      path: "/partnership-program",
      color: "from-primary/20 to-primary/10"
    },
    {
      title: t.services.crypto.title,
      description: t.services.crypto.description,
      icon: Wallet,
      path: "/crypto-unlock",
      color: "from-cyan-500/20 to-cyan-500/10"
    },
    {
      title: t.services.verification.title,
      description: t.services.verification.description,
      icon: ShieldCheck,
      path: "/model-verification",
      color: "from-purple-500/20 to-purple-500/10"
    },
    {
      title: t.services.dubai.title,
      description: t.services.dubai.description,
      icon: UserPlus,
      path: "/dubai-residency",
      color: "from-pink-500/20 to-pink-500/10"
    }
  ];

  const handleServiceClick = (path: string) => {
    playClickSound();
    navigate(path);
  };

  return (
    <section className="py-16 px-4 md:px-8 relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-cyan-400 to-primary bg-clip-text text-transparent">
            {t.services.title}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t.services.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6 mb-8">
          {topServices.map((service) => {
            const Icon = service.icon;
            return (
              <button
                key={service.path}
                onClick={() => handleServiceClick(service.path)}
                className="group relative overflow-hidden rounded-2xl border border-border/50 p-4 md:p-6 text-left transition-all duration-300 hover:scale-105 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/20 bg-card/50 backdrop-blur-sm"
              >
                {/* Animated background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                {/* Icon */}
                <div className="relative z-10 flex flex-col items-center gap-3 mb-3 md:flex-row md:items-start md:gap-4 md:mb-4">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br ${service.color} flex items-center justify-center border border-border/30 group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                    <Icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-base md:text-xl font-bold mb-1 md:mb-2 group-hover:text-primary transition-colors leading-tight">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground text-xs md:text-sm leading-snug">
                      {service.description}
                    </p>
                  </div>
                </div>

                {/* Hover arrow indicator */}
                <div className="relative z-10 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-xs md:text-sm text-primary font-medium">
                    {t.common.learnMore} →
                  </span>
                </div>

                {/* Cosmic glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* View All Services Button */}
        <div className="text-center">
          <button
            onClick={() => {
              playClickSound();
              navigate("/services");
            }}
            className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary/20 to-cyan-500/20 hover:from-primary/30 hover:to-cyan-500/30 border border-primary/50 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-primary/20"
          >
            <span className="text-lg font-semibold text-primary">
              {t.services.allServices}
            </span>
            <span className="text-primary group-hover:translate-x-1 transition-transform">→</span>
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-cyan-500/10 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedServices;
