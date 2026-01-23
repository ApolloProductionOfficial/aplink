import { useCallback, useRef } from 'react';

export const useVoiceNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedRef = useRef<number>(0);
  const minInterval = 4000; // 4 seconds between voice notifications

  const playNotification = useCallback(async (text: string) => {
    const now = Date.now();
    if (now - lastPlayedRef.current < minInterval) {
      console.log('[VoiceNotifications] Skipping - too soon since last notification');
      return;
    }
    lastPlayedRef.current = now;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text, 
            voiceId: 'onwK4e9ZLuTAKqWW03F9' // Daniel - Russian voice
          }),
        }
      );

      if (!response.ok) {
        console.error('[VoiceNotifications] TTS request failed:', response.status);
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Stop previous audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.volume = 0.5;
      
      audioRef.current.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      await audioRef.current.play();
      console.log('[VoiceNotifications] Playing:', text);
    } catch (err) {
      console.error('[VoiceNotifications] Failed:', err);
    }
  }, []);

  const announceHandRaised = useCallback((name: string) => {
    playNotification(`${name} поднял руку`);
  }, [playNotification]);

  const announceParticipantJoined = useCallback((name: string) => {
    playNotification(`${name} присоединился к звонку`);
  }, [playNotification]);

  const announceParticipantLeft = useCallback((name: string) => {
    playNotification(`${name} покинул звонок`);
  }, [playNotification]);

  return {
    playNotification,
    announceHandRaised,
    announceParticipantJoined,
    announceParticipantLeft,
  };
};

export default useVoiceNotifications;
