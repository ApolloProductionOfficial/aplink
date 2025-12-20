import { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface TwoFactorVerifyProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export const TwoFactorVerify = ({ onSuccess, onCancel }: TwoFactorVerifyProps) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Get the TOTP factor
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;
      
      const totpFactor = factorsData.totp[0];
      
      if (!totpFactor) {
        throw new Error('Фактор 2FA не найден');
      }
      
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      
      if (challengeError) throw challengeError;
      
      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      
      if (verifyError) throw verifyError;
      
      toast({
        title: 'Успешно',
        description: 'Вы успешно вошли в систему',
      });
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Неверный код. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-2">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Двухфакторная аутентификация</CardTitle>
        <CardDescription>
          Введите 6-значный код из вашего приложения-аутентификатора
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-2xl tracking-widest h-14"
            autoFocus
          />
          
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>
        
        <Button
          onClick={handleVerify}
          disabled={loading || verifyCode.length !== 6}
          className="w-full h-12"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Подтвердить'
          )}
        </Button>
        
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
          >
            Отмена
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorVerify;
