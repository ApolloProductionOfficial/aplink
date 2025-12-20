import { useState, useEffect } from 'react';
import { Shield, Smartphone, Check, Loader2, Copy, Download, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TwoFactorSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Generate random backup codes
const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 8 }, () => 
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
};

// Simple hash function for backup codes (client-side)
const hashCode = async (code: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.replace('-', '').toUpperCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const TwoFactorSetup = ({ isOpen, onClose, onSuccess }: TwoFactorSetupProps) => {
  const [step, setStep] = useState<'intro' | 'qr' | 'verify' | 'backup' | 'success'>('intro');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const { toast } = useToast();

  const startEnrollment = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      
      if (error) throw error;
      
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('qr');
    } catch (err: any) {
      setError(err.message || 'Ошибка при настройке 2FA');
      toast({
        title: 'Ошибка',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Challenge the factor first
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      
      if (challengeError) throw challengeError;
      
      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      
      if (verifyError) throw verifyError;
      
      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);
      
      // Store hashed backup codes in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Delete old backup codes
        await supabase.from('backup_codes').delete().eq('user_id', user.id);
        
        // Insert new hashed codes
        const hashedCodes = await Promise.all(
          codes.map(async (code) => ({
            user_id: user.id,
            code_hash: await hashCode(code),
            used: false,
          }))
        );
        
        await supabase.from('backup_codes').insert(hashedCodes);
      }
      
      setStep('backup');
      toast({
        title: 'Успешно!',
        description: 'Двухфакторная аутентификация включена',
      });
      
    } catch (err: any) {
      setError(err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      toast({
        title: 'Скопировано',
        description: 'Секретный ключ скопирован в буфер обмена',
      });
    }
  };

  const copyBackupCodes = async () => {
    const text = backupCodes.join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedBackup(true);
    toast({
      title: 'Скопировано',
      description: 'Резервные коды скопированы',
    });
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const downloadBackupCodes = () => {
    const text = `Резервные коды для APLink 2FA\n${'='.repeat(35)}\n\nСохраните эти коды в безопасном месте!\nКаждый код можно использовать только один раз.\n\n${backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nДата генерации: ${new Date().toLocaleString('ru-RU')}`;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aplink-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Скачано',
      description: 'Файл с резервными кодами сохранён',
    });
  };

  const finishSetup = () => {
    onSuccess?.();
    handleClose();
  };

  const handleClose = () => {
    setStep('intro');
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode('');
    setError('');
    setBackupCodes([]);
    setCopiedBackup(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Двухфакторная аутентификация
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Защитите свой аккаунт с помощью приложения-аутентификатора'}
            {step === 'qr' && 'Отсканируйте QR-код в приложении аутентификатора'}
            {step === 'verify' && 'Введите код из приложения для подтверждения'}
            {step === 'backup' && 'Сохраните резервные коды в безопасном месте'}
            {step === 'success' && '2FA успешно настроена!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'intro' && (
            <>
              <div className="bg-primary/10 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Как это работает:</p>
                    <p className="text-sm text-muted-foreground">
                      После настройки вам понадобится вводить 6-значный код из приложения 
                      (Google Authenticator, Authy и др.) при каждом входе.
                    </p>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={startEnrollment}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Настроить 2FA
              </Button>
            </>
          )}

          {step === 'qr' && (
            <>
              {qrCode && (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-lg">
                    <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Или введите ключ вручную:
                    </p>
                    <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                      <code className="text-xs font-mono break-all">{secret}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copySecret}
                        className="shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <Button onClick={() => setStep('verify')} className="w-full">
                Далее
              </Button>
            </>
          )}

          {step === 'verify' && (
            <>
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
                />
                
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('qr')} className="flex-1">
                  Назад
                </Button>
                <Button
                  onClick={verifyEnrollment}
                  disabled={loading || verifyCode.length !== 6}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Подтвердить'
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'backup' && (
            <>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Key className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-500">Важно!</p>
                    <p className="text-sm text-muted-foreground">
                      Эти коды позволят войти в аккаунт, если вы потеряете доступ к приложению-аутентификатору.
                      Сохраните их в надёжном месте!
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="font-mono text-sm text-center py-1 px-2 bg-background/50 rounded">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={copyBackupCodes}
                  className="flex-1"
                >
                  {copiedBackup ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  {copiedBackup ? 'Скопировано' : 'Копировать'}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadBackupCodes}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Скачать
                </Button>
              </div>
              
              <Button onClick={finishSetup} className="w-full">
                Готово
              </Button>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-center text-muted-foreground">
                  Ваш аккаунт теперь защищён двухфакторной аутентификацией
                </p>
              </div>
              
              <Button onClick={handleClose} className="w-full">
                Готово
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorSetup;