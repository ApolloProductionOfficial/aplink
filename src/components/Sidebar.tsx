import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";

const Sidebar = () => {
  const { playClickSound } = useButtonSound();

  const theme = {
    title: "Источники трафика",
    description: "Полный спектр источников трафика для OnlyFans: TikTok, Instagram, X/Twitter, Telegram, Dating, PPC, SEO и другие. Узнайте детали о каждом источнике.",
    route: "/traffic-sources"
  };

  return (
    <aside className="fixed left-0 top-[92px] bottom-0 w-80 bg-card border-r border-border overflow-y-auto p-6 hidden lg:block">
      <div className="space-y-6">
        {/* Theme Content */}
        <div>
          <h3 className="text-lg font-semibold mb-3">{theme.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {theme.description}
          </p>
          <Button
            onClick={() => {
              playClickSound();
              window.location.href = theme.route;
            }}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Подробнее
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
