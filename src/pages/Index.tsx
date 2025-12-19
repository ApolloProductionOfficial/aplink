import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, Users, Globe, Shield, ArrowRight, Sparkles, MessageCircle, ExternalLink, User, LogOut, UserPlus, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/useTranslation";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";
import CustomCursor from "@/components/CustomCursor";
import logoVideo from "@/assets/logo-video.mov";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import promoVideo from "@/assets/promo-video.mp4";

const Index = () => {
  const [searchParams] = useSearchParams();
  // Convert dashes back to spaces for room name from URL
  const roomFromUrl = (searchParams.get("room") || "").replace(/-/g, ' ');
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  
  const languages = {
    ru: { label: 'Русский', flag: '🇷🇺' },
    en: { label: 'English', flag: '🇬🇧' },
    uk: { label: 'Українська', flag: '🇺🇦' }
  };
  const [roomName, setRoomName] = useState(roomFromUrl);
  const [userName, setUserName] = useState("");
  const [bannerVisible, setBannerVisible] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isLoading, signOut, signInWithGoogle } = useAuth();
  const { toast } = useToast();

  // Update room name if URL param changes
  useEffect(() => {
    if (roomFromUrl) {
      setRoomName(roomFromUrl);
    }
  }, [roomFromUrl]);

  // Pre-fill username from profile
  useEffect(() => {
    if (user && !userName) {
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '';
      setUserName(displayName);
    }
  }, [user, userName]);

  const handleJoinRoom = () => {
    if (roomName.trim() && userName.trim()) {
      // Use dashes in URL for cleaner look
      const cleanRoomName = roomName.trim().replace(/ /g, '-');
      navigate(`/room/${encodeURIComponent(cleanRoomName)}?name=${encodeURIComponent(userName.trim())}`);
    }
  };

  const handleCreateRoom = () => {
    const randomRoom = `APLink-${Math.random().toString(36).substring(2, 8)}`;
    if (userName.trim()) {
      navigate(`/room/${randomRoom}?name=${encodeURIComponent(userName.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: t.auth?.errors?.error || 'Ошибка',
        description: t.auth?.errors?.googleError || 'Не удалось войти через Google',
        variant: 'destructive',
      });
    }
    setGoogleLoading(false);
  };

  const features = [
    {
      icon: Globe,
      title: t.aplink?.features?.noBorders || "Без границ",
      description: t.aplink?.features?.noBordersDesc || "Работает из любой страны мира, включая Россию"
    },
    {
      icon: Shield,
      title: t.aplink?.features?.privacy || "Приватность",
      description: t.aplink?.features?.privacyDesc || "Защищённые звонки только для вас и ваших коллег"
    },
    {
      icon: Video,
      title: t.aplink?.features?.hdQuality || "HD качество",
      description: t.aplink?.features?.hdQualityDesc || "Чистый звук и отличная картинка"
    },
    {
      icon: Users,
      title: t.aplink?.features?.groupCalls || "Групповые звонки",
      description: t.aplink?.features?.groupCallsDesc || "До 100 участников в одной комнате"
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
            <video 
              src={logoVideo} 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-10 h-10 object-cover rounded-full"
            />
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                APLink
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground -mt-1">
                by Apollo Production
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://t.me/Apollo_Production" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t.aplink?.telegram || 'Telegram'}</span>
            </a>
            <a 
              href="https://apolloproduction.studio" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">{t.aplink?.website || 'Сайт'}</span>
            </a>
            
            {/* Auth buttons */}
            {isLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            ) : user ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                  className="gap-1.5 h-8 px-3"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{isAdmin ? (t.aplink?.admin || 'Админ') : (t.aplink?.cabinet || 'Кабинет')}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="h-8 w-8 p-0"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="gap-1.5 h-8 px-3"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.auth?.loginButton || 'Войти'}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/auth?mode=register')}
                  className="gap-1.5 h-8 px-3 bg-primary hover:bg-primary/90"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.auth?.registerButton || 'Регистрация'}</span>
                </Button>
              </div>
            )}
            
            {/* Language Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 h-8 px-2 hover:bg-primary/10"
                >
                  <Globe className="h-4 w-4 text-primary" />
                  <span className="text-base">{languages[language].flag}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-card/95 backdrop-blur-xl border-primary/20 shadow-xl">
                {Object.entries(languages).map(([code, { label, flag }]) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => setLanguage(code as 'ru' | 'en' | 'uk')}
                    className={`${language === code ? 'bg-primary/20 border-l-2 border-primary' : ''} hover:bg-primary/10 cursor-pointer`}
                  >
                    <span className="mr-2 text-lg">{flag}</span>
                    <span className={language === code ? 'font-semibold text-primary' : ''}>{label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-pulse-glow">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">{t.aplink?.badge || 'Видеозвонки нового поколения'}</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-slide-up">
              <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-text-shimmer">
                {t.aplink?.title || 'Созвоны без границ'}
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '100ms' }}>
              {t.aplink?.description || 'Приватные видеозвонки с коллегами и партнёрами из любой точки мира. Никаких ограничений по IP — работает везде.'}
            </p>

            {/* Join Form */}
            <div className="max-w-md mx-auto space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <div className="glass rounded-2xl p-6 space-y-4">
                <Input
                  type="text"
                  placeholder={t.aplink?.yourName || 'Ваше имя'}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-background/50 border-border/50 h-12 text-lg"
                />
                <Input
                  type="text"
                  placeholder={t.aplink?.roomName || 'Название комнаты (или оставьте пустым)'}
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
                    {t.aplink?.createRoom || 'Создать комнату'}
                  </Button>
                  {roomName && (
                    <Button
                      onClick={handleJoinRoom}
                      disabled={!userName.trim()}
                      variant="outline"
                      className="flex-1 h-12 text-lg border-primary/50 hover:bg-primary/10 transition-all duration-300 hover:scale-105"
                    >
                      <ArrowRight className="w-5 h-5 mr-2" />
                      {t.aplink?.joinRoom || 'Войти'}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Registration banner for non-authenticated users */}
              {!isLoading && !user && bannerVisible && (
                <div className="glass rounded-2xl p-6 border border-primary/30 relative">
                  <button
                    onClick={() => setBannerVisible(false)}
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                  >
                    ×
                  </button>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-semibold text-lg mb-1">{t.aplink?.createAccount || 'Создайте аккаунт'}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {t.aplink?.createAccountDesc || 'Сохраняйте записи звонков, получайте AI-конспекты встреч и синхронизируйте историю на всех устройствах'}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <Button
                          onClick={() => navigate('/auth?mode=register')}
                          className="w-full sm:w-auto h-10 gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          {t.aplink?.register || 'Зарегистрироваться'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleGoogleSignIn}
                          disabled={googleLoading}
                          className="w-full sm:w-auto h-10 gap-2"
                        >
                          {googleLoading ? (
                            <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                          ) : (
                            <Chrome className="w-4 h-4" />
                          )}
                          Google
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
            {t.aplink?.footer || '© 2025 APLink by'}{" "}
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