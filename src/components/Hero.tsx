import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";

const Hero = () => {
  const { playClickSound } = useButtonSound();
  
  return (
    <section id="about" className="min-h-screen flex items-center justify-center px-4 pt-2 relative overflow-hidden">
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
            <div className="relative bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl rounded-2xl p-8 border border-border overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,188,212,0.05)_50%,transparent_75%)] bg-[length:250%_250%] animate-gradient" />
              <div className="relative aspect-video bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-px bg-primary/20"
                      style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        width: `${Math.random() * 200 + 50}px`,
                        transform: `rotate(${Math.random() * 360}deg)`,
                        animation: `float ${Math.random() * 3 + 2}s ease-in-out infinite`,
                        animationDelay: `${Math.random() * 2}s`
                      }}
                    />
                  ))}
                </div>
                <div className="relative z-10 text-center space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center bg-background/50 backdrop-blur">
                      <span className="text-2xl font-bold text-primary">A</span>
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-bold">APOLLO</div>
                      <div className="text-xs text-muted-foreground">PRODUCTION</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span className="text-2xl font-bold">OnlyFans</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
