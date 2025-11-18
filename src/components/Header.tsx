import { Button } from "@/components/ui/button";
import { Rocket, Menu, X } from "lucide-react";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border animate-slide-up">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <Rocket className="h-6 w-6 text-primary transition-transform group-hover:rotate-12 group-hover:scale-110" />
            <span className="text-lg md:text-xl font-bold">
              Apollo Production — OnlyFans Management Agency
            </span>
          </div>
          
          <nav className="hidden lg:flex items-center gap-6">
            <a href="#about" className="text-foreground/80 hover:text-primary transition-all">
              О нас
            </a>
            <a href="#traffic" className="text-foreground/80 hover:text-primary transition-all">
              Источники трафика
            </a>
            <a href="#services" className="text-foreground/80 hover:text-primary transition-all">
              Услуги
            </a>
            <a href="#infrastructure" className="text-foreground/80 hover:text-primary transition-all">
              Инфраструктура
            </a>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.open('https://onlyreddit.com', '_blank')}
            >
              Reddit сайт
            </Button>
          </nav>
          
          <button 
            className="lg:hidden text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 space-y-4 animate-slide-up">
            <a href="#about" className="block text-foreground/80 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
              О нас
            </a>
            <a href="#traffic" className="block text-foreground/80 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
              Источники трафика
            </a>
            <a href="#services" className="block text-foreground/80 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
              Услуги
            </a>
            <a href="#infrastructure" className="block text-foreground/80 hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
              Инфраструктура
            </a>
            <Button 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => window.open('https://onlyreddit.com', '_blank')}
            >
              Reddit сайт
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
