import { Home, Briefcase, Newspaper, MessageCircle, UserPlus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isVisible = useScrollVisibility(true, 100);
  const [activeRipple, setActiveRipple] = useState<number | null>(null);

  const navItems = [
    { icon: Home, label: t.nav.home || "Home", path: "/" },
    { icon: Briefcase, label: t.nav.services || "Services", path: "/services" },
    { icon: Newspaper, label: t.nav.news || "News", path: "/all-news" },
    { icon: MessageCircle, label: "AI Chat", action: "chat" },
    { icon: UserPlus, label: t.cta.button || "Join", action: "form" },
  ];

  const handleNavClick = (item: typeof navItems[0], index: number) => {
    playClickSound();
    setActiveRipple(index);
    setTimeout(() => setActiveRipple(null), 600);
    
    if (item.action === "chat") {
      setIsChatOpen(true);
      const chatButton = document.querySelector('[data-chat-button]') as HTMLButtonElement;
      if (chatButton) chatButton.click();
    } else if (item.action === "form") {
      window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
    } else if (item.path) {
      navigate(item.path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isActive = (item: typeof navItems[0]) => {
    if (item.action === "chat") return isChatOpen;
    if (item.path === "/") return false; // Главная никогда не активна
    return location.pathname === item.path;
  };

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe transition-all duration-500 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      {/* Cosmic gradient background with animation */}
      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/95 to-card/80 backdrop-blur-xl" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/2 via-primary/5 to-primary/2 animate-pulse-glow" />
      
      {/* Top border with glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer" />
      
      <div className="relative flex items-center justify-around h-16 px-2">{navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item);
          const isChatItem = item.action === "chat";
          const isServicesItem = item.path === "/services";
          
          return (
            <button
              key={index}
              onClick={() => handleNavClick(item, index)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 ${
                isChatItem
                  ? "text-primary"
                  : isServicesItem
                  ? "text-primary/90"
                  : active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Ripple effect on click */}
              {activeRipple === index && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-primary/15 animate-ping" />
                </div>
              )}
              
              {/* Glow effect for active/chat/services items */}
              {(active || isChatItem || isServicesItem) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-10 h-10 rounded-full blur-xl ${
                    isChatItem ? 'bg-primary/10 animate-pulse-glow' : 'bg-primary/6 animate-subtle-pulse'
                  }`} />
                </div>
              )}
              
              {/* Icon container with hover animation */}
              <div className={`relative mb-1 transition-all duration-300 ${
                isChatItem ? 'animate-cosmic-glow' : ''
              } ${active || isServicesItem ? 'scale-110' : 'scale-100'} hover:scale-110`}>
                <Icon 
                  className={`w-5 h-5 relative z-10 ${
                    isChatItem ? 'drop-shadow-[0_0_4px_rgba(6,182,228,0.4)]' : ''
                  } ${
                    isServicesItem ? 'drop-shadow-[0_0_2px_rgba(6,182,228,0.15)]' : ''
                  }`}
                />
                
                {/* Floating particles for chat icon */}
                {isChatItem && (
                  <>
                    <div className="absolute -top-1 -right-1 w-1 h-1 rounded-full bg-primary animate-ping" style={{ animationDelay: '0s' }} />
                    <div className="absolute -bottom-1 -left-1 w-1 h-1 rounded-full bg-primary animate-ping" style={{ animationDelay: '0.3s' }} />
                  </>
                )}
              </div>
              
              {/* Label with animation */}
              <span className={`text-xs font-medium relative z-10 transition-all duration-300 ${
                isChatItem ? 'font-bold' : ''
              }`}>
                {item.label}
              </span>
              
              {/* Active indicator - wave effect */}
              {active && item.action !== "chat" && (
                <>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-transparent via-primary/70 to-transparent rounded-full animate-shimmer" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-2 bg-primary/10 blur-md" />
                </>
              )}
              
              {/* Cosmic glow ring for chat */}
              {isChatItem && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 rounded-full border-2 border-primary/15 animate-ping" style={{ animationDuration: '2s' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
