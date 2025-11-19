import { useTranslation } from "@/hooks/useTranslation";
import { Users, DollarSign, Shield, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";

const ModelRecruitment = () => {
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();

  const platforms = [
    "OnlyFans", "Fansly", "4based", "MYM", "Fancentro", 
    "Meloum", "Fanvu", "LoyalFans", "ManiVids", "F4F", 
    "Twitch", "Kick"
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            {t.modelRecruitment.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t.modelRecruitment.subtitle}
          </p>
        </div>

        {/* Platforms Grid */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">{t.modelRecruitment.platformsTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {platforms.map((platform, i) => (
              <div
                key={i}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 text-center hover:border-primary transition-all duration-300 hover:scale-105 animate-fade-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="text-sm font-medium text-foreground">{platform}</div>
              </div>
            ))}
          </div>
        </div>

        {/* LoyalFans Section */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">{t.modelRecruitment.loyalfans.title}</h2>
          </div>
          
          <p className="text-muted-foreground mb-6">{t.modelRecruitment.loyalfans.description}</p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                {t.modelRecruitment.loyalfans.tasksTitle}
              </h3>
              <ul className="space-y-2">
                {t.modelRecruitment.loyalfans.tasks.map((task: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                {t.modelRecruitment.loyalfans.conditionsTitle}
              </h3>
              <ul className="space-y-2">
                {t.modelRecruitment.loyalfans.conditions.map((condition: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ManyVids Section */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">{t.modelRecruitment.manyvids.title}</h2>
          </div>
          
          <p className="text-muted-foreground mb-6">{t.modelRecruitment.manyvids.description}</p>

          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {t.modelRecruitment.manyvids.conditionsTitle}
            </h3>
            <ul className="space-y-2">
              {t.modelRecruitment.manyvids.conditions.map((condition: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  <span>{condition}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4based Section */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">{t.modelRecruitment.fourbased.title}</h2>
          </div>
          
          <div className="space-y-4 mb-6">
            <p className="text-muted-foreground">{t.modelRecruitment.fourbased.description}</p>
            <p className="text-muted-foreground">{t.modelRecruitment.fourbased.verification}</p>
            <p className="text-muted-foreground">{t.modelRecruitment.fourbased.traffic}</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">{t.modelRecruitment.fourbased.contentPlanTitle}</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {t.modelRecruitment.fourbased.contentPlan.map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <h3 className="text-lg font-semibold mb-3 text-primary">{t.modelRecruitment.fourbased.importantTitle}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t.modelRecruitment.fourbased.scriptInfo}</p>
            <ul className="space-y-2">
              {t.modelRecruitment.fourbased.scripts.map((script: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-primary mt-1">•</span>
                  <span>{script}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* F2F & FanCentro Section */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">{t.modelRecruitment.f2f.title}</h2>
          </div>
          
          <div className="space-y-4 mb-6">
            <p className="text-muted-foreground">{t.modelRecruitment.f2f.description}</p>
            <p className="text-muted-foreground">{t.modelRecruitment.f2f.income}</p>
            <p className="text-muted-foreground">{t.modelRecruitment.f2f.content}</p>
            <p className="text-muted-foreground">{t.modelRecruitment.f2f.traffic}</p>
          </div>
        </div>

        {/* Key Points */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-12 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6">{t.modelRecruitment.keyPoints.title}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {t.modelRecruitment.keyPoints.points.map((point: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-card/50 rounded-lg">
                <span className="text-primary text-xl font-bold">{i + 1}</span>
                <span className="text-sm text-muted-foreground">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center animate-fade-in">
          <Button
            onClick={() => {
              playClickSound();
              window.open('https://t.me/Apollo_Production', '_blank');
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg"
          >
            {t.modelRecruitment.cta}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModelRecruitment;
