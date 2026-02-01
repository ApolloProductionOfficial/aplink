import { useEffect, useState } from 'react';
import { Loader2, Wifi, Shield, Video, Mic, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ConnectionStep {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const connectionSteps: ConnectionStep[] = [
  { id: 'token', label: 'Получение токена...', icon: <Shield className="w-4 h-4" /> },
  { id: 'connect', label: 'Подключение к серверу...', icon: <Wifi className="w-4 h-4" /> },
  { id: 'media', label: 'Настройка медиа...', icon: <Video className="w-4 h-4" /> },
  { id: 'audio', label: 'Проверка аудио...', icon: <Mic className="w-4 h-4" /> },
];

interface ConnectionLoadingScreenProps {
  currentStep?: number;
  roomName?: string;
}

export function ConnectionLoadingScreen({ currentStep = 0, roomName }: ConnectionLoadingScreenProps) {
  const [animatedStep, setAnimatedStep] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);

  const loadingPhrases = [
    "Инициализация портала связи...",
    "Открываем врата в новое измерение...",
    "Синхронизация квантовых частот...",
    "Настраиваем межпространственную связь...",
    "Готовьтесь к телепортации...",
    "Калибровка голографического канала...",
  ];

  // Animate step progression
  useEffect(() => {
    const timer = setTimeout(() => {
      if (animatedStep < currentStep) {
        setAnimatedStep(prev => prev + 1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [animatedStep, currentStep]);

  // Rotate loading phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const progress = Math.min(((animatedStep + 1) / connectionSteps.length) * 100, 100);

  return (
    <div className="flex items-center justify-center h-full bg-background overflow-hidden">
      {/* Cosmic background effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" 
          style={{ animationDuration: '3s' }} 
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/15 rounded-full blur-[80px] animate-pulse" 
          style={{ animationDuration: '4s', animationDelay: '1s' }} 
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-primary/10 rounded-full animate-[spin_20s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
      </div>
      
      <div className="relative z-10 glass-dark rounded-3xl p-8 md:p-10 flex flex-col items-center gap-6 border border-white/10 max-w-md w-full mx-4">
        {/* Animated portal rings */}
        <div className="relative w-20 h-20 md:w-24 md:h-24">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-[ping_2s_ease-out_infinite]" />
          <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-[ping_2s_ease-out_infinite_0.5s]" />
          <div className="absolute inset-4 rounded-full border-2 border-primary/50 animate-[ping_2s_ease-out_infinite_1s]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-primary" />
          </div>
        </div>
        
        {/* Room name */}
        {roomName && (
          <div className="text-center">
            <p className="text-muted-foreground text-sm">Подключение к комнате</p>
            <p className="text-foreground font-semibold text-lg">{roomName}</p>
          </div>
        )}
        
        {/* Progress bar */}
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2 bg-muted/50" />
          <p className="text-center text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
        
        {/* Connection steps */}
        <div className="w-full space-y-3">
          {connectionSteps.map((step, index) => {
            const isCompleted = index < animatedStep;
            const isActive = index === animatedStep;
            const isPending = index > animatedStep;
            
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all duration-500",
                  isCompleted && "bg-primary/10 border border-primary/20",
                  isActive && "bg-primary/20 border border-primary/30 shadow-[0_0_20px_rgba(6,182,228,0.2)]",
                  isPending && "bg-muted/20 border border-transparent opacity-50"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                    isCompleted && "bg-primary text-primary-foreground",
                    isActive && "bg-primary/30 text-primary animate-pulse",
                    isPending && "bg-muted/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm transition-colors duration-300",
                    isCompleted && "text-primary",
                    isActive && "text-foreground font-medium",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {isCompleted ? step.label.replace('...', ' ✓') : step.label}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Rotating phrase */}
        <div className="text-center space-y-2 pt-2">
          <p className="text-foreground text-lg font-medium bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent animate-[pulse_3s_ease-in-out_infinite] min-w-[280px] transition-all duration-500">
            {loadingPhrases[phraseIndex]}
          </p>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            Готовьтесь к погружению
            {/* Single neon star */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 animate-[spin_8s_linear_infinite]">
              <defs>
                <linearGradient id="star-gradient-load" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))"/>
                  <stop offset="50%" stopColor="#fff"/>
                  <stop offset="100%" stopColor="hsl(var(--primary))"/>
                </linearGradient>
                <filter id="star-glow-load">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path 
                d="M12 2L14.5 9.5L22 10L16 15L18 22L12 18L6 22L8 15L2 10L9.5 9.5L12 2Z" 
                fill="url(#star-gradient-load)" 
                filter="url(#star-glow-load)"
                className="drop-shadow-[0_0_12px_hsl(var(--primary)/0.9)]"
              />
            </svg>
          </p>
        </div>
      </div>
    </div>
  );
}
