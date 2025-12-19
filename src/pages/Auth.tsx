import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, ArrowLeft, Globe } from 'lucide-react';
import GoogleIcon from '@/components/icons/GoogleIcon';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AnimatedBackground from '@/components/AnimatedBackground';
import StarField from '@/components/StarField';
import CustomCursor from '@/components/CustomCursor';
import logoVideo from '@/assets/logo-video.mov';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    mode === 'register' ? 'register' : 
    mode === 'forgot' ? 'forgot' : 
    mode === 'reset' ? 'reset' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string; username?: string; confirmPassword?: string }>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { user, isLoading, signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();

  const languages = {
    ru: { label: 'Русский', flag: '🇷🇺' },
    en: { label: 'English', flag: '🇬🇧' },
    uk: { label: 'Українська', flag: '🇺🇦' }
  };

  // Redirect if already logged in (except for reset mode)
  useEffect(() => {
    if (!isLoading && user && authMode !== 'reset') {
      navigate('/');
    }
  }, [user, isLoading, navigate, authMode]);

  // Update authMode when URL params change
  useEffect(() => {
    if (mode === 'register') setAuthMode('register');
    else if (mode === 'forgot') setAuthMode('forgot');
    else if (mode === 'reset') setAuthMode('reset');
  }, [mode]);

  const emailSchema = z.string().email(t.auth.errors.invalidEmail);
  const passwordSchema = z.string().min(6, t.auth.errors.passwordMin);
  const nameSchema = z.string().min(2, t.auth.errors.nameMin).max(50, t.auth.errors.nameMax);
  const usernameSchema = z.string()
    .min(3, 'Юзернейм минимум 3 символа')
    .max(20, 'Юзернейм максимум 20 символов')
    .regex(/^[a-z0-9_]+$/, 'Только строчные буквы, цифры и _');

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; name?: string; username?: string; confirmPassword?: string } = {};
    
    if (authMode !== 'reset') {
      const emailResult = emailSchema.safeParse(email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }
    }
    
    if (authMode === 'login' || authMode === 'register') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
    }
    
    if (authMode === 'reset') {
      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = t.auth.errors.passwordMismatch;
      }
    }
    
    if (authMode === 'register') {
      const nameResult = nameSchema.safeParse(displayName);
      if (!nameResult.success) {
        newErrors.name = nameResult.error.errors[0].message;
      }
      
      const usernameResult = usernameSchema.safeParse(username);
      if (!usernameResult.success) {
        newErrors.username = usernameResult.error.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (authMode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: t.auth.errors.loginError,
              description: t.auth.errors.invalidCredentials,
              variant: 'destructive',
            });
          } else {
            toast({
              title: t.auth.errors.error,
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: t.auth.success.welcome,
            description: t.auth.success.loginSuccess,
          });
          navigate('/');
        }
      } else if (authMode === 'register') {
        const { error, data } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: t.auth.errors.registerError,
              description: t.auth.errors.emailExists,
              variant: 'destructive',
            });
          } else {
            toast({
              title: t.auth.errors.error,
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          // Update profile with username
          if (data?.user) {
            await supabase
              .from('profiles')
              .update({ username: username.toLowerCase() })
              .eq('user_id', data.user.id);
          }
          toast({
            title: t.auth.success.accountCreated,
            description: t.auth.success.welcomeToApp,
          });
          navigate('/');
        }
      } else if (authMode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            title: t.auth.errors.error,
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: t.auth.success.emailSent,
            description: t.auth.success.checkEmail,
          });
          setAuthMode('login');
        }
      } else if (authMode === 'reset') {
        const { error } = await updatePassword(password);
        if (error) {
          toast({
            title: t.auth.errors.error,
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: t.auth.success.passwordUpdated,
            description: t.auth.success.canLoginNow,
          });
          navigate('/');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: t.auth.errors.error,
        description: t.auth.errors.googleError,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const getTitle = () => {
    switch (authMode) {
      case 'login': return t.auth.login;
      case 'register': return t.auth.register;
      case 'forgot': return t.auth.forgotPassword;
      case 'reset': return t.auth.resetPassword;
    }
  };

  const getDescription = () => {
    switch (authMode) {
      case 'login': return t.auth.loginDescription;
      case 'register': return t.auth.registerDescription;
      case 'forgot': return t.auth.forgotDescription;
      case 'reset': return t.auth.resetDescription;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden cursor-none">
      <AnimatedBackground />
      <StarField />
      <CustomCursor />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-5 h-5" />
            <video 
              src={logoVideo} 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-10 h-10 object-cover rounded-full"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              APLink
            </span>
          </button>
          
          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 bg-background/50 border-border/50 hover:bg-primary/10"
              >
                <Globe className="h-4 w-4 text-primary" />
                <span className="text-lg">{languages[language].flag}</span>
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
      </header>

      {/* Auth Form */}
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {getTitle()}
            </CardTitle>
            <CardDescription>
              {getDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(authMode === 'login' || authMode === 'register') && (
              <>
                <Button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 gap-2"
                >
                  <GoogleIcon className="w-5 h-5" />
                  {t.auth.continueWithGoogle}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t.auth.or}</span>
                  </div>
                </div>
              </>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={t.auth.namePlaceholder}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10 h-12"
                      />
                    </div>
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name}</p>
                    )}
                  </div>
                  <div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        type="text"
                        placeholder="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="pl-10 h-12"
                        maxLength={20}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      По этому @username вас смогут найти и добавить в контакты
                    </p>
                    {errors.username && (
                      <p className="text-sm text-destructive mt-1">{errors.username}</p>
                    )}
                  </div>
                </>
              )}
              
              {authMode !== 'reset' && (
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
              )}
              
              {(authMode === 'login' || authMode === 'register' || authMode === 'reset') && (
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={authMode === 'reset' ? t.auth.newPassword : t.auth.password}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                </div>
              )}
              
              {authMode === 'reset' && (
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder={t.auth.confirmPassword}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={loading}
                variant="outline"
                className="w-full h-12 border-primary/50 hover:bg-primary/10 hover:border-primary"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                ) : authMode === 'login' ? t.auth.loginButton : 
                   authMode === 'register' ? t.auth.registerButton :
                   authMode === 'forgot' ? t.auth.sendResetLink :
                   t.auth.updatePassword}
              </Button>
            </form>
            
            {authMode === 'login' && (
              <div className="text-center">
                <button
                  onClick={() => setAuthMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.forgotPasswordLink}
                </button>
              </div>
            )}
            
            <div className="text-center pt-2">
              {authMode === 'login' && (
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.noAccount}
                </button>
              )}
              {authMode === 'register' && (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.hasAccount}
                </button>
              )}
              {(authMode === 'forgot' || authMode === 'reset') && (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setErrors({});
                  }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.auth.backToLogin}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;