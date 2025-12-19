import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, FileText } from 'lucide-react';
import GoogleIcon from '@/components/icons/GoogleIcon';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface RegistrationBannerProps {
  className?: string;
}

const RegistrationBanner = ({ className = '' }: RegistrationBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();

  if (!isVisible) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: t.auth?.errors?.error || 'Ошибка',
        description: t.auth?.errors?.googleError || 'Не удалось войти через Google',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  return (
    <div className={`relative glass rounded-2xl p-5 border border-primary/30 ${className}`}>
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-base">{t.auth?.register || 'Регистрация'}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
            {t.auth?.registerDescription || 'Создайте аккаунт для записи созвонов'}
          </p>
          <p className="text-xs text-primary/80">
            ✓ AI-конспект звонков<br/>
            ✓ История встреч<br/>
            ✓ Синхронизация
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full">
          <Button
            size="sm"
            onClick={() => navigate('/auth?mode=register')}
            className="flex-1 h-9 text-xs"
          >
            <FileText className="w-3 h-3 mr-1" />
            {t.auth?.registerButton || 'Регистрация'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="h-9 w-9 p-0 flex-shrink-0 transition-all duration-300 hover:scale-105 hover:bg-muted/50"
            title="Войти через Google"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            ) : (
              <GoogleIcon className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationBanner;