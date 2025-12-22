import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Video, Users, Globe, Shield, ArrowRight, MessageCircle, ExternalLink, User, LogOut, UserPlus, Check, Languages, Zap } from "lucide-react";
import GoogleIcon from "@/components/icons/GoogleIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "@/hooks/useTranslation";
import { usePresence } from "@/hooks/usePresence";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";
import CustomCursor from "@/components/CustomCursor";
import NeonGlow from "@/components/NeonGlow";
import FloatingOrbs from "@/components/FloatingOrbs";
import ProfileCard from "@/components/ProfileCard";
import APLinkBottomNav from "@/components/APLinkBottomNav";
import FavoritesSheet from "@/components/FavoritesSheet";
import SplashScreen from "@/components/SplashScreen";
import HowItWorks from "@/components/HowItWorks";
import FeatureCards from "@/components/FeatureCards";
import apolloLogo from "@/assets/apollo-logo.mp4";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import backgroundVideo from "@/assets/background-video-new.mp4";

const Index = () => {
  const [searchParams] = useSearchParams();
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
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [formHighlight, setFormHighlight] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const navigate = useNavigate();
  const { user, isAdmin, isLoading, signOut, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  
  usePresence();

  useEffect(() => {
    if (roomFromUrl) {
      setRoomName(roomFromUrl);
    }
  }, [roomFromUrl]);

  useEffect(() => {
    const loadUserName = async () => {
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userName) {
        if (profileData?.display_name) {
          setUserName(profileData.display_name);
        } else {
          const displayName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            '';
          setUserName(displayName);
        }
      }

      const uname = profileData?.username ?? null;
      setUserUsername(uname);
      setUserAvatarUrl(profileData?.avatar_url ?? null);
      setShowUsernameForm(!uname);
    };

    loadUserName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleJoinRoom = () => {
    if (roomName.trim() && userName.trim()) {
      const cleanRoomName = roomName.trim().replace(/ /g, '-');
      navigate(`/room/${encodeURIComponent(cleanRoomName)}?name=${encodeURIComponent(userName.trim())}`);
    }
  };

  const handleCreateRoom = () => {
    const finalRoomName = roomName.trim() 
      ? roomName.trim().replace(/ /g, '-')
      : `APLink-${Math.random().toString(36).substring(2, 8)}`;
    if (userName.trim()) {
      navigate(`/room/${encodeURIComponent(finalRoomName)}?name=${encodeURIComponent(userName.trim())}`);
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

  const handleCopyUsername = () => {
    if (userUsername) {
      navigator.clipboard.writeText(`@${userUsername}`);
      setCopied(true);
      toast({
        title: 'Скопировано',
        description: `@${userUsername} скопирован в буфер`,
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveUsername = async () => {
    if (!user || !newUsername.trim()) return;
    
    const username = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (username.length < 3) {
      toast({
        title: 'Ошибка',
        description: 'Username должен быть минимум 3 символа',
        variant: 'destructive',
      });
      return;
    }
    
    setSavingUsername(true);
    
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('user_id', user.id)
      .maybeSingle();
    
    if (existing) {
      toast({
        title: 'Ошибка',
        description: 'Этот username уже занят',
        variant: 'destructive',
      });
      setSavingUsername(false);
      return;
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ username })
      .eq('user_id', user.id);
    
    if (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить username',
        variant: 'destructive',
      });
    } else {
      setUserUsername(username);
      setShowUsernameForm(false);
      setNewUsername("");
      toast({
        title: 'Сохранено',
        description: `Ваш username: @${username}`,
      });
    }
    
    setSavingUsername(false);
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

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      
      <motion.div 
        className="min-h-screen bg-background text-foreground relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: showSplash ? 0 : 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <AnimatedBackground />
        <StarField />
        <CustomCursor />
      
        <FloatingOrbs />
        <NeonGlow />
      
        {/* Video Background */}
        <div className="fixed inset-0 z-0 flex items-center justify-center overflow-hidden bg-background">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster=""
            className="min-w-full min-h-full object-cover opacity-45 relative z-10"
            style={{ willChange: 'transform' }}
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-background via-background/80 to-background/60" />
        </div>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
          <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="relative w-10 h-10 md:w-12 md:h-12">
                <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
                <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                  <video 
                    src={apolloLogo} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover scale-[1.3] origin-center"
                    style={{ willChange: 'transform' }}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                  APLink
                </span>
                <span className="text-[9px] md:text-xs text-muted-foreground -mt-1">
                  by Apollo Production
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-3">
              {/* External links - desktop only */}
              <div className="hidden md:flex items-center gap-1">
                <a 
                  href="https://t.me/Apollo_Production" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm p-2 rounded-lg hover:bg-primary/10"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t.aplink?.telegram || 'Telegram'}</span>
                </a>
                <a 
                  href="https://apolloproduction.studio" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors text-sm p-2 rounded-lg hover:bg-primary/10"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{t.aplink?.website || 'Сайт'}</span>
                </a>
              </div>
              
              {/* Auth buttons */}
              {isLoading ? (
                <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              ) : user ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(isAdmin ? '/admin' : '/dashboard')}
                    className="gap-1 h-8 px-2 md:px-3 text-xs md:text-sm"
                  >
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{isAdmin ? (t.aplink?.admin || 'Админ') : (t.aplink?.cabinet || 'Кабинет')}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-8 w-8 p-0"
                    title={t.auth?.loginButton === 'Sign In' ? 'Sign Out' : 'Выйти'}
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 md:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="gap-1 h-8 px-2 md:px-3 text-xs md:text-sm"
                  >
                    <User className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">{t.auth?.loginButton || 'Войти'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/auth?mode=register')}
                    className="gap-1 h-8 px-2 md:px-3 text-xs md:text-sm border-primary/50 hover:bg-primary/10 hover:border-primary"
                  >
                    <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                    <span className="hidden sm:inline">{t.auth?.registerButton || 'Регистрация'}</span>
                  </Button>
                </div>
              )}
              
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1 h-8 px-2 border-border hover:bg-primary/10"
                  >
                    <Globe className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                    <span className="text-sm md:text-base">{languages[language].flag}</span>
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
        <main className="relative z-10 pt-20 md:pt-24 pb-8 md:pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center mb-12 md:mb-16">
              <motion.h1 
                className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 md:mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-text-shimmer">
                  {t.aplink?.badge || 'Видеозвонки нового поколения'}
                </span>
              </motion.h1>
              
              {/* Feature Pills */}
              <motion.div 
                className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 md:gap-2">
                  <Languages className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                  {(t.aplink as any)?.realtimeTranslator || 'Real-time Translator'}
                </span>
                <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 md:gap-2">
                  <Video className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                  {(t.aplink as any)?.aiMeetingSummaries || 'AI Meeting Summaries'}
                </span>
                <span className="px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20 text-xs md:text-sm text-muted-foreground flex items-center gap-1.5 md:gap-2">
                  <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                  {(t.aplink as any)?.noIPRestrictions || 'No IP Restrictions'}
                </span>
              </motion.div>

              {/* Join Form */}
              <motion.div 
                id="create-room-form" 
                className="max-w-md mx-auto space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className={`glass rounded-2xl p-5 md:p-6 space-y-4 relative overflow-hidden transition-all duration-1000 ease-in-out ${
                  formHighlight 
                    ? 'ring-2 ring-primary/80 shadow-[0_0_40px_rgba(6,182,212,0.5)]' 
                    : 'ring-0 ring-transparent shadow-none'
                }`}>
                  {/* Animated gradient border */}
                  <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out ${
                    formHighlight ? 'opacity-100' : 'opacity-0'
                  }`}>
                    <div className="absolute inset-0 rounded-2xl border border-primary/50" />
                    <div 
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), transparent)',
                        backgroundSize: '200% 100%',
                        animation: formHighlight ? 'shimmer 4s ease-in-out infinite' : 'none'
                      }}
                    />
                  </div>
                  <Input
                    type="text"
                    placeholder={t.aplink?.yourName || 'Ваше имя'}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="bg-background/50 border-border/50 h-11 md:h-12 text-base md:text-lg relative z-10"
                  />
                  <Input
                    type="text"
                    placeholder={t.aplink?.roomName || 'Название комнаты (или оставьте пустым)'}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="bg-background/50 border-border/50 h-11 md:h-12 text-base md:text-lg relative z-10"
                    onKeyDown={(e) => e.key === 'Enter' && (roomName ? handleJoinRoom() : handleCreateRoom())}
                  />
                  <div className="flex gap-2 md:gap-3 relative z-10">
                    <Button
                      onClick={handleCreateRoom}
                      disabled={!userName.trim()}
                      className={`flex-1 h-11 md:h-12 text-base md:text-lg bg-primary hover:bg-primary/90 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] ${
                        formHighlight ? 'shadow-lg shadow-primary/40' : ''
                      }`}
                    >
                      <Video className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                      {t.aplink?.createRoom || 'Создать комнату'}
                    </Button>
                    {roomName && (
                      <Button
                        onClick={handleJoinRoom}
                        disabled={!userName.trim()}
                        variant="outline"
                        className="flex-1 h-11 md:h-12 text-base md:text-lg border-primary/50 hover:bg-primary/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <ArrowRight className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                        {t.aplink?.joinRoom || 'Войти'}
                      </Button>
                    )}
                  </div>
                  
                  {/* Quick actions for logged in users */}
                  {!isLoading && user && (
                    <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/30">
                      <button 
                        onClick={() => setFavoritesOpen(true)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        {(t.aplink as any)?.quickCall || 'Быстрый звонок'}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Registration banner for non-authenticated users */}
                {!isLoading && !user && (
                  <motion.div 
                    className="glass rounded-2xl p-5 md:p-6 border border-primary/30"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                      </div>
                      
                      <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-semibold text-base md:text-lg mb-1">{t.aplink?.createAccount || 'Создайте аккаунт'}</h3>
                        <p className="text-xs md:text-sm text-muted-foreground mb-3">
                          {t.aplink?.createAccountDesc || 'Сохраняйте записи звонков, получайте AI-конспекты встреч и синхронизируйте историю на всех устройствах'}
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <Button
                            variant="outline"
                            onClick={() => navigate('/auth?mode=register')}
                            className="w-full sm:w-auto h-9 md:h-10 gap-2 border-primary/50 hover:bg-primary/10 hover:border-primary text-sm"
                          >
                            <UserPlus className="w-4 h-4 text-primary" />
                            {t.aplink?.register || 'Зарегистрироваться'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading}
                            className="w-full sm:w-auto h-9 md:h-10 gap-2 text-sm"
                          >
                            {googleLoading ? (
                              <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                            ) : (
                              <GoogleIcon className="w-4 h-4" />
                            )}
                            Google
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Profile Card for authenticated users */}
                {!isLoading && user && (
                  <ProfileCard
                    userUsername={userUsername}
                    userAvatarUrl={userAvatarUrl}
                    showUsernameForm={showUsernameForm}
                    newUsername={newUsername}
                    setNewUsername={setNewUsername}
                    savingUsername={savingUsername}
                    onSaveUsername={handleSaveUsername}
                    onCopyUsername={handleCopyUsername}
                    copied={copied}
                  />
                )}
              </motion.div>
            </div>

            {/* Feature Cards with animations */}
            <FeatureCards features={features} />
          </div>
          
          {/* How It Works Section - only for non-authenticated users */}
          {!user && <HowItWorks />}
        </main>

        {/* Footer */}
        <footer className="relative z-10 py-6 md:py-8 pb-24 md:pb-8 border-t border-border/30">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground text-xs md:text-sm">
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
        
        {/* Mobile Bottom Navigation */}
        <APLinkBottomNav 
          onFavoritesClick={() => setFavoritesOpen(true)}
          onCreateClick={() => {
            const formEl = document.getElementById('create-room-form');
            if (formEl) {
              formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            setFormHighlight(true);
            setTimeout(() => setFormHighlight(false), 4000);
          }}
        />
        
        {/* Favorites Sheet */}
        <FavoritesSheet open={favoritesOpen} onOpenChange={setFavoritesOpen} />
      </motion.div>
    </>
  );
};

export default Index;
