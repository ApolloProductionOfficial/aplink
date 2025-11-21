import { Home, Briefcase, Newspaper, MessageCircle, UserPlus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isVisible = useScrollVisibility(true, 100);

  const navItems = [
    { icon: Home, label: t.nav.home || "Home", path: "/" },
    { icon: Briefcase, label: t.nav.services || "Services", path: "/services" },
    { icon: Newspaper, label: t.nav.news || "News", path: "/all-news" },
    { icon: MessageCircle, label: "AI Chat", action: "chat" },
    { icon: UserPlus, label: t.cta.button || "Join", action: "form" },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    playClickSound();
    
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
    return location.pathname === item.path;
  };

  return (
    <nav className={`md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/50 z-50 pb-safe transition-all duration-300 ${
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      <div className="flex items-center justify-around h-16">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item);
          
          return (
            <button
              key={index}
              onClick={() => handleNavClick(item)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 hover:scale-105 ${
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon 
                className={`w-5 h-5 mb-1 transition-all duration-300 ${
                  active ? "scale-110 animate-pulse" : ""
                }`} 
              />
              <span className="text-xs font-medium">{item.label}</span>
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-slide-in-bottom" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
