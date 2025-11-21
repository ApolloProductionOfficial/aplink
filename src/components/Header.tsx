import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { t } = useTranslation();

  const languages = {
    ru: { label: 'Русский', flag: '🇷🇺' },
    en: { label: 'English', flag: '🇬🇧' },
    uk: { label: 'Українська', flag: '🇺🇦' }
  };
  
  const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    playClickSound();
    
    // Create a shine effect element
    const shine = document.createElement('div');
    shine.className = 'fixed inset-0 pointer-events-none z-50';
    shine.style.background = 'radial-gradient(circle at center, hsla(var(--primary), 0.3) 0%, transparent 70%)';
    shine.style.opacity = '0';
    shine.style.transition = 'opacity 0.6s ease';
    document.body.appendChild(shine);
    
    // Animate shine
    setTimeout(() => {
      shine.style.opacity = '1';
    }, 10);
    
    setTimeout(() => {
      shine.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(shine);
      }, 600);
    }, 300);
    
    // Smooth scroll to section
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0">
              <video 
                src={logoVideo} 
                autoPlay 
                loop 
                muted 
                playsInline
                preload="metadata"
                className="w-full h-full object-cover scale-110"
              />
            </div>
            <span className="text-sm sm:text-base font-bold animate-text-shimmer whitespace-nowrap">
              {t.header.title}
            </span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-6">
            <a 
              href="#about" 
              className="text-sm text-foreground/80 hover:text-primary transition-all relative group px-3 py-1.5 rounded-md bg-primary/[0.02] shadow-[0_0_8px_rgba(var(--primary-rgb),0.08)] hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] animate-text-shine"
              onClick={(e) => handleNavigate(e, 'about')}
            >
              {t.header.about}
              <span className="absolute -bottom-0.5 left-3 w-0 h-0.5 bg-primary transition-all group-hover:w-[calc(100%-24px)]"></span>
            </a>
            <a 
              href="#traffic" 
              className="text-sm text-foreground/80 hover:text-primary transition-all relative group px-3 py-1.5 rounded-md bg-primary/[0.02] shadow-[0_0_8px_rgba(var(--primary-rgb),0.08)] hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] animate-text-shine"
              style={{ animationDelay: '1s' }}
              onClick={(e) => handleNavigate(e, 'traffic')}
            >
              {t.header.traffic}
              <span className="absolute -bottom-0.5 left-3 w-0 h-0.5 bg-primary transition-all group-hover:w-[calc(100%-24px)]"></span>
            </a>
            <a 
              href="/services" 
              className="text-sm text-foreground/80 hover:text-primary transition-all relative group px-3 py-1.5 rounded-md bg-primary/[0.02] shadow-[0_0_8px_rgba(var(--primary-rgb),0.08)] hover:bg-primary/5 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] animate-text-shine"
              style={{ animationDelay: '2s' }}
              onClick={(e) => {
                e.preventDefault();
                playClickSound();
                window.location.href = '/services';
              }}
            >
              {t.header.services}
              <span className="absolute -bottom-0.5 left-3 w-0 h-0.5 bg-primary transition-all group-hover:w-[calc(100%-24px)]"></span>
            </a>
            <Button
              size="sm"
              className="bg-[#FF4500] hover:bg-[#FF4500]/90 text-white"
              onClick={() => {
                playClickSound();
                window.open('https://onlyreddit.com', '_blank');
              }}
            >
              {t.header.redditSite}
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
