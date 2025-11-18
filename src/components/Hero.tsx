import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import cfLogo from "@/assets/cf-logo-final.png";

const Hero = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  
  return (
    <section id="about" className="min-h-[85vh] flex items-center justify-center px-4 pt-0 -mt-8 relative overflow-hidden">
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-slide-up">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t.hero.badge}
            </span>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              {t.hero.title}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t.hero.description}
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
                {t.hero.startButton}
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
                {t.hero.formButton}
              </Button>
            </div>
          </div>
          
          <div className="animate-slide-in-right relative hidden lg:block">
            <div className="relative aspect-square w-full max-w-lg mx-auto">
              {/* Central cosmic glow */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
              </div>
              
              {/* Static glow that doesn't rotate */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-72 rounded-full blur-3xl animate-pulse-glow" style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, hsla(var(--primary),0.3) 40%, transparent 70%)' }} />
                <div className="absolute w-80 h-80 bg-primary/15 rounded-full blur-2xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
              </div>
              
              {/* Logo with additional backlight */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 bg-primary/25 rounded-full blur-xl" />
              </div>
              
              {/* Logo */}
              <div className="absolute inset-0 flex items-center justify-center z-50" style={{ perspective: '1000px' }}>
                <div style={{ transformStyle: 'preserve-3d', animation: 'rotate3d 20s linear infinite' }}>
                  <img 
                    src={cfLogo} 
                    alt="CF Logo" 
                    className="w-56 h-56 object-contain"
                    style={{
                      filter: 'brightness(1.1) contrast(1.2) drop-shadow(2px 2px 0px rgba(0,0,0,0.9)) drop-shadow(4px 4px 0px rgba(0,0,0,0.7)) drop-shadow(6px 6px 0px rgba(0,0,0,0.5)) drop-shadow(8px 8px 0px rgba(0,0,0,0.3))',
                      imageRendering: 'crisp-edges',
                    }}
                  />
                </div>
              </div>
              
              {/* Orbital rings */}
              {[1, 2, 3, 4].map((ring) => (
                <div
                  key={ring}
                  className="absolute inset-0 border-2 border-primary/40 rounded-full"
                  style={{
                    animation: `spin ${20 + ring * 8}s linear infinite`,
                    animationDirection: ring % 2 === 0 ? 'reverse' : 'normal',
                    margin: `${ring * 25}px`,
                    borderStyle: ring % 2 === 0 ? 'dashed' : 'solid',
                    boxShadow: `0 0 10px hsl(var(--primary) / 0.3)`
                  }}
                />
              ))}
              
              {/* Space particles / stars */}
              {[...Array(40)].map((_, i) => {
                const size = Math.random() > 0.7 ? 'w-1 h-1' : 'w-0.5 h-0.5';
                return (
                  <div
                    key={i}
                    className={`absolute ${size} bg-primary rounded-full`}
                    style={{
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      animation: `float ${4 + Math.random() * 6}s ease-in-out infinite, pulse-glow ${1.5 + Math.random() * 3}s ease-in-out infinite`,
                      animationDelay: `${Math.random() * 4}s`,
                      opacity: 0.5 + Math.random() * 0.5,
                      boxShadow: '0 0 6px hsl(var(--primary))'
                    }}
                  />
                );
              })}
              
              {/* Cosmic rays */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-32 h-32 opacity-60`}>
                  <div className="w-full h-px bg-gradient-to-r from-primary/80 via-primary/40 to-transparent" 
                       style={{ animation: 'pulse-glow 4s ease-in-out infinite', animationDelay: `${i * 0.5}s` }} />
                  <div className="w-px h-full bg-gradient-to-b from-primary/80 via-primary/40 to-transparent"
                       style={{ animation: 'pulse-glow 4s ease-in-out infinite', animationDelay: `${i * 0.5}s` }} />
                </div>
              ))}
              
              {/* Cosmic energy waves */}
              {[...Array(6)].map((_, i) => (
                <div
                  key={`wave-${i}`}
                  className="absolute h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                  style={{
                    top: `${15 + i * 15}%`,
                    left: '-10%',
                    right: '-10%',
                    animation: `slide-in-right ${3 + i * 0.5}s ease-in-out infinite`,
                    animationDelay: `${i * 0.6}s`,
                    opacity: 0.7,
                    boxShadow: '0 0 4px hsl(var(--primary))'
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
