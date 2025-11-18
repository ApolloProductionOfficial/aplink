import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";

const RightSidebar = () => {
  const { playClickSound } = useButtonSound();
  const quickLinks = [
    { text: "Разблокировка крипты (Fansly)", url: "/#/onlyfans", highlight: true },
    { text: "Telegram", url: "https://t.me/Apollo_Production" },
    { text: "Консалтинг", url: "https://t.me/Apollo_Production" },
    { text: "Запуск", url: "https://t.me/Apollo_Production" },
    { text: "Анкета для новых моделей", url: "https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform", highlight: true },
    { text: "Telegram‑группа", url: "https://t.me/MenuOnly4Friends", highlight: true }
  ];

  return (
    <aside className="fixed right-0 top-[92px] bottom-0 w-80 bg-card border-l border-border overflow-y-auto p-6 hidden xl:block">
      <div className="space-y-6">
        {/* Quick Links Header */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Быстрые ссылки</h3>
        </div>

        {/* Links List */}
        <div className="space-y-3">
          {quickLinks.map((link, i) => (
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
          ))}
        </div>

        {/* Recruitment CTA Box */}
        <div className="bg-card/50 border border-border rounded-lg p-4 mt-8">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Заполни анкету и начни зарабатывать с нами
          </p>
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => {
              playClickSound();
              window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
            }}
          >
            Заполнить анкету
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
