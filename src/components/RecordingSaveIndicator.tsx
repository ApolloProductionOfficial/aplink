import { useState, useEffect } from 'react';
import { Loader2, Check, X, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'preparing' | 'uploading' | 'saving' | 'success' | 'error';

interface RecordingSaveIndicatorProps {
  status: SaveStatus;
  progress?: number;
  error?: string;
  onClose?: () => void;
}

const statusConfig = {
  idle: { icon: null, text: '', color: '' },
  preparing: { icon: Loader2, text: 'Подготовка записи...', color: 'text-blue-400' },
  uploading: { icon: Upload, text: 'Загрузка в хранилище...', color: 'text-blue-400' },
  saving: { icon: Loader2, text: 'Сохранение метаданных...', color: 'text-blue-400' },
  success: { icon: Check, text: 'Запись сохранена!', color: 'text-green-400' },
  error: { icon: X, text: 'Ошибка сохранения', color: 'text-red-400' },
};

const RecordingSaveIndicator = ({ 
  status, 
  progress = 0, 
  error,
  onClose 
}: RecordingSaveIndicatorProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
    }

    if (status === 'success') {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 3000);
      return () => clearTimeout(timer);
    }

    if (status === 'error') {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!visible || status === 'idle') return null;

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] animate-in slide-in-from-bottom-4 duration-300">
      <div className="glass rounded-xl border border-border/50 px-4 py-3 shadow-lg min-w-[280px]">
        <div className="flex items-center gap-3">
          {Icon && (
            <Icon 
              className={cn(
                'w-5 h-5',
                config.color,
                (status === 'preparing' || status === 'saving') && 'animate-spin'
              )} 
            />
          )}
          <div className="flex-1">
            <p className={cn('text-sm font-medium', config.color)}>
              {config.text}
            </p>
            {error && (
              <p className="text-xs text-red-400 mt-1">{error}</p>
            )}
          </div>
        </div>

        {(status === 'uploading' || status === 'preparing') && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingSaveIndicator;
