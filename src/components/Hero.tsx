import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Sparkles } from "lucide-react";

const Hero = () => {
  return (
    <section className="pt-32 pb-20 px-4 relative overflow-hidden">
      <div className="container mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-slide-in-left">
            <div className="inline-block animate-pulse-glow">
              <span className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full backdrop-blur-sm border border-primary/20 flex items-center gap-2 w-fit">
                <Sparkles className="h-4 w-4 animate-spin" style={{ animationDuration: '3s' }} />
                5 лет на рынке
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
              Управляем ростом
              <span className="block text-primary mt-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient">
                моделей на OnlyFans
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed">
              Помогали открывать агентства, собрали лучший опыт и ошибки — строим своё OnlyFans‑агентство полного цикла. 
              <span className="block mt-2">
                Вы — создаёте, мы — масштабируем.
              </span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow group transition-all hover:scale-105 animate-pulse-glow">
                Начать работу
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-2 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="border-primary text-primary hover:bg-primary/10 transition-all hover:scale-105 hover:shadow-glow">
                Анкета для моделей
              </Button>
            </div>
          </div>
          
          <div className="relative animate-slide-in-right">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-3xl animate-pulse-glow" />
            <div className="relative bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border shadow-glow transition-all hover:scale-105 hover:shadow-[0_0_60px_hsl(190_100%_50%/0.3)]">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center animate-pulse-glow">
                    <TrendingUp className="h-6 w-6 text-primary animate-float" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Быстрые ссылки</h3>
                    <div className="space-y-3">
                      {[
                        "Разблокировка крипты (Fansly)",
                        "Telegram",
                        "Консалтинг",
                        "Анкета для новых моделей",
                        "Telegram‑группа"
                      ].map((link, index) => (
                        <a 
                          key={index}
                          href="#" 
                          className="block text-foreground/80 hover:text-primary transition-all hover:translate-x-2 relative pl-4 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:bg-primary before:rounded-full before:opacity-0 hover:before:opacity-100 before:transition-opacity"
                        >
                          → {link}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-border">
                  <p className="text-muted-foreground mb-4">
                    Рекрут моделей открыт — заполните анкету и получите стартовый план.
                  </p>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-glow">
                    Заполнить анкету
                  </Button>
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
