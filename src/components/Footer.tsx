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
        { text: t.header.services, url: "/services" }
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
      username: "Only4riends",
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
              <Grid className="h-10 w-10 text-primary" />
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
                          onClick={(e) => {
                            playClickSound();
                            if (link.url.startsWith('#')) {
                              e.preventDefault();
                              const element = document.getElementById(link.url.slice(1));
                              if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                            } else if (link.url.startsWith('/')) {
                              e.preventDefault();
                              window.location.href = link.url;
                            }
                          }}
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
          <div className="space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <AtSign className="h-5 w-5 text-primary" />
              {t.footer.contactTitle}
            </h3>
            <div className="space-y-4">
              {contacts.map((contact, i) => (
                <div 
                  key={i} 
                  className="group relative overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
                >
                  <button
                    onClick={() => handleClick(contact.url)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                        <AtSign className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {contact.username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {contact.description}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button
                onClick={() => handleClick('https://t.me/Apollo_Production')}
                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
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
