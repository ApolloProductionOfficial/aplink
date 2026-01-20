import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, ExternalLink, MessageCircle, Star, Video, LogIn, Phone, Users } from "lucide-react";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { useAuth } from "@/hooks/useAuth";
import QuickCallDialog from "./QuickCallDialog";
import GroupCallDialog from "./GroupCallDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface APLinkBottomNavProps {
  onFavoritesClick?: () => void;
  onCreateClick?: () => void;
}

const APLinkBottomNav = ({ onFavoritesClick, onCreateClick }: APLinkBottomNavProps) => {
  const navigate = useNavigate();
  const isVisible = useScrollVisibility(true, 100);
  const { user, isAdmin } = useAuth();
  const [activeRipple, setActiveRipple] = useState<number | null>(null);
  const [quickCallOpen, setQuickCallOpen] = useState(false);
  const [groupCallOpen, setGroupCallOpen] = useState(false);
  const [callMenuOpen, setCallMenuOpen] = useState(false);

  // Check if running inside Telegram WebApp
  const isTelegramWebApp = typeof window !== "undefined" && 
    !!(window as any).Telegram?.WebApp?.initData;

  const navItems = [
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
      label: isTelegramWebApp ? 'Звонок' : 'Создать',
      action: isTelegramWebApp ? () => setCallMenuOpen(true) : () => onCreateClick?.(),
      highlight: true,
      isCallMenu: isTelegramWebApp
    },
    { 
      icon: user ? User : LogIn, 
      label: user ? (isAdmin ? 'Админ' : 'Кабинет') : 'Войти', 
      action: () => user ? navigate(isAdmin ? '/admin' : '/dashboard') : navigate('/auth'),
      accent: true
    },
  ];

  const handleNavClick = (item: typeof navItems[0], index: number) => {
    if (item.isCallMenu) {
      setCallMenuOpen(true);
      return;
    }
    setActiveRipple(index);
    setTimeout(() => setActiveRipple(null), 600);
    item.action();
  };

  return (
    <>
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe"
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
          willChange: 'transform, opacity',
        }}
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/98 to-card/90 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/3 via-primary/8 to-primary/3" />
        
        {/* Top border with glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="relative flex items-center justify-around h-16 px-1">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isHighlight = item.highlight;
            const isAccent = (item as any).accent;
            const isCallMenu = item.isCallMenu;
            
            if (isCallMenu) {
              return (
                <DropdownMenu key={index} open={callMenuOpen} onOpenChange={setCallMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 text-primary`}
                    >
                      {/* Glow effect for highlight item */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full blur-xl bg-primary/15 animate-pulse-glow" />
                      </div>
                      
                      <div className="relative mb-1 scale-110 hover:scale-125 transition-transform">
                        <Icon className="w-5 h-5 relative z-10 drop-shadow-[0_0_6px_rgba(6,182,228,0.5)]" />
                        <div className="absolute -top-1 -right-1 w-1 h-1 rounded-full bg-primary animate-ping" />
                        <div className="absolute -bottom-1 -left-1 w-1 h-1 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.3s' }} />
                      </div>
                      
                      <span className="text-[10px] font-bold text-primary relative z-10">
                        {item.label}
                      </span>
                      
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-transparent via-primary/60 to-transparent rounded-full" />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-2 bg-primary/10 blur-md" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="center" 
                    className="w-48 bg-card/95 backdrop-blur-xl border-primary/20"
                    sideOffset={8}
                  >
                    <DropdownMenuItem 
                      onClick={() => {
                        setCallMenuOpen(false);
                        setQuickCallOpen(true);
                      }}
                      className="gap-3 cursor-pointer"
                    >
                      <Phone className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">Быстрый звонок</p>
                        <p className="text-xs text-muted-foreground">По имени пользователя</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setCallMenuOpen(false);
                        setGroupCallOpen(true);
                      }}
                      className="gap-3 cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">Групповой звонок</p>
                        <p className="text-xs text-muted-foreground">Из избранных контактов</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => {
                        setCallMenuOpen(false);
                        onCreateClick?.();
                      }}
                      className="gap-3 cursor-pointer"
                    >
                      <Video className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">Создать комнату</p>
                        <p className="text-xs text-muted-foreground">Обычный видеозвонок</p>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }
            
            return (
              <button
                key={index}
                onClick={() => handleNavClick(item, index)}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
                  isHighlight
                    ? "text-primary"
                    : isAccent
                    ? "text-primary/70"
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
                {isAccent && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full blur-lg bg-primary/8" />
                  </div>
                )}
                
                {/* Icon container */}
                <div className={`relative mb-1 transition-all duration-300 ${
                  isHighlight ? 'scale-110' : isAccent ? 'scale-105' : 'scale-100'
                } hover:scale-110`}>
                  <Icon 
                    className={`w-5 h-5 relative z-10 ${
                      isHighlight ? 'drop-shadow-[0_0_6px_rgba(6,182,228,0.5)]' : ''
                    } ${
                      isAccent ? 'drop-shadow-[0_0_3px_rgba(6,182,228,0.3)]' : ''
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
                } ${
                  isAccent ? 'text-primary/70' : ''
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

      {/* Quick Call Dialog */}
      <QuickCallDialog open={quickCallOpen} onOpenChange={setQuickCallOpen} />
      
      {/* Group Call Dialog */}
      <GroupCallDialog open={groupCallOpen} onOpenChange={setGroupCallOpen} />
    </>
  );
};

export default APLinkBottomNav;
