import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";

const CTA = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-10" />
      <div className="container mx-auto relative z-10">
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              {t.cta.badge}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t.cta.title}
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            {t.cta.description}
          </p>
          <Button 
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow px-8 py-6 text-lg"
            onClick={() => {
              playClickSound();
              window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
            }}
          >
            {t.cta.button}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTA;
