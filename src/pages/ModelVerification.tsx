import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft, CheckCircle, Shield, Video, Home, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const ModelVerification = () => {
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
      icon: Video,
      title: t.modelVerification.features.consultation.title,
      description: t.modelVerification.features.consultation.description
    },
    {
      icon: Shield,
      title: t.modelVerification.features.faceban.title,
      description: t.modelVerification.features.faceban.description
    },
    {
      icon: CheckCircle,
      title: t.modelVerification.features.verification.title,
      description: t.modelVerification.features.verification.description
    }
  ];

  const benefits = t.modelVerification.benefits.items;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.modelVerification.back}
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.modelVerification.title}</h1>
          <p className="text-lg text-muted-foreground">
            {t.modelVerification.subtitle}
          </p>
        </div>

        {/* What You Get */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">{t.modelVerification.whatYouGet}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
              >
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-12 bg-card/50 border border-border rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">{t.modelVerification.benefits.title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {benefits.map((benefit: string, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <span className="text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.modelVerification.cta.title}</h2>
          <p className="text-lg text-muted-foreground mb-6">
            {t.modelVerification.cta.description}
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
              {t.modelVerification.cta.telegram}
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
              {t.modelVerification.cta.form}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelVerification;
