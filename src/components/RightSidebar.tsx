import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const RightSidebar = () => {
  const { playClickSound } = useButtonSound();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const quickLinks = [
    { text: t.rightSidebar.cryptoUnlock, url: "/crypto-unlock", highlight: true, internal: true },
    { text: t.rightSidebar.telegram, url: "https://t.me/Apollo_Production", internal: false },
    { text: t.rightSidebar.consulting, url: "https://t.me/Apollo_Production", internal: false },
    { text: t.rightSidebar.launch, url: "https://t.me/Apollo_Production", internal: false },
    { text: t.rightSidebar.modelForm, url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform", highlight: true, internal: false },
    { text: t.rightSidebar.telegramGroup, url: "https://t.me/MenuOnly4Friends", highlight: true, internal: false }
  ];

  return (
    <aside className="fixed right-0 top-[120px] bottom-0 w-80 bg-card/95 backdrop-blur-md border-l border-border overflow-y-auto p-6 hidden xl:block z-40">
      <div className="space-y-6">
        {/* Quick Links Header */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">{t.rightSidebar.title}</h3>
        </div>

        {/* Links List */}
        <div className="space-y-3">
          {quickLinks.map((link, i) => (
            link.internal ? (
              <button
                key={i}
                onClick={() => {
                  playClickSound();
                  navigate(link.url);
                }}
                className={`block text-sm transition-colors text-left w-full ${
                  link.highlight 
                    ? 'text-primary hover:text-primary/80 font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.text}
              </button>
            ) : (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={playClickSound}
                className={`block text-sm transition-colors ${
                  link.highlight 
                    ? 'text-primary hover:text-primary/80 font-medium' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {link.text}
              </a>
            )
          ))}
        </div>

        {/* Recruitment CTA Box */}
        <div className="bg-card/50 border border-border rounded-lg p-4 mt-8">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {t.rightSidebar.ctaText}
          </p>
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              playClickSound();
              window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
            }}
          >
            {t.rightSidebar.ctaButton}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
