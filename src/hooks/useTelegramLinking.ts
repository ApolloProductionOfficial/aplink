import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    auth_date?: number;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Hook for automatic Telegram account linking when user is logged in via Telegram Mini App
 * Should be used on pages where user authentication is present (Index, Auth after login)
 */
export const useTelegramLinking = (userId: string | undefined) => {
  const { toast } = useToast();
  const hasLinked = useRef(false);

  useEffect(() => {
    const linkTelegramAccount = async () => {
      // Prevent multiple linking attempts
      if (hasLinked.current) return;
      
      // Check if running in Telegram WebApp context
      if (!window.Telegram?.WebApp?.initDataUnsafe?.user) {
        return;
      }

      // Need authenticated user
      if (!userId) {
        return;
      }

      const telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
      
      if (!telegramUser.id) {
        return;
      }

      console.log('Telegram WebApp detected, attempting to link account:', telegramUser);

      try {
        // Check current profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_id, telegram_username')
          .eq('user_id', userId)
          .single();

        // Already linked with the same telegram_id
        if (profile?.telegram_id === telegramUser.id) {
          console.log('Telegram already linked to this account');
          hasLinked.current = true;
          return;
        }

        // Check if telegram_id is linked to another account
        if (telegramUser.id) {
          const { data: existingLink } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('telegram_id', telegramUser.id)
            .neq('user_id', userId)
            .maybeSingle();

          if (existingLink) {
            console.log('Telegram ID already linked to another account');
            toast({
              title: "Telegram уже привязан",
              description: "Этот Telegram аккаунт уже связан с другим профилем APLink.",
              variant: "destructive",
            });
            hasLinked.current = true;
            return;
          }
        }

        // Link the account
        const { error } = await supabase
          .from('profiles')
          .update({
            telegram_id: telegramUser.id,
            telegram_username: telegramUser.username || null,
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to link Telegram account:', error);
          return;
        }

        hasLinked.current = true;
        console.log('Telegram account linked successfully');

        toast({
          title: "✅ Telegram привязан!",
          description: `Ваш Telegram${telegramUser.username ? ` (@${telegramUser.username})` : ''} успешно привязан к APLink.`,
        });

      } catch (err) {
        console.error('Error linking Telegram account:', err);
      }
    };

    // Small delay to ensure Telegram WebApp is fully initialized
    const timer = setTimeout(linkTelegramAccount, 500);
    return () => clearTimeout(timer);
  }, [userId, toast]);
};
