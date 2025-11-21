import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import cfLogo from "@/assets/cf-logo-final.png";
import IncomeCalculator from "./IncomeCalculator";

const Hero = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  
  return (
    <section id="about" className="min-h-[85vh] flex items-center justify-center px-6 md:px-8 lg:px-4 pt-0 -mt-8 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-slide-up max-w-full">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              {t.hero.badge}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight break-words">
              {t.hero.title}
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed break-words">
              {t.hero.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  playClickSound();
                  window.open('https://t.me/Apollo_Production', '_blank');
                }}
              >
                {t.hero.startButton}
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                className="border-border hover:bg-accent/10"
                onClick={() => {
                  playClickSound();
                  window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
                }}
              >
                {t.hero.formButton}
              </Button>
            </div>
            
            {/* Mobile Calculator */}
            <div className="lg:hidden mt-8">
              <IncomeCalculator />
            </div>
          </div>
          
          {/* Desktop Layout - Calculator */}
          <div className="hidden lg:block animate-slide-in-right">
            <IncomeCalculator />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
