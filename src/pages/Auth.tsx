import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Chrome, ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import AnimatedBackground from '@/components/AnimatedBackground';
import StarField from '@/components/StarField';
import CustomCursor from '@/components/CustomCursor';
import logoVideo from '@/assets/logo-video.mov';

const emailSchema = z.string().email('Неверный формат email');
const passwordSchema = z.string().min(6, 'Пароль должен быть минимум 6 символов');
const nameSchema = z.string().min(2, 'Имя должно быть минимум 2 символа').max(50, 'Имя слишком длинное');

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading, signIn, signUp, signInWithGoogle } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; name?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    
    if (!isLogin) {
      const nameResult = nameSchema.safeParse(displayName);
      if (!nameResult.success) {
        newErrors.name = nameResult.error.errors[0].message;
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
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Ошибка входа',
              description: 'Неверный email или пароль',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Ошибка',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Добро пожаловать!',
            description: 'Вы успешно вошли в аккаунт',
          });
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({
              title: 'Ошибка регистрации',
              description: 'Этот email уже зарегистрирован',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Ошибка',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Аккаунт создан!',
            description: 'Добро пожаловать в APLink',
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
        title: 'Ошибка',
        description: 'Не удалось войти через Google',
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
        </div>
      </header>

      {/* Auth Form */}
      <main className="relative z-10 min-h-screen flex items-center justify-center px-4 pt-20">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? 'Вход в аккаунт' : 'Регистрация'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Войдите чтобы сохранять записи звонков' 
                : 'Создайте аккаунт для записи созвонов'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="outline"
              className="w-full h-12 gap-2"
            >
              <Chrome className="w-5 h-5" />
              Продолжить с Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">или</span>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Ваше имя"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10 h-12"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                  )}
                </div>
              )}
              
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
              
              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password}</p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                ) : isLogin ? (
                  'Войти'
                ) : (
                  'Зарегистрироваться'
                )}
              </Button>
            </form>
            
            <div className="text-center pt-4">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin 
                  ? 'Нет аккаунта? Зарегистрироваться' 
                  : 'Уже есть аккаунт? Войти'
                }
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
