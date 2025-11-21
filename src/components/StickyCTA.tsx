import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

const StickyCTA = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  const isVisible = useScrollVisibility(true, 200);

  const handleClick = () => {
    playClickSound();
    window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
  };

  return (
    <div 
      className={`md:hidden fixed bottom-20 left-4 right-4 z-40 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      <Button
        onClick={handleClick}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow py-6 text-lg font-bold group"
      >
        {t.cta?.button || "Start Earning More"}
        <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  );
};

export default StickyCTA;
