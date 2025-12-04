import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, Users, Globe, Shield, ArrowRight, Sparkles, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";
import CustomCursor from "@/components/CustomCursor";
import cfLogo from "@/assets/cf-logo-final.png";
import promoVideo from "@/assets/promo-video.mp4";

const Index = () => {
  const [roomName, setRoomName] = useState("");
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  const handleJoinRoom = () => {
    if (roomName.trim() && userName.trim()) {
      navigate(`/room/${encodeURIComponent(roomName.trim())}?name=${encodeURIComponent(userName.trim())}`);
    }
  };

  const handleCreateRoom = () => {
    const randomRoom = `APLink-${Math.random().toString(36).substring(2, 8)}`;
    if (userName.trim()) {
      navigate(`/room/${randomRoom}?name=${encodeURIComponent(userName.trim())}`);
    }
  };

  const features = [
    {
      icon: Globe,
      title: "Без границ",
      description: "Работает из любой страны мира, включая Россию"
    },
    {
      icon: Shield,
      title: "Приватность",
      description: "Защищённые звонки только для вас и ваших коллег"
    },
    {
      icon: Video,
      title: "HD качество",
      description: "Чистый звук и отличная картинка"
    },
    {
      icon: Users,
      title: "Групповые звонки",
      description: "До 100 участников в одной комнате"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <AnimatedBackground />
      <StarField />
      <CustomCursor />
      
      {/* Video Background */}
      <div className="fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="min-w-full min-h-full object-cover opacity-30"
        >
          <source src={promoVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/60" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={cfLogo} alt="Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              APLink
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://t.me/Apollo_Production" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Telegram</span>
            </a>
            <a 
              href="https://apolloproduction.studio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Сайт</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-pulse-glow">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Видеозвонки нового поколения</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-text-shimmer">
                Созвоны без границ
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
              Приватные видеозвонки с коллегами и партнёрами из любой точки мира. 
              Никаких ограничений по IP — работает везде.
            </p>

            {/* Join Form */}
            <div className="max-w-md mx-auto space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="glass rounded-2xl p-6 space-y-4">
                <Input
                  type="text"
                  placeholder="Ваше имя"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-background/50 border-border/50 h-12 text-lg"
                />
                <Input
                  type="text"
                  placeholder="Название комнаты (или оставьте пустым)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="bg-background/50 border-border/50 h-12 text-lg"
                  onKeyDown={(e) => e.key === 'Enter' && (roomName ? handleJoinRoom() : handleCreateRoom())}
                />
                <div className="flex gap-3">
                  <Button
                    onClick={handleCreateRoom}
                    disabled={!userName.trim()}
                    className="flex-1 h-12 text-lg bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Создать комнату
                  </Button>
                  {roomName && (
                    <Button
                      onClick={handleJoinRoom}
                      disabled={!userName.trim()}
                      variant="outline"
                      className="flex-1 h-12 text-lg border-primary/50 hover:bg-primary/10 transition-all duration-300 hover:scale-105"
                    >
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Войти
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="glass rounded-2xl p-6 text-center hover:scale-105 transition-all duration-300 animate-slide-up group"
                style={{ animationDelay: `${300 + index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-border/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © 2025 APLink by{" "}
            <a 
              href="https://apolloproduction.studio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Apollo Production
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
