import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import cfLogo from "@/assets/cf-logo.png";

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
            <div className="relative aspect-square w-full max-w-lg mx-auto">
              {/* Central glowing orb */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 h-48">
                  {/* Main glowing sphere */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-full blur-xl animate-pulse-glow" />
                  <div className="absolute inset-4 bg-gradient-to-br from-primary/90 to-primary/70 rounded-full animate-float" />
                  <div className="absolute inset-8 bg-gradient-to-br from-primary to-cyan-400 rounded-full shadow-2xl shadow-primary/50">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-gradient rounded-full" />
                  </div>
                  
                  {/* Inner logo */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img 
                      src={cfLogo} 
                      alt="CF Logo" 
                      className="w-32 h-32 z-10"
                      style={{
                        filter: 'brightness(0) saturate(100%) invert(100%) contrast(1.2) drop-shadow(0 0 30px hsl(var(--primary))) drop-shadow(0 0 10px rgba(255,255,255,0.8))',
                        imageRendering: 'crisp-edges'
                      }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Orbital rings */}
              {[1, 2, 3].map((ring) => (
                <div
                  key={ring}
                  className="absolute inset-0 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: `hsl(190 100% ${60 - ring * 10}% / ${0.3 - ring * 0.08})`,
                    animationDuration: `${15 + ring * 5}s`,
                    animationDirection: ring % 2 === 0 ? 'reverse' : 'normal',
                    margin: `${ring * 30}px`
                  }}
                />
              ))}
              
              {/* Floating particles */}
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-primary rounded-full animate-pulse-glow"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animation: `float ${3 + Math.random() * 4}s ease-in-out infinite, pulse-glow ${2 + Math.random() * 2}s ease-in-out infinite`,
                    animationDelay: `${Math.random() * 3}s`,
                    opacity: 0.4 + Math.random() * 0.6
                  }}
                />
              ))}
              
              {/* Corner accent lines */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-20 h-20`}>
                  <div className="w-full h-0.5 bg-gradient-to-r from-primary to-transparent" />
                  <div className="w-0.5 h-full bg-gradient-to-b from-primary to-transparent" />
                </div>
              ))}
              
              {/* Data stream effect */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={`stream-${i}`}
                  className="absolute h-px bg-primary/40"
                  style={{
                    top: `${10 + i * 12}%`,
                    left: 0,
                    right: 0,
                    animation: `slide-in-right ${2 + i * 0.3}s ease-in-out infinite`,
                    animationDelay: `${i * 0.4}s`
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
