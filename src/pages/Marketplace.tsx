import { useTranslation } from "@/hooks/useTranslation";
import { CheckCircle, Clock, Shield, AlertTriangle, DollarSign, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useNavigate } from "react-router-dom";
import marketplaceVideo from "@/assets/marketplace-intro.mov";

const Marketplace = () => {
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();
  const navigate = useNavigate();

  const handleBack = () => {
    playClickSound();
    if (window.innerWidth < 768) {
      navigate('/');
      setTimeout(() => {
        const event = new CustomEvent('open-mobile-menu');
        window.dispatchEvent(event);
      }, 100);
    } else {
      navigate("/");
    }
  };

  const statuses = [
    { icon: CheckCircle, name: "#Active", color: "text-green-400", desc: t.marketplace.statuses.active },
    { icon: Clock, name: "#Reserve", color: "text-yellow-400", desc: t.marketplace.statuses.reserve },
    { icon: AlertTriangle, name: "#Auction", color: "text-orange-400", desc: t.marketplace.statuses.auction },
    { icon: DollarSign, name: "#Sold", color: "text-primary", desc: t.marketplace.statuses.sold }
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-8 hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t.common.back}
        </Button>
        
        {/* Hero Section with Video */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
            {t.marketplace.title}
          </h1>
          
          {/* Video Banner */}
          <div className="relative mb-8 rounded-2xl overflow-hidden border border-primary/30 shadow-2xl shadow-primary/20">
            <video
              src={marketplaceVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto"
            />
          </div>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            {t.marketplace.subtitle}
          </p>

          {/* Telegram Group Link at Top */}
          <div className="mt-8">
            <Button
              onClick={() => {
                playClickSound();
                window.open('https://t.me/+V0MgR5QKSb01MTZi', '_blank');
              }}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-lg px-8 py-6"
            >
              {t.marketplace.telegramGroup}
            </Button>
          </div>
        </div>

        {/* Model Statuses */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            {t.marketplace.statusesTitle}
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            {statuses.map((status, i) => (
              <div
                key={i}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-xl p-4 hover:border-primary transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-2">
                  <status.icon className={`h-5 w-5 ${status.color}`} />
                  <span className="font-bold text-foreground">{status.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">{status.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase Process */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <DollarSign className="h-7 w-7 text-primary" />
            {t.marketplace.purchaseTitle}
          </h2>
          
          <div className="space-y-4">
            {t.marketplace.purchase.steps.map((step: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold mt-0.5">
                  {i + 1}
                </div>
                <p className="text-muted-foreground leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-primary/10 rounded-xl border border-primary/20">
            <p className="text-sm text-foreground leading-relaxed">
              {t.marketplace.purchase.guaranteeNote}
            </p>
          </div>
        </div>

        {/* Agency Obligations */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <CheckCircle className="h-7 w-7 text-primary" />
            {t.marketplace.obligationsTitle}
          </h2>
          
          <ul className="space-y-3">
            {t.marketplace.obligations.items.map((item: string, i: number) => (
              <li key={i} className="flex items-start gap-3 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 14-Day Guarantee */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            {t.marketplace.guaranteeTitle}
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-foreground">{t.marketplace.guarantee.coverageTitle}</h3>
              <ul className="space-y-2">
                {t.marketplace.guarantee.coverage.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <h3 className="text-lg font-semibold mb-3 text-foreground">{t.marketplace.guarantee.requirementsTitle}</h3>
              <p className="text-sm text-muted-foreground">{t.marketplace.guarantee.requirements}</p>
            </div>

            <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <h3 className="text-lg font-semibold mb-3 text-foreground">{t.marketplace.guarantee.exclusionsTitle}</h3>
              <ul className="space-y-2">
                {t.marketplace.guarantee.exclusions.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* After Sale */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <CheckCircle className="h-7 w-7 text-primary" />
            {t.marketplace.afterSaleTitle}
          </h2>
          
          <p className="text-muted-foreground">{t.marketplace.afterSale.description}</p>
        </div>

        {/* Payment & Contact */}
        <div className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border text-center animate-fade-in">
          <h2 className="text-2xl font-bold mb-4">{t.marketplace.payment.title}</h2>
          <p className="text-xl text-primary font-bold mb-6">{t.marketplace.payment.method}</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => {
                playClickSound();
                window.open('https://t.me/alexanderbeautifull', '_blank');
              }}
              className="bg-primary hover:bg-primary/90"
            >
              @alexanderbeautifull
            </Button>
            <Button
              onClick={() => {
                playClickSound();
                window.open('https://t.me/Apollo_Production', '_blank');
              }}
              className="bg-primary hover:bg-primary/90"
            >
              @Apollo_Production
            </Button>
          </div>
          
          <div className="mt-6">
            <Button
              onClick={() => {
                playClickSound();
                window.open('https://t.me/+V0MgR5QKSb01MTZi', '_blank');
              }}
              variant="outline"
              className="border-primary/50 hover:bg-primary/10"
            >
              {t.marketplace.telegramGroup}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
