# CF Project - Все кастомные хуки

Скопируй эти хуки в `src/hooks/` нового проекта.

---

## useAuth.ts
Управление аутентификацией через Supabase.

```typescript
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));
        
        // Defer role check with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          setState(prev => ({ ...prev, isAdmin: false, isLoading: false }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));
      
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      setState(prev => ({
        ...prev,
        isAdmin: !!data,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error checking admin role:', error);
      setState(prev => ({ ...prev, isAdmin: false, isLoading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: displayName,
        },
      },
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setState({
        user: null,
        session: null,
        isAdmin: false,
        isLoading: false,
      });
    }
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  return {
    ...state,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
  };
};
```

---

## useReducedMotion.ts
Определение низкопроизводительных устройств для отключения анимаций.

```typescript
import { useState, useEffect } from 'react';

/**
 * Hook to detect if user prefers reduced motion or is on a low-power device
 * Returns true if animations should be reduced/disabled
 */
export const useReducedMotion = () => {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    
    return prefersReducedMotion || isMobile;
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;
    
    // Check device memory if available (Chrome only)
    const hasLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    
    // Check for battery saver mode
    const checkBattery = async () => {
      try {
        const battery = await (navigator as any).getBattery?.();
        if (battery && battery.level < 0.2 && !battery.charging) {
          setShouldReduceMotion(true);
        }
      } catch {
        // Battery API not available
      }
    };
    checkBattery();
    
    const shouldReduce = prefersReducedMotion || isMobile || hasLowMemory;
    setShouldReduceMotion(shouldReduce);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setShouldReduceMotion(e.matches || isMobile);
    };

    mediaQuery.addEventListener('change', handleChange);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const nowMobile = window.innerWidth < 768;
        setShouldReduceMotion(prefersReducedMotion || nowMobile);
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, []);

  return shouldReduceMotion;
};
```

---

## useButtonSound.ts
Генерация звука клика кнопки через Web Audio API.

```typescript
import { useCallback } from 'react';

export const useButtonSound = () => {
  const playClickSound = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.01);
    
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.05);
  }, []);

  return { playClickSound };
};
```

---

## useConnectionSounds.ts
Звуки подключения/отключения для realtime функций.

```typescript
import { useCallback, useRef } from 'react';

const createSound = (frequency: number, duration: number, type: 'success' | 'error' | 'warning') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = type === 'success' ? 'sine' : type === 'error' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    setTimeout(() => {
      audioContext.close();
    }, duration * 1000 + 100);
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
};

export const useConnectionSounds = () => {
  const lastSoundRef = useRef<number>(0);
  const minInterval = 1000;

  const playConnectedSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    createSound(523.25, 0.15, 'success');
    setTimeout(() => createSound(659.25, 0.2, 'success'), 150);
  }, []);

  const playDisconnectedSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    createSound(392, 0.15, 'error');
    setTimeout(() => createSound(293.66, 0.25, 'error'), 150);
  }, []);

  const playReconnectingSound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundRef.current < minInterval) return;
    lastSoundRef.current = now;
    
    createSound(440, 0.3, 'warning');
  }, []);

  return {
    playConnectedSound,
    playDisconnectedSound,
    playReconnectingSound,
  };
};

export default useConnectionSounds;
```

---

## useScrollAnimation.ts
Анимация при появлении элемента в viewport.

```typescript
import { useState, useEffect, useRef } from "react";

export const useScrollAnimation = (threshold: number = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [threshold]);

  return { elementRef, isVisible };
};
```

---

## useTilt.ts
3D эффект наклона карточки при наведении.

```typescript
import { useRef, useEffect } from 'react';

export const useTilt = (maxTilt: number = 15) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * maxTilt;
      const rotateY = ((centerX - x) / centerX) * maxTilt;

      element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    };

    const handleMouseLeave = () => {
      element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [maxTilt]);

  return ref;
};
```

---

## useTranslation.ts
Получение переводов из контекста языка.

```typescript
import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/locales/translations';

export const useTranslation = () => {
  const { language } = useLanguage();
  
  return {
    t: translations[language],
    language
  };
};
```

---

## useAnalytics.ts
Трекинг событий аналитики в Supabase.

```typescript
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Json } from '@/integrations/supabase/types';

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

export type AnalyticsEventType = 
  | 'page_view'
  | 'button_click'
  | 'translation_started'
  | 'translation_completed'
  | 'room_joined'
  | 'room_left'
  | 'feature_used'
  | 'error';

interface TrackEventParams {
  eventType: AnalyticsEventType;
  eventData?: Record<string, Json>;
  pagePath?: string;
}

export const useAnalytics = () => {
  const { user } = useAuth();
  const sessionId = useRef(getSessionId());

  const trackEvent = useCallback(async ({ eventType, eventData = {}, pagePath }: TrackEventParams) => {
    if (!user?.id) return;
    
    try {
      await supabase.from('site_analytics').insert([{
        event_type: eventType,
        event_data: eventData as Json,
        user_id: user.id,
        session_id: sessionId.current,
        page_path: pagePath || window.location.pathname,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      }]);
    } catch (error) {
      // Silently ignore analytics errors
    }
  }, [user?.id]);

  const trackPageView = useCallback((pageName?: string) => {
    trackEvent({
      eventType: 'page_view',
      eventData: { page_name: pageName || null },
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
  };
};
```

---

## usePresence.ts
Отслеживание онлайн-статуса пользователя.

```typescript
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const usePresence = (currentRoom?: string) => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const getSessionToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      sessionTokenRef.current = session?.access_token || null;
    };
    getSessionToken();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      sessionTokenRef.current = session?.access_token || null;
    });

    const updatePresence = async (isOnline: boolean, room?: string) => {
      try {
        await supabase
          .from('user_presence')
          .upsert(
            {
              user_id: user.id,
              is_online: isOnline,
              last_seen: new Date().toISOString(),
              current_room: room || null,
            },
            { onConflict: 'user_id' }
          );
      } catch (e) {
        // Silently ignore errors
      }
    };

    const setOfflineWithBeacon = () => {
      const token = sessionTokenRef.current;
      if (!token) return;
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`;
      const body = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen: new Date().toISOString(),
        current_room: null,
      });
      
      const fullUrl = `${url}&apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
      
      try {
        fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: body,
          keepalive: true,
        }).catch(() => {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(fullUrl, blob);
        });
      } catch {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(fullUrl, blob);
      }
    };

    updatePresence(true, currentRoom);

    intervalRef.current = setInterval(() => {
      updatePresence(true, currentRoom);
    }, 30000);

    const handleUnload = () => setOfflineWithBeacon();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setOfflineWithBeacon();
      } else if (document.visibilityState === 'visible') {
        updatePresence(true, currentRoom);
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updatePresence(false);
    };
  }, [user, currentRoom]);
};
```

---

## Зависимости

Убедись, что установлены:
- `@supabase/supabase-js`
- React 18+
