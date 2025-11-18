import { Grid, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";

const Footer = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();

  const sections = [
    {
      title: t.header.about,
      links: [
        { text: t.header.about, url: "#about" },
        { text: t.header.traffic, url: "#traffic" },
        { text: t.header.services, url: "#services" },
        { text: t.header.infrastructure, url: "#infrastructure" }
      ]
    }
  ];

  const contacts = [
    {
      platform: "Telegram",
      username: "@Apollo_Production",
      description: "Owner",
      url: "https://t.me/Apollo_Production"
    },
    {
      platform: "Telegram",
      username: "@osckelly",
      description: "Managing Director",
      url: "https://t.me/osckelly"
    },
    {
      platform: "Telegram",
      username: "Only4Friends",
      description: "Telegram Group",
      url: "https://t.me/MenuOnly4Friends"
    }
  ];

  const handleClick = (url: string) => {
    playClickSound();
    window.open(url, '_blank');
  };

  return (
    <footer className="bg-card/50 border-t border-border py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Grid className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">{t.header.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              {t.hero.description}
            </p>
            <div className="pt-4">
              {sections.map((section, idx) => (
                <div key={idx}>
                  <ul className="space-y-2">
                    {section.links.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                          onClick={playClickSound}
                        >
                          {link.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t.rightSidebar.title}</h3>
            <div className="space-y-4">
              {contacts.map((contact, i) => (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => handleClick(contact.url)}
                    className="flex items-center gap-2 text-primary hover:underline group"
                  >
                    <AtSign className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">{contact.platform}: {contact.username}</span>
                  </button>
                  <p className="text-xs text-muted-foreground ml-6">— {contact.description}</p>
                </div>
              ))}
            </div>
            <div className="pt-6">
              <Button
                onClick={() => handleClick('https://t.me/Apollo_Production')}
                className="bg-primary hover:bg-primary/90"
              >
                {t.rightSidebar.telegram}
              </Button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Apollo Production. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
