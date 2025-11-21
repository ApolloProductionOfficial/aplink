import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Unlock, MapPin, Video, Instagram, HandshakeIcon, Shield, Filter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTilt } from "@/hooks/useTilt";
import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Services = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const handleBack = () => {
    playClickSound();
    // На мобильных возвращаемся на главную и открываем меню, на десктопе просто на главную
    if (window.innerWidth < 768) {
      navigate('/');
      // Небольшая задержка чтобы страница загрузилась перед открытием меню
      setTimeout(() => {
        const event = new CustomEvent('open-mobile-menu');
        window.dispatchEvent(event);
      }, 100);
    } else {
      navigate("/");
    }
  };

  const handleServiceClick = (path: string) => {
    playClickSound();
    navigate(path);
  };

  useEffect(() => {
    const observers = cardRefs.current.map((ref, index) => {
      if (!ref) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleCards(prev => new Set(prev).add(index));
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(ref);
      return observer;
    });

    return () => {
      observers.forEach((observer, index) => {
        if (observer && cardRefs.current[index]) {
          observer.disconnect();
        }
      });
    };
  }, []);

  const services = [
    {
      id: "partnership",
      title: t.services.partnership.title,
      description: t.services.partnership.description,
      icon: HandshakeIcon,
      path: "/partnership-program",
      targetAudience: "agencies",
      platforms: ["onlyfans", "fansly"],
    },
    {
      id: "crypto",
      title: t.services.crypto.title,
      description: t.services.crypto.description,
      icon: Unlock,
      path: "/crypto-unlock",
      targetAudience: "both",
      platforms: ["onlyfans", "fansly"],
    },
    {
      id: "verification",
      title: t.services.verification.title,
      description: t.services.verification.description,
      icon: Shield,
      path: "/model-verification",
      targetAudience: "models",
      platforms: ["onlyfans"],
    },
    {
      id: "recruitment",
      title: "Набор моделей",
      description: "Ищем моделей для работы на всех платформах",
      icon: HandshakeIcon,
      path: "/model-recruitment",
      targetAudience: "models",
      platforms: ["onlyfans", "fansly", "loyalfans", "manyvids", "webcam"],
    },
    {
      id: "dubai",
      title: t.services.dubai.title,
      description: t.services.dubai.description,
      icon: MapPin,
      path: "/dubai-residency",
      targetAudience: "models",
      platforms: ["onlyfans", "fansly"],
    },
    {
      id: "webcam",
      title: t.services.webcam.title,
      description: t.services.webcam.description,
      icon: Video,
      path: "/webcam-services",
      targetAudience: "models",
      platforms: ["webcam"],
    },
    {
      id: "automation",
      title: t.services.automation.title,
      description: t.services.automation.description,
      icon: Instagram,
      path: "/instagram-automation",
      targetAudience: "both",
      platforms: ["instagram", "tiktok", "reddit"],
    },
  ];

  const filteredServices = services.filter(service => {
    const matchesPlatform = filterPlatform === "all" || 
                           service.platforms.includes(filterPlatform);
    return matchesPlatform;
  });

  const ServiceCard = ({ service, index }: { service: typeof services[0], index: number }) => {
    const tiltRef = useTilt(10);
    const Icon = service.icon;
    const isVisible = visibleCards.has(index);

    return (
      <Card
        ref={(el) => {
          cardRefs.current[index] = el;
          (tiltRef as any).current = el;
        }}
        className={`group relative overflow-hidden cursor-pointer border-2 border-primary/30 bg-gradient-to-br from-card/90 to-card/50 backdrop-blur hover:border-primary hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 hover:-translate-y-1 ${
          isVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-8'
        }`}
        style={{
          transitionDelay: `${index * 100}ms`,
          transformStyle: 'preserve-3d',
          boxShadow: '0 0 20px rgba(var(--primary-rgb), 0.1)'
        }}
        onClick={() => handleServiceClick(service.path)}
      >
        {/* Animated gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Subtle glow effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/5 to-transparent blur-xl" />
        
        {/* Mobile: Horizontal Layout */}
        <div className="md:hidden flex items-center gap-3 p-3 relative z-10">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold leading-tight mb-1 group-hover:text-primary transition-colors">{service.title}</h3>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {service.description}
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Desktop: Vertical Layout */}
        <div className="hidden md:flex flex-col items-center text-center space-y-4 p-6 relative z-10">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold group-hover:text-primary transition-colors">{service.title}</h3>
          <p className="text-muted-foreground text-sm">
            {service.description}
          </p>
          <Button variant="outline" className="mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            {t.common.learnMore}
          </Button>
        </div>
        
        {/* Animated corner accent */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full" />
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-4 md:py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 md:mb-8 hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.common.back}
        </Button>

        <div className="max-w-7xl mx-auto space-y-4 md:space-y-12">
          <div className="text-center space-y-2 md:space-y-6">
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold">
              {t.services.title}
            </h1>
            <p className="text-sm md:text-xl text-muted-foreground max-w-3xl mx-auto">
              {t.services.subtitle}
            </p>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 max-w-3xl mx-auto pt-1 md:pt-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Фильтр по платформе:</span>
              </div>

              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-[200px] bg-card/60 backdrop-blur border-primary/20">
                  <SelectValue placeholder="Платформа" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur border-primary/20 z-50">
                  <SelectItem value="all">Все платформы</SelectItem>
                  <SelectItem value="onlyfans">OnlyFans</SelectItem>
                  <SelectItem value="fansly">Fansly</SelectItem>
                  <SelectItem value="loyalfans">LoyalFans</SelectItem>
                  <SelectItem value="manyvids">ManyVids</SelectItem>
                  <SelectItem value="webcam">Webcam</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                </SelectContent>
              </Select>

              {filterPlatform !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterPlatform("all");
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  Сбросить фильтр
                </Button>
              )}
            </div>
          </div>

          {filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground">
                Нет услуг, соответствующих выбранным фильтрам
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
              {filteredServices.map((service, index) => (
                <ServiceCard key={service.id} service={service} index={index} />
              ))}
            </div>
          )}

          <div className="border-2 border-primary/30 rounded-lg p-3 md:p-8 bg-card/60 backdrop-blur">
            <h2 className="text-xl md:text-3xl font-bold text-center mb-3 md:mb-6">
              {t.services.howItWorks}
            </h2>
            <div className="grid md:grid-cols-4 gap-4 md:gap-6 text-xs md:text-sm text-muted-foreground">
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto text-primary font-semibold">
                  1
                </div>
                <h3 className="font-semibold text-base">{t.services.step1}</h3>
                <p>{t.services.step1Desc}</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto text-primary font-semibold">
                  2
                </div>
                <h3 className="font-semibold text-base">{t.services.step2}</h3>
                <p>{t.services.step2Desc}</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto text-primary font-semibold">
                  3
                </div>
                <h3 className="font-semibold text-base">{t.services.step3}</h3>
                <p>{t.services.step3Desc}</p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto text-primary font-semibold">
                  4
                </div>
                <h3 className="font-semibold text-base">{t.services.step4}</h3>
                <p>{t.services.step4Desc}</p>
              </div>
            </div>
          </div>

          <div className="text-center border-2 border-primary/30 rounded-lg p-4 md:p-10 bg-gradient-to-r from-primary/10 to-primary/5">
            <h2 className="text-xl md:text-3xl font-bold mb-2 md:mb-4">{t.services.readyToStart}</h2>
            <p className="text-sm md:text-lg text-muted-foreground mb-3 md:mb-6">
              {t.services.contactDesc}
            </p>
            <Button
              size="lg"
              onClick={() => {
                playClickSound();
                window.open("https://t.me/Apollo_Production", "_blank");
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-10"
            >
              {t.common.contactTelegram}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
