import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const usePresence = (currentRoom?: string) => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user) return;

    const updatePresence = async (isOnline: boolean, room?: string) => {
      const { error } = await supabase
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

      if (error) {
        // Only log if it's not a network abort error (happens on page unload)
        if (!error.message?.includes('Failed to fetch')) {
          console.error('Error updating presence:', error);
        }
      }
    };

    // Set presence to offline using sendBeacon (works during page unload)
    const setOfflineWithBeacon = () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`;
      const body = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen: new Date().toISOString(),
        current_room: null,
      });
      
      // Use sendBeacon for reliable delivery during page unload
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url + '&apikey=' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, blob);
    };

    // Set online
    updatePresence(true, currentRoom);

    // Update every 30 seconds
    intervalRef.current = setInterval(() => {
      updatePresence(true, currentRoom);
    }, 30000);

    // Set offline on page unload using sendBeacon
    const handleUnload = () => {
      setOfflineWithBeacon();
    };

    // Handle visibility change for mobile
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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Use regular update for cleanup (not during unload)
      updatePresence(false);
    };
  }, [user, currentRoom]);
};
