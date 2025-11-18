import { MessageCircle, Instagram, Twitter, Send, Heart, DollarSign, Globe, Users, MessageSquare } from "lucide-react";

const TrafficSources = () => {
  const sources = [
    {
      icon: MessageCircle,
      title: "TikTok (фермы)",
      description: "UGC‑сетки, Spark Ads, системный тест креативов и вертикалей."
    },
    {
      icon: Instagram,
      title: "Instagram (моб. фермы)",
      description: "Мобильные фермы, рилсы, прогрев, автоворонки и безопасные сетапы."
    },
    {
      icon: Twitter,
      title: "X (Twitter)",
      description: "NSFW‑friendly: треды, медиа, рост аудитории и прогрев."
    },
    {
      icon: Send,
      title: "Telegram",
      description: "Лиды в чат, быстрые продажи, SFS и рекламные сетки."
    },
    {
      icon: Heart,
      title: "Dating (Tinder и др.)",
      description: "Дейтинговые конверсии в офферы и тёплые диалоги с высокой монетизацией."
    },
    {
      icon: DollarSign,
      title: "PPC",
      description: "Google/Meta (где возможно), pre‑landing, ретаргет и атрибуция."
    },
    {
      icon: Globe,
      title: "Microsites / SEO",
      description: "Прокладки, индексация, трафик из поиска и контент‑кластеры."
    },
    {
      icon: Users,
      title: "Influencers / Collabs",
      description: "Коллаборации, взаимные прогревы и перекрёстный трафик."
    },
    {
      icon: MessageSquare,
      title: "Reddit",
      description: "Вся информация перенесена — переходите на onlyreddit.com."
    }
  ];

  return (
    <section id="traffic" className="py-20 px-4 bg-secondary/30 relative overflow-hidden">
      <div className="absolute top-1/4 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
      
      <div className="container mx-auto relative z-10">
        <div className="text-center mb-12 animate-slide-up">
          <span className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full inline-block mb-4">
            Источники трафика
          </span>
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-4">
            Откуда мы привлекаем аудиторию
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sources.map((source, index) => (
            <div
              key={index}
              className="bg-gradient-card backdrop-blur-xl rounded-2xl p-6 border border-border hover:shadow-glow transition-all duration-500 group hover:scale-105 animate-slide-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                <source.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                {source.title}
              </h3>
              <p className="text-muted-foreground group-hover:text-foreground/80 transition-colors text-sm">
                {source.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrafficSources;
