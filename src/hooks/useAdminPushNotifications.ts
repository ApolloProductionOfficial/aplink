import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';
import { useAuth } from './useAuth';

export const useAdminPushNotifications = () => {
  const { sendNotification, requestPermission } = usePushNotifications();
  const { user, isAdmin } = useAuth();
  const lastErrorIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Request permission on mount if admin
  useEffect(() => {
    if (isAdmin && 'Notification' in window && Notification.permission === 'default') {
      requestPermission();
    }
  }, [isAdmin, requestPermission]);

  // Subscribe to realtime error logs
  useEffect(() => {
    if (!isAdmin || !user) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('admin-error-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'error_logs',
        },
        (payload) => {
          const newError = payload.new as {
            id: string;
            error_type: string;
            error_message: string;
            severity: string;
            source: string | null;
          };

          // Avoid duplicate notifications
          if (lastErrorIdRef.current === newError.id) return;
          lastErrorIdRef.current = newError.id;

          // Only notify for error and critical severity
          if (newError.severity === 'error' || newError.severity === 'critical') {
            const icon = newError.severity === 'critical' ? '🚨' : '⚠️';
            const title = `${icon} ${newError.error_type}`;
            const body = newError.error_message.substring(0, 100) + (newError.error_message.length > 100 ? '...' : '');

            sendNotification(title, {
              body,
              tag: `error-${newError.id}`,
              requireInteraction: newError.severity === 'critical',
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isAdmin, user, sendNotification]);

  return { requestPermission };
};
