import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-10" />
      <div className="container mx-auto relative z-10">
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
            Готовы начать зарабатывать?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Напишите нам в Telegram — обсудим текущие показатели, цели и стартовую стратегию.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow px-8 py-6 text-lg animate-pulse-glow"
              onClick={() => window.open('https://t.me/Apollo_Production', '_blank')}
            >
              Связаться в Telegram
            </Button>
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary/10 px-8 py-6 text-lg"
              onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank')}
            >
              Заполнить анкету
            </Button>
            <Button 
              variant="outline" 
              className="border-primary text-primary hover:bg-primary/10 px-8 py-6 text-lg"
              onClick={() => window.open('https://t.me/MenuOnly4Friends', '_blank')}
            >
              Присоединиться к группе
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
