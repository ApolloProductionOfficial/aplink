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
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const handleBack = () => {
    playClickSound();
    navigate("/");
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
    const matchesType = filterType === "all" || 
                       filterType === service.targetAudience || 
                       service.targetAudience === "both";
    const matchesPlatform = filterPlatform === "all" || 
                           service.platforms.includes(filterPlatform);
    return matchesType && matchesPlatform;
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
        className={`p-6 cursor-pointer border-2 border-primary/20 bg-card/60 backdrop-blur hover:border-primary/60 hover:shadow-2xl transition-all duration-500 ${
          isVisible 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-8'
        }`}
        style={{
          transitionDelay: `${index * 100}ms`,
          transformStyle: 'preserve-3d'
        }}
        onClick={() => handleServiceClick(service.path)}
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-2xl font-bold">{service.title}</h3>
          <p className="text-muted-foreground text-sm">
            {service.description}
          </p>
          <Button variant="outline" className="mt-2">
            {t.common.learnMore}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-8 hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.common.back}
        </Button>

        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold">
              {t.services.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t.services.subtitle}
            </p>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-center gap-4 max-w-3xl mx-auto pt-4">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Фильтры:</span>
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px] bg-card/60 backdrop-blur border-primary/20">
                  <SelectValue placeholder="Тип аудитории" />
                </SelectTrigger>
                <SelectContent className="bg-card/95 backdrop-blur border-primary/20 z-50">
                  <SelectItem value="all">Все услуги</SelectItem>
                  <SelectItem value="models">Для моделей</SelectItem>
                  <SelectItem value="agencies">Для агентств</SelectItem>
                </SelectContent>
              </Select>

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

              {(filterType !== "all" || filterPlatform !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterType("all");
                    setFilterPlatform("all");
                  }}
                  className="text-primary hover:text-primary/80"
                >
                  Сбросить фильтры
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service, index) => (
                <ServiceCard key={service.id} service={service} index={index} />
              ))}
            </div>
          )}

          <div className="border-2 border-primary/30 rounded-lg p-8 bg-card/60 backdrop-blur">
            <h2 className="text-3xl font-bold text-center mb-6">
              {t.services.howItWorks}
            </h2>
            <div className="grid md:grid-cols-4 gap-6 text-sm text-muted-foreground">
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

          <div className="text-center border-2 border-primary/30 rounded-lg p-10 bg-gradient-to-r from-primary/10 to-primary/5">
            <h2 className="text-3xl font-bold mb-4">{t.services.readyToStart}</h2>
            <p className="text-lg text-muted-foreground mb-6">
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
