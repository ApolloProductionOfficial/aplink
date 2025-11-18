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
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-full blur-3xl animate-pulse-glow" />
              
              {/* Rotating ring */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-spin" style={{ animationDuration: '20s' }} />
              
              {/* Main logo container */}
              <div className="relative aspect-square w-full max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-card to-card/50 backdrop-blur-xl rounded-full border-2 border-primary/40 animate-float overflow-hidden shadow-2xl shadow-primary/20">
                  {/* Animated gradient overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,188,212,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-gradient" />
                  
                  {/* Logo image */}
                  <img 
                    src={customLogo} 
                    alt="Apollo Production Logo" 
                    className="w-full h-full object-cover rounded-full relative z-10 transition-transform duration-700 group-hover:scale-110"
                  />
                  
                  {/* Overlay glow on hover */}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-500 rounded-full" />
                </div>
                
                {/* Orbiting particles */}
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-primary rounded-full animate-pulse-glow"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `rotate(${i * 45}deg) translateY(-200px)`,
                      animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`
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
