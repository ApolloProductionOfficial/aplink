import { Card, CardContent } from "@/components/ui/card";
import { Music2, Instagram, Twitter, Send, Heart, DollarSign, Search, Users, MessageSquare } from "lucide-react";
import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";

const TrafficSources = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();
  
  const sources = [
    {
      icon: Music2,
      title: t.trafficSources.tiktok.title,
      description: t.trafficSources.tiktok.description,
      gradient: "from-pink-500/20 to-purple-500/20"
    },
    {
      icon: Instagram,
      title: t.trafficSources.instagram.title,
      description: t.trafficSources.instagram.description,
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: Twitter,
      title: t.trafficSources.twitter.title,
      description: t.trafficSources.twitter.description,
      gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: Send,
      title: t.trafficSources.telegram.title,
      description: t.trafficSources.telegram.description,
      gradient: "from-blue-400/20 to-blue-600/20"
    },
    {
      icon: Heart,
      title: t.trafficSources.dating.title,
      description: t.trafficSources.dating.description,
      gradient: "from-red-500/20 to-pink-500/20"
    },
    {
      icon: DollarSign,
      title: t.trafficSources.ppc.title,
      description: t.trafficSources.ppc.description,
      gradient: "from-green-500/20 to-emerald-500/20"
    },
    {
      icon: Search,
      title: t.trafficSources.seo.title,
      description: t.trafficSources.seo.description,
      gradient: "from-yellow-500/20 to-orange-500/20"
    },
    {
      icon: Users,
      title: t.trafficSources.influencers.title,
      description: t.trafficSources.influencers.description,
      gradient: "from-indigo-500/20 to-purple-500/20"
    },
    {
      icon: MessageSquare,
      title: t.trafficSources.reddit.title,
      description: t.trafficSources.reddit.description,
      gradient: "from-orange-500/20 to-red-500/20"
    }
  ];

  return (
    <section id="traffic" className="py-12 md:py-20 px-3 md:px-4 relative">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8 md:mb-12 animate-slide-up">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
            {t.trafficSources.title}
          </h2>
          <a 
            href="/#/telegram" 
            className="text-primary hover:underline inline-flex items-center gap-1 text-sm md:text-base"
          >
            {t.trafficSources.more} →
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {sources.map((source, index) => {
            const Icon = source.icon;
            return (
              <Card 
                key={index}
                className="bg-card border-border hover:border-primary/30 transition-all duration-300 group cursor-pointer overflow-hidden"
                onClick={playClickSound}
              >
                <CardContent className="p-3 md:p-6 relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${source.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative">
                    <div className="mb-2 md:mb-4 inline-flex p-2 md:p-3 rounded-lg bg-background/50 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="h-4 w-4 md:h-6 md:w-6 text-primary" />
                    </div>
                    <h3 className="text-xs md:text-lg font-semibold mb-1.5 md:mb-3 group-hover:text-primary transition-colors leading-tight">
                      {source.title}
                    </h3>
                    <p className="text-[10px] md:text-sm text-muted-foreground leading-tight md:leading-relaxed line-clamp-3">
                      {source.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrafficSources;
