import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const usePresence = (currentRoom?: string) => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout>();
  const sessionTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Get and store session token for sendBeacon
    const getSessionToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      sessionTokenRef.current = session?.access_token || null;
    };
    getSessionToken();

    // Listen for auth changes to update token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      sessionTokenRef.current = session?.access_token || null;
    });

    const updatePresence = async (isOnline: boolean, room?: string) => {
      try {
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
          if (!error.message?.includes('Failed to fetch') && !error.message?.includes('AbortError')) {
            console.error('Error updating presence:', error);
          }
        }
      } catch (e) {
        // Silently ignore errors during presence updates (network issues, etc.)
      }
    };

    // Set presence to offline using sendBeacon (works during page unload)
    const setOfflineWithBeacon = () => {
      const token = sessionTokenRef.current;
      if (!token) return; // Skip if no auth token
      
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`;
      const body = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen: new Date().toISOString(),
        current_room: null,
      });
      
      // Use sendBeacon with proper headers via Blob
      // Note: sendBeacon has limited header support, we use apikey + prefer headers via URL params
      const fullUrl = `${url}&apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;
      
      // Create form data with proper content type that includes auth
      const blob = new Blob([body], { type: 'application/json' });
      
      // sendBeacon doesn't support custom Authorization headers
      // Use fetch with keepalive instead for authenticated requests
      try {
        fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: body,
          keepalive: true, // Ensures request completes even during page unload
        }).catch(() => {
          // Fallback to sendBeacon without auth (will fail RLS but at least attempts)
          navigator.sendBeacon(fullUrl, blob);
        });
      } catch {
        // Final fallback
        navigator.sendBeacon(fullUrl, blob);
      }
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
      subscription.unsubscribe();
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
