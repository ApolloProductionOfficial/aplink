import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Unlock, MapPin, Video, Instagram, HandshakeIcon, Shield } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";

const Services = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();

  const handleBack = () => {
    playClickSound();
    navigate("/");
  };

  const handleServiceClick = (path: string) => {
    playClickSound();
    navigate(path);
  };

  const services = [
    {
      id: "partnership",
      title: t.services.partnership.title,
      description: t.services.partnership.description,
      icon: HandshakeIcon,
      path: "/partnership",
    },
    {
      id: "crypto",
      title: t.services.crypto.title,
      description: t.services.crypto.description,
      icon: Unlock,
      path: "/crypto-unlock",
    },
    {
      id: "verification",
      title: t.services.verification.title,
      description: t.services.verification.description,
      icon: Shield,
      path: "/model-verification",
    },
    {
      id: "dubai",
      title: t.services.dubai.title,
      description: t.services.dubai.description,
      icon: MapPin,
      path: "/dubai-residency",
    },
    {
      id: "webcam",
      title: t.services.webcam.title,
      description: t.services.webcam.description,
      icon: Video,
      path: "/webcam-services",
    },
    {
      id: "automation",
      title: t.services.automation.title,
      description: t.services.automation.description,
      icon: Instagram,
      path: "/instagram-automation",
    },
  ];

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
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              {t.services.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t.services.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Card
                  key={service.id}
                  className="p-6 cursor-pointer border-2 border-primary/20 bg-card/60 backdrop-blur hover:border-primary/60 hover:shadow-lg transition-all duration-300"
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
            })}
          </div>

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
