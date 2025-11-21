import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft, Clock, DollarSign, FileCheck, Plane, Home, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import dubaiVideo from "@/assets/dubai-residency-video.mp4";

const DubaiResidency = () => {
  const { playClickSound } = useButtonSound();
  const navigate = useNavigate();
  const { t } = useTranslation();

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

  const mainInfo = [
    {
      icon: Clock,
      title: t.dubaiResidency.mainInfo.timing.title,
      description: t.dubaiResidency.mainInfo.timing.description
    },
    {
      icon: DollarSign,
      title: t.dubaiResidency.mainInfo.cost.title,
      description: t.dubaiResidency.mainInfo.cost.description
    },
    {
      icon: FileCheck,
      title: t.dubaiResidency.mainInfo.validity.title,
      description: t.dubaiResidency.mainInfo.validity.description
    },
    {
      icon: Plane,
      title: t.dubaiResidency.mainInfo.renewal.title,
      description: t.dubaiResidency.mainInfo.renewal.description
    }
  ];

  const requirements = t.dubaiResidency.requirements.items;
  const included = t.dubaiResidency.included.items;
  const additionalCosts = t.dubaiResidency.additionalCosts.items;
  const afterReceiving = t.dubaiResidency.afterReceiving.items;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.dubaiResidency.back}
        </Button>

        <div className="mb-12">
          <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            🇦🇪 {t.dubaiResidency.badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.dubaiResidency.title}</h1>
          <p className="text-lg text-muted-foreground">
            {t.dubaiResidency.subtitle}
          </p>
        </div>

        {/* Video Section */}
        <div className="mb-12 rounded-lg overflow-hidden border border-border">
          <video 
            autoPlay
            loop
            muted
            playsInline
            className="w-full"
          >
            <source src={dubaiVideo} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Main Information */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8">{t.dubaiResidency.mainInfo.title}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {mainInfo.map((info, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
              >
                <info.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{info.title}</h3>
                <p className="text-sm text-muted-foreground">{info.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What You Need */}
        <div className="mb-12 bg-card/50 border border-border rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">{t.dubaiResidency.requirements.title}</h2>
          <div className="space-y-3">
            {requirements.map((requirement: string, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <span className="text-muted-foreground">{requirement}</span>
              </div>
            ))}
          </div>
        </div>

        {/* What's Included */}
        <div className="mb-12 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">{t.dubaiResidency.included.title}</h2>
          <div className="space-y-3">
            {included.map((item: string, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary-foreground text-sm">✓</span>
                </div>
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Costs */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">{t.dubaiResidency.additionalCosts.title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {additionalCosts.map((cost: string, index: number) => (
              <div key={index} className="flex items-start gap-3 bg-card border border-border rounded-lg p-4">
                <DollarSign className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <span className="text-muted-foreground">{cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trip to Dubai */}
        <div className="mb-12 bg-card/50 border border-border rounded-lg p-8">
          <div className="flex items-start gap-4 mb-4">
            <Home className="h-10 w-10 text-primary flex-shrink-0" />
            <div>
              <h2 className="text-3xl font-bold mb-2">{t.dubaiResidency.trip.title}</h2>
              <p className="text-muted-foreground">{t.dubaiResidency.trip.description}</p>
            </div>
          </div>
        </div>

        {/* After Receiving */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-6">{t.dubaiResidency.afterReceiving.title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {afterReceiving.map((item: string, index: number) => (
              <div key={index} className="flex items-start gap-3 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
                <CreditCard className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.dubaiResidency.cta.title}</h2>
          <p className="text-lg text-muted-foreground mb-6">
            {t.dubaiResidency.cta.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => {
                playClickSound();
                window.open('https://t.me/Apollo_Production', '_blank');
              }}
              className="text-lg"
            >
              {t.dubaiResidency.cta.telegram}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                playClickSound();
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
              }}
              className="text-lg"
            >
              {t.dubaiResidency.cta.form}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DubaiResidency;
