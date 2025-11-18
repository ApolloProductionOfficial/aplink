import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useLanguage } from "@/contexts/LanguageContext";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoVideo from "@/assets/logo-video.mov";

const Header = () => {
  const { playClickSound } = useButtonSound();
  const { language, setLanguage } = useLanguage();

  const languages = {
    ru: { label: 'Русский', flag: '🇷🇺' },
    en: { label: 'English', flag: '🇬🇧' },
    uk: { label: 'Українська', flag: '🇺🇦' }
  };
  
  return (
    <header className="fixed top-[40px] left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden">
              <video 
                src={logoVideo} 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-base font-bold animate-text-shimmer">
              APOLLO PRODUCTION — OnlyFans Management Agency
            </span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-6">
            <a 
              href="#about" 
              className="text-sm text-foreground/80 hover:text-primary transition-colors"
              onClick={playClickSound}
            >
              О нас
            </a>
            <a 
              href="#traffic" 
              className="text-sm text-foreground/80 hover:text-primary transition-colors"
              onClick={playClickSound}
            >
              Источники трафика
            </a>
            <a 
              href="#services" 
              className="text-sm text-foreground/80 hover:text-primary transition-colors"
              onClick={playClickSound}
            >
              Услуги
            </a>
            <a 
              href="#infrastructure" 
              className="text-sm text-foreground/80 hover:text-primary transition-colors"
              onClick={playClickSound}
            >
              Инфраструктура
            </a>
            <Button 
              size="sm"
              className="bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
              onClick={() => {
                playClickSound();
                window.open('https://onlyreddit.com', '_blank');
              }}
            >
              Reddit сайт
            </Button>
            
            {/* Language Selector - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2"
                  onClick={playClickSound}
                >
                  <Globe className="h-4 w-4" />
                  <span>{languages[language].flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {Object.entries(languages).map(([code, { label, flag }]) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => {
                      playClickSound();
                      setLanguage(code as 'ru' | 'en' | 'uk');
                    }}
                    className={language === code ? 'bg-primary/10' : ''}
                  >
                    <span className="mr-2">{flag}</span>
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          
          {/* Language Selector - Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="lg:hidden text-sm text-primary flex items-center gap-1"
                onClick={playClickSound}
              >
                {languages[language].flag} ▼
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {Object.entries(languages).map(([code, { label, flag }]) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => {
                    playClickSound();
                    setLanguage(code as 'ru' | 'en' | 'uk');
                  }}
                  className={language === code ? 'bg-primary/10' : ''}
                >
                  <span className="mr-2">{flag}</span>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
