import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, DollarSign, Clock, Globe, Home, Shield, TrendingUp, MessageSquare } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";

const WebcamServices = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();

  const handleBack = () => {
    playClickSound();
    // На мобильных открываем меню, на десктопе идём на главную
    if (window.innerWidth < 768) {
      const event = new CustomEvent('open-mobile-menu');
      window.dispatchEvent(event);
    } else {
      navigate('/');
    }
  };

  const handleContact = () => {
    playClickSound();
    window.open('https://t.me/Apollo_Production', '_blank');
  };

  const conditions = [
    { icon: DollarSign, title: t.webcam.conditions.baseRate, description: t.webcam.conditions.baseRateDesc },
    { icon: TrendingUp, title: t.webcam.conditions.totals, description: t.webcam.conditions.totalsDesc },
    { icon: Clock, title: t.webcam.conditions.payments, description: t.webcam.conditions.paymentsDesc },
    { icon: Shield, title: t.webcam.conditions.topModels, description: t.webcam.conditions.topModelsDesc },
  ];

  const services = [
    { icon: Globe, title: t.webcam.services.multiSite, description: t.webcam.services.multiSiteDesc },
    { icon: MessageSquare, title: t.webcam.services.management, description: t.webcam.services.managementDesc },
    { icon: Shield, title: t.webcam.services.support, description: t.webcam.services.supportDesc },
    { icon: Clock, title: t.webcam.services.schedule, description: t.webcam.services.scheduleDesc },
  ];

  const relocation = [
    { icon: Home, title: t.webcam.relocation.package, description: t.webcam.relocation.packageDesc },
    { icon: Shield, title: t.webcam.relocation.documents, description: t.webcam.relocation.documentsDesc },
    { icon: TrendingUp, title: t.webcam.relocation.benefits, description: t.webcam.relocation.benefitsDesc },
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
          {t.webcam.backButton}
        </Button>

        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-white to-primary bg-clip-text text-transparent animate-shimmer">
              {t.webcam.title}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t.webcam.subtitle}
            </p>
          </div>

          {/* Conditions Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">{t.webcam.conditionsTitle}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {conditions.map((condition, index) => (
                <Card key={index} className="p-6 bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300">
                  <condition.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{condition.title}</h3>
                  <p className="text-muted-foreground">{condition.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Services Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">{t.webcam.servicesTitle}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {services.map((service, index) => (
                <Card key={index} className="p-6 bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300">
                  <service.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                  <p className="text-muted-foreground">{service.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Relocation Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6">{t.webcam.relocationTitle}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relocation.map((item, index) => (
                <Card key={index} className="p-6 bg-card/50 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300">
                  <item.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="text-center space-y-6 py-8">
            <h2 className="text-3xl font-bold">{t.webcam.ctaTitle}</h2>
            <p className="text-xl text-muted-foreground">{t.webcam.ctaDescription}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={handleContact}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {t.webcam.contactButton}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WebcamServices;
