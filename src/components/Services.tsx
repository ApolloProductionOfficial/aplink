import { memo } from "react";
import { Users, TrendingUp, MessageCircle, Shield } from "lucide-react";

const Services = memo(() => {
  const services = [
    {
      icon: Users,
      title: "Рекрутинг моделей",
      description: "Подбор и онбординг талантливых создателей контента",
    },
    {
      icon: TrendingUp,
      title: "Масштабирование",
      description: "Стратегии роста и увеличения дохода",
    },
    {
      icon: MessageCircle,
      title: "Менеджмент",
      description: "Полное управление аккаунтом и коммуникацией",
    },
    {
      icon: Shield,
      title: "Безопасность",
      description: "Защита контента и работа с платформами",
    },
  ];

  return (
    <section id="services" className="py-20 px-4 bg-secondary/30 relative overflow-hidden">
      <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      
      <div className="container mx-auto relative z-10">
        <div className="text-center mb-12 animate-slide-up">
          <span className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full inline-block mb-4">
            Услуги
          </span>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Что мы предлагаем
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-gradient-card backdrop-blur-xl rounded-2xl p-6 border border-border hover:shadow-glow transition-all duration-500 group hover:scale-105 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 animate-pulse-glow">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {service.title}
              </h3>
              <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

Services.displayName = "Services";

export default Services;
