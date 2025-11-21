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
    <header className="sticky top-0 left-0 right-0 z-40 bg-gradient-to-r from-card/95 via-card/98 to-card/95 backdrop-blur-xl border-b border-primary/20 shadow-lg shadow-primary/5">
      <div className="container mx-auto px-6 md:px-8 lg:px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/30 shadow-lg shadow-primary/20">
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
            <span className="text-xs sm:text-sm md:text-base font-bold animate-text-shimmer break-words line-clamp-2 min-w-0 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text">
              {t.header.title}
            </span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-4">
            <a 
              href="#about" 
              className="text-sm font-bold text-foreground hover:text-primary transition-all duration-300 relative group px-4 py-2 rounded-lg bg-gradient-to-br from-primary/15 via-primary/10 to-primary/15 border border-primary/40 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 animate-nav-wave-1"
              onClick={(e) => handleNavigate(e, 'about')}
            >
              <span className="relative z-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">{t.header.about}</span>
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer"></span>
              <span className="absolute inset-0 rounded-lg bg-primary/20 blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></span>
            </a>
            <a 
              href="#traffic" 
              className="text-sm font-bold text-foreground hover:text-primary transition-all duration-300 relative group px-4 py-2 rounded-lg bg-gradient-to-br from-primary/15 via-primary/10 to-primary/15 border border-primary/40 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 animate-nav-wave-2"
              onClick={(e) => handleNavigate(e, 'traffic')}
            >
              <span className="relative z-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">{t.header.traffic}</span>
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer"></span>
              <span className="absolute inset-0 rounded-lg bg-primary/20 blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-300"></span>
            </a>
            <a 
              href="/services" 
              className="text-sm font-semibold text-primary hover:text-primary/90 transition-all duration-300 relative group px-4 py-2 rounded-lg bg-gradient-to-br from-primary/25 via-primary/20 to-primary/25 border border-primary/60 hover:border-primary/80 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 animate-nav-wave-3"
              onClick={(e) => {
                e.preventDefault();
                playClickSound();
                window.location.href = '/services';
              }}
            >
              <span className="relative z-10 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">{t.header.services}</span>
              <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer"></span>
              <span className="absolute inset-0 rounded-lg bg-primary/30 blur-lg opacity-60 group-hover:opacity-100 transition-opacity duration-300"></span>
            </a>
            <Button
              size="sm"
              className="relative overflow-hidden bg-gradient-to-r from-[#FF4500] to-[#FF5722] hover:from-[#FF5722] hover:to-[#FF4500] text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-[#FF4500]/30 transition-all duration-300 hover:scale-105 border border-[#FF4500]/30"
              onClick={() => {
                playClickSound();
                window.open('https://onlyreddit.com', '_blank');
              }}
            >
              <span className="relative z-10">{t.header.redditSite}</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 animate-shimmer"></span>
            </Button>
            
            {/* Language Selector - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 bg-gradient-to-br from-primary/10 to-transparent border-primary/30 hover:border-primary/50 hover:bg-primary/15 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                  onClick={playClickSound}
                >
                  <Globe className="h-4 w-4 text-primary animate-pulse-glow" />
                  <span className="text-lg">{languages[language].flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-primary/20 shadow-xl shadow-primary/10">
                {Object.entries(languages).map(([code, { label, flag }]) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => {
                      playClickSound();
                      setLanguage(code as 'ru' | 'en' | 'uk');
                    }}
                    className={`${language === code ? 'bg-primary/20 border-l-2 border-primary' : ''} hover:bg-primary/10 transition-all duration-200 cursor-pointer`}
                  >
                    <span className="mr-3 text-xl">{flag}</span>
                    <span className={language === code ? 'font-semibold text-primary' : ''}>{label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          
          {/* Language Selector - Mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="lg:hidden text-base font-semibold text-primary flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/15 transition-all duration-200"
                onClick={playClickSound}
              >
                <span className="text-lg">{languages[language].flag}</span>
                <span className="text-xs">▼</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-primary/20 shadow-xl shadow-primary/10">
              {Object.entries(languages).map(([code, { label, flag }]) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => {
                    playClickSound();
                    setLanguage(code as 'ru' | 'en' | 'uk');
                  }}
                  className={`${language === code ? 'bg-primary/20 border-l-2 border-primary' : ''} hover:bg-primary/10 transition-all duration-200 cursor-pointer`}
                >
                  <span className="mr-2 text-lg">{flag}</span>
                  <span className={language === code ? 'font-semibold text-primary' : ''}>{label}</span>
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
