import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import { TrendingUp, HandshakeIcon, Unlock, Shield, MapPin } from "lucide-react";

const ServiceBadges = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const topServices = [
    { 
      title: t.rightSidebar?.partnership40 || "Партнёрская программа 40%", 
      path: '/partnership-program', 
      highlight: true,
      icon: HandshakeIcon,
      color: 'from-primary/30 to-primary/20'
    },
    { 
      title: t.rightSidebar?.cryptoUnlock || "Разблокировка крипты", 
      path: '/crypto-unlock', 
      highlight: true,
      icon: Unlock,
      color: 'from-primary/30 to-primary/20'
    },
    { 
      title: t.rightSidebar?.verificationRF || "Верификация RF/CIS", 
      path: '/model-verification',
      icon: Shield,
      color: 'from-primary/20 to-primary/10'
    },
  ];

  return (
    <div className="w-full px-3 lg:px-0 py-4 lg:py-8 hidden lg:block">
      <div className="space-y-3">
        <div className="flex items-center gap-3 justify-center mb-4">
          <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center border border-primary/40 shadow-lg shadow-primary/20 animate-pulse-glow">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Топ предложений</h3>
        </div>
        <div className="space-y-3">
          {topServices.map((service, index) => {
            const Icon = service.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(service.path)}
                className={`w-full group relative overflow-hidden px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 ${
                  service.highlight
                    ? 'bg-gradient-to-r from-primary/25 to-primary/15 border-2 border-primary/60 shadow-lg shadow-primary/20'
                    : 'bg-gradient-to-r from-card/80 to-card/60 border border-border/50 hover:border-primary/40'
                }`}
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
                
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Icon circle */}
                <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${service.color} flex items-center justify-center border border-primary/40 group-hover:border-primary/70 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-primary/20`}>
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                
                {/* Text */}
                <span className="relative z-10 text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left flex-1">
                  {service.title}
                </span>
                
                {/* Arrow indicator */}
                <div className="relative z-10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ServiceBadges;
