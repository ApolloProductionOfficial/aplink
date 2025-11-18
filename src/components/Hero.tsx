import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import customLogo from "@/assets/custom-logo.jpg";

const Hero = () => {
  const { playClickSound } = useButtonSound();
  
  return (
    <section id="about" className="min-h-[85vh] flex items-center justify-center px-4 pt-0 -mt-8 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-slide-up">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              OnlyFans Management Agency
            </span>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Управляем ростом моделей на OnlyFans
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              5 лет на рынке. Помогали открывать агентства, сейчас строим своё — на лучшем из опыта и ошибок. Вы — создаёте, мы — масштабируем.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  playClickSound();
                  window.open('https://t.me/Apollo_Production', '_blank');
                }}
              >
                Начать работу
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                className="border-border hover:bg-accent/10"
                onClick={() => {
                  playClickSound();
                  window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
                }}
              >
                Заполнить анкету
              </Button>
            </div>
          </div>
          
          <div className="animate-slide-in-right relative hidden lg:block">
            <div className="relative group">
              {/* Background glow effects */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent blur-2xl animate-pulse-glow" />
              
              {/* Main logo container */}
              <div className="relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl rounded-2xl p-8 border border-primary/30 overflow-hidden shadow-2xl shadow-primary/10 animate-float">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,188,212,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-gradient" />
                
                {/* Logo image with aspect ratio */}
                <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50">
                  <img 
                    src={customLogo} 
                    alt="Apollo Production Logo" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  
                  {/* Hover overlay effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
                
                {/* Floating particles around */}
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse-glow"
                    style={{
                      top: `${20 + Math.random() * 60}%`,
                      left: `${i % 2 === 0 ? -8 : 'calc(100% + 8px)'}`,
                      animation: `float ${4 + i * 0.5}s ease-in-out infinite`,
                      animationDelay: `${i * 0.3}s`
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
