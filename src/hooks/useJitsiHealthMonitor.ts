import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HealthStatus {
  isConnected: boolean;
  quality: number;
  lastCheck: Date;
  consecutiveFailures: number;
}

interface UseJitsiHealthMonitorProps {
  roomId: string;
  userName: string;
  jitsiApi: any;
  enabled: boolean;
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
}

export const useJitsiHealthMonitor = ({
  roomId,
  userName,
  jitsiApi,
  enabled,
  onConnectionLost,
  onConnectionRestored,
}: UseJitsiHealthMonitorProps) => {
  const healthStatusRef = useRef<HealthStatus>({
    isConnected: false,
    quality: 100,
    lastCheck: new Date(),
    consecutiveFailures: 0,
  });
  
  const lastAlertSentRef = useRef<number>(0);
  const wasConnectedRef = useRef(false);

  const sendHealthAlert = useCallback(async (type: 'disconnected' | 'quality_degraded' | 'restored', details: Record<string, unknown>) => {
    // Throttle alerts - minimum 5 minutes between alerts of same type
    const now = Date.now();
    if (now - lastAlertSentRef.current < 5 * 60 * 1000) {
      return;
    }
    lastAlertSentRef.current = now;

    try {
      await supabase.functions.invoke('send-telegram-notification', {
        body: {
          errorType: 'JITSI_HEALTH',
          errorMessage: type === 'disconnected' 
            ? `🔴 Созвон отключился: ${roomId}`
            : type === 'quality_degraded'
            ? `⚠️ Качество связи ухудшилось: ${roomId}`
            : `🟢 Соединение восстановлено: ${roomId}`,
          source: `MeetingRoom - ${userName}`,
          severity: type === 'disconnected' ? 'error' : type === 'restored' ? 'info' : 'warning',
          details: {
            roomId,
            userName,
            ...details,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.error('Failed to send health alert:', e);
    }
  }, [roomId, userName]);

  useEffect(() => {
    if (!enabled || !jitsiApi) return;

    let checkInterval: ReturnType<typeof setInterval>;

    const checkHealth = async () => {
      try {
        // Try to get participants - this is a good indicator of connection health
        const participants = jitsiApi.getParticipantsInfo?.();
        const isConnected = Array.isArray(participants);
        
        if (isConnected) {
          healthStatusRef.current.consecutiveFailures = 0;
          healthStatusRef.current.isConnected = true;
          
          // Check if we just reconnected
          if (!wasConnectedRef.current) {
            wasConnectedRef.current = true;
            sendHealthAlert('restored', { 
              participantCount: participants.length 
            });
            onConnectionRestored?.();
          }
        } else {
          healthStatusRef.current.consecutiveFailures++;
          
          // After 3 consecutive failures, consider disconnected
          if (healthStatusRef.current.consecutiveFailures >= 3) {
            healthStatusRef.current.isConnected = false;
            
            if (wasConnectedRef.current) {
              wasConnectedRef.current = false;
              sendHealthAlert('disconnected', {
                consecutiveFailures: healthStatusRef.current.consecutiveFailures,
              });
              onConnectionLost?.();
            }
          }
        }

        healthStatusRef.current.lastCheck = new Date();
      } catch (e) {
        healthStatusRef.current.consecutiveFailures++;
        console.log('Health check failed:', e);
      }
    };

    // Check every 30 seconds
    checkInterval = setInterval(checkHealth, 30000);
    
    // Initial check
    checkHealth();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [enabled, jitsiApi, sendHealthAlert, onConnectionLost, onConnectionRestored]);

  return {
    getHealthStatus: () => healthStatusRef.current,
  };
};
