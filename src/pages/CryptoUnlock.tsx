import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft, CheckCircle, Clock, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const CryptoUnlock = () => {
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

  const features = [
    {
      icon: Clock,
      title: t.cryptoUnlock.features.timing.title,
      description: t.cryptoUnlock.features.timing.description
    },
    {
      icon: CheckCircle,
      title: t.cryptoUnlock.features.cases.title,
      description: t.cryptoUnlock.features.cases.description
    },
    {
      icon: Shield,
      title: t.cryptoUnlock.features.guarantee.title,
      description: t.cryptoUnlock.features.guarantee.description
    },
    {
      icon: Zap,
      title: t.cryptoUnlock.features.fansly.title,
      description: t.cryptoUnlock.features.fansly.description
    }
  ];

  const howItWorks = [
    {
      step: t.cryptoUnlock.howItWorks.step1.number,
      title: t.cryptoUnlock.howItWorks.step1.title,
      description: t.cryptoUnlock.howItWorks.step1.description
    },
    {
      step: t.cryptoUnlock.howItWorks.step2.number,
      title: t.cryptoUnlock.howItWorks.step2.title,
      description: t.cryptoUnlock.howItWorks.step2.description
    },
    {
      step: t.cryptoUnlock.howItWorks.step3.number,
      title: t.cryptoUnlock.howItWorks.step3.title,
      description: t.cryptoUnlock.howItWorks.step3.description
    },
    {
      step: t.cryptoUnlock.howItWorks.step4.number,
      title: t.cryptoUnlock.howItWorks.step4.title,
      description: t.cryptoUnlock.howItWorks.step4.description
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.cryptoUnlock.back}
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.cryptoUnlock.title}</h1>
          <p className="text-lg text-muted-foreground">
            {t.cryptoUnlock.subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/50 transition-all duration-300"
            >
              <feature.icon className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">{t.cryptoUnlock.howItWorks.title}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-12 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.cryptoUnlock.pricing.title}</h2>
          <div className="text-5xl font-bold text-primary mb-4">{t.cryptoUnlock.pricing.price}</div>
          <p className="text-lg text-muted-foreground">{t.cryptoUnlock.pricing.description}</p>
        </div>

        {/* Why Choose Us */}
        <div className="mb-12 bg-card/50 border border-border rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6 text-center">{t.cryptoUnlock.whyUs.title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {t.cryptoUnlock.whyUs.items.map((item: string, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.cryptoUnlock.cta.title}</h2>
          <p className="text-lg text-muted-foreground mb-6">
            {t.cryptoUnlock.cta.description}
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
              {t.cryptoUnlock.cta.telegram}
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
              {t.cryptoUnlock.cta.form}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoUnlock;