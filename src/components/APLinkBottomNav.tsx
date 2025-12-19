import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, ExternalLink, MessageCircle, Star, Video, LogIn } from "lucide-react";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { useAuth } from "@/hooks/useAuth";

interface APLinkBottomNavProps {
  onFavoritesClick?: () => void;
  onCreateClick?: () => void;
}

const APLinkBottomNav = ({ onFavoritesClick, onCreateClick }: APLinkBottomNavProps) => {
  const navigate = useNavigate();
  const isVisible = useScrollVisibility(true, 100);
  const { user, isAdmin } = useAuth();
  const [activeRipple, setActiveRipple] = useState<number | null>(null);

  const navItems = [
    { 
      icon: user ? User : LogIn, 
      label: user ? (isAdmin ? 'Админ' : 'Кабинет') : 'Войти', 
      action: () => user ? navigate(isAdmin ? '/admin' : '/dashboard') : navigate('/auth')
    },
    { 
      icon: ExternalLink, 
      label: 'Сайт', 
      action: () => window.open('https://apolloproduction.studio', '_blank')
    },
    { 
      icon: MessageCircle, 
      label: 'Telegram', 
      action: () => window.open('https://t.me/Apollo_Production', '_blank')
    },
    { 
      icon: Star, 
      label: 'Избранные', 
      action: () => onFavoritesClick?.()
    },
    { 
      icon: Video, 
      label: 'Создать', 
      action: () => onCreateClick?.(),
      highlight: true
    },
  ];

  const handleNavClick = (item: typeof navItems[0], index: number) => {
    setActiveRipple(index);
    setTimeout(() => setActiveRipple(null), 600);
    item.action();
  };

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe transition-all duration-500 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-primary/8 to-primary/3" />
      
      {/* Top border with glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      <div className="relative flex items-center justify-around h-16 px-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isHighlight = item.highlight;
          
          return (
            <button
              key={index}
              onClick={() => handleNavClick(item, index)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
                isHighlight
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Ripple effect on click */}
              {activeRipple === index && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 animate-ping" />
                </div>
              )}
              
              {/* Glow effect for highlight item */}
              {isHighlight && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full blur-xl bg-primary/15 animate-pulse-glow" />
                </div>
              )}
              
              {/* Icon container */}
              <div className={`relative mb-1 transition-all duration-300 ${
                isHighlight ? 'scale-110' : 'scale-100'
              } hover:scale-110`}>
                <Icon 
                  className={`w-5 h-5 relative z-10 ${
                    isHighlight ? 'drop-shadow-[0_0_6px_rgba(6,182,228,0.5)]' : ''
                  }`}
                />
                
                {/* Floating particles for highlight icon */}
                {isHighlight && (
                  <>
                    <div className="absolute -top-1 -right-1 w-1 h-1 rounded-full bg-primary animate-ping" style={{ animationDelay: '0s' }} />
                    <div className="absolute -bottom-1 -left-1 w-1 h-1 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.3s' }} />
                  </>
                )}
              </div>
              
              {/* Label */}
              <span className={`text-[10px] font-medium relative z-10 ${
                isHighlight ? 'font-bold text-primary' : ''
              }`}>
                {item.label}
              </span>
              
              {/* Active indicator for highlight */}
              {isHighlight && (
                <>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-full" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-2 bg-primary/10 blur-md" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default APLinkBottomNav;
