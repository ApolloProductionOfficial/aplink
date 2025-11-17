import { Button } from "@/components/ui/button";
import { Rocket, Menu } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border animate-slide-up">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <Rocket className="h-6 w-6 text-primary transition-transform group-hover:rotate-12 group-hover:scale-110" />
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Apollo Production
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#about" className="text-foreground/80 hover:text-primary transition-all hover:scale-110 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full">
              О нас
            </a>
            <a href="#services" className="text-foreground/80 hover:text-primary transition-all hover:scale-110 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full">
              Услуги
            </a>
            <a href="#stats" className="text-foreground/80 hover:text-primary transition-all hover:scale-110 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full">
              Статистика
            </a>
          </nav>
          
          <div className="flex items-center gap-4">
            <Button className="hidden md:flex bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow animate-pulse-glow transition-transform hover:scale-105">
              Начать работу
            </Button>
            
            <button 
              className="md:hidden text-foreground"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
        
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-4 animate-slide-up">
            <a href="#about" className="block text-foreground/80 hover:text-primary transition-colors">
              О нас
            </a>
            <a href="#services" className="block text-foreground/80 hover:text-primary transition-colors">
              Услуги
            </a>
            <a href="#stats" className="block text-foreground/80 hover:text-primary transition-colors">
              Статистика
            </a>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              Начать работу
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
