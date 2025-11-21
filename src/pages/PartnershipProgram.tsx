import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft, DollarSign, TrendingUp, Target, Zap, Users, Star, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const PartnershipProgram = () => {
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
      icon: DollarSign,
      title: t.partnership.features.commission.title,
      description: t.partnership.features.commission.description
    },
    {
      icon: TrendingUp,
      title: t.partnership.features.income.title,
      description: t.partnership.features.income.description
    },
    {
      icon: Target,
      title: t.partnership.features.passive.title,
      description: t.partnership.features.passive.description
    }
  ];

  const advantages = [
    {
      icon: Star,
      title: t.partnership.advantages.recommendations.title,
      description: t.partnership.advantages.recommendations.description
    },
    {
      icon: Zap,
      title: t.partnership.advantages.reach.title,
      description: t.partnership.advantages.reach.description
    },
    {
      icon: Users,
      title: t.partnership.advantages.competition.title,
      description: t.partnership.advantages.competition.description
    },
    {
      icon: Award,
      title: t.partnership.advantages.bonus.title,
      description: t.partnership.advantages.bonus.description
    }
  ];

  const requirements = t.partnership.requirements.items;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.partnership.back}
        </Button>

        <div className="mb-12">
          <div className="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-4">
            {t.partnership.badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.partnership.title}</h1>
          <p className="text-lg text-muted-foreground">
            {t.partnership.subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6 text-center hover:border-primary/50 transition-all duration-300"
            >
              <feature.icon className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Why We're Official Partners */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">{t.partnership.whyOfficial}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {advantages.map((advantage, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
              >
                <advantage.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{advantage.title}</h3>
                <p className="text-sm text-muted-foreground">{advantage.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div className="mb-12 bg-card/50 border border-border rounded-lg p-8">
          <h2 className="text-3xl font-bold mb-6">{t.partnership.requirements.title}</h2>
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

        {/* Limited Spots Warning */}
        <div className="mb-12 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold mb-2 text-red-400">{t.partnership.limited.title}</h3>
          <p className="text-muted-foreground">{t.partnership.limited.description}</p>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t.partnership.cta.title}</h2>
          <p className="text-lg text-muted-foreground mb-6">
            {t.partnership.cta.description}
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
              {t.partnership.cta.apply}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                playClickSound();
                window.open('https://t.me/Apollo_Production', '_blank');
              }}
              className="text-lg"
            >
              {t.partnership.cta.questions}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnershipProgram;
