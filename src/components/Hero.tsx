import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

const Hero = () => {
  return (
    <section id="about" className="min-h-screen flex items-center justify-center px-4 pt-20 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      
      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <span className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full inline-block mb-6">
              OnlyFans Management Agency
            </span>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent leading-tight">
              Управляем ростом моделей на OnlyFans
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              5 лет на рынке. Помогали открывать агентства, сейчас строим своё — на лучшем из опыта и ошибок. Вы — создаёте, мы — масштабируем.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow px-8 py-6 text-lg"
                onClick={() => window.open('https://t.me/Apollo_Production', '_blank')}
              >
                Начать работу
              </Button>
              <Button 
                variant="outline" 
                className="border-primary text-primary hover:bg-primary/10 px-8 py-6 text-lg"
                onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank')}
              >
                Заполнить анкету
              </Button>
            </div>
          </div>
          
          <div className="animate-slide-in-right relative hidden lg:block">
            <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
            <div className="relative bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border shadow-glow">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Rocket className="h-24 w-24 text-primary mx-auto mb-4 animate-float" />
                  <p className="text-2xl font-bold">Apollo Production</p>
                  <p className="text-muted-foreground">OnlyFans Management</p>
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
