import { useCallback, useRef, useState, useEffect } from 'react';
import { Room, RoomEvent, ConnectionQuality, ConnectionState } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DiagnosticEvent {
  timestamp: number;
  type: string;
  details?: string;
}

export interface NetworkMetrics {
  latencyMs: number | null;
  packetLoss: number | null;
  bitrate: number | null;
  connectionQuality: ConnectionQuality | null;
  rtt?: number;
  downlink?: number;
  effectiveType?: string;
}

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  browser: string;
  isIOS: boolean;
  isSafari: boolean;
  userAgent: string;
}

export interface DiagnosticsState {
  connectionState: ConnectionState | null;
  reconnectCount: number;
  events: DiagnosticEvent[];
  networkMetrics: NetworkMetrics;
  deviceInfo: DeviceInfo;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  participantCount: number;
  roomName: string;
  startTime: number;
}

interface UseCallDiagnosticsOptions {
  room: Room | null;
  roomName: string;
  participantName: string;
  maxEvents?: number;
}

function detectDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  
  let platform: DeviceInfo['platform'] = 'desktop';
  if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';
  
  let browser = 'unknown';
  if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (isSafari) browser = 'Safari';
  else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';
  
  return {
    platform,
    browser,
    isIOS,
    isSafari,
    userAgent: ua.substring(0, 200),
  };
}

function getNetworkInfo(): Partial<NetworkMetrics> {
  const nav = navigator as any;
  if (nav.connection) {
    return {
      rtt: nav.connection.rtt,
      downlink: nav.connection.downlink,
      effectiveType: nav.connection.effectiveType,
    };
  }
  return {};
}

export function useCallDiagnostics({
  room,
  roomName,
  participantName,
  maxEvents = 50,
}: UseCallDiagnosticsOptions) {
  const [state, setState] = useState<DiagnosticsState>(() => ({
    connectionState: null,
    reconnectCount: 0,
    events: [],
    networkMetrics: {
      latencyMs: null,
      packetLoss: null,
      bitrate: null,
      connectionQuality: null,
      ...getNetworkInfo(),
    },
    deviceInfo: detectDeviceInfo(),
    isCameraEnabled: false,
    isMicEnabled: false,
    participantCount: 0,
    roomName,
    startTime: Date.now(),
  }));

  const lastReportTimeRef = useRef<number>(0);
  const REPORT_COOLDOWN_MS = 30000; // 30 seconds between reports

  // Add event to log
  const addEvent = useCallback((type: string, details?: string) => {
    setState(prev => ({
      ...prev,
      events: [
        { timestamp: Date.now(), type, details },
        ...prev.events,
      ].slice(0, maxEvents),
    }));
  }, [maxEvents]);

  // Subscribe to room events
  useEffect(() => {
    if (!room) return;

    const handleConnectionStateChanged = (state: ConnectionState) => {
      setState(prev => ({ ...prev, connectionState: state }));
      addEvent('CONNECTION_STATE', state);
    };

    const handleReconnecting = () => {
      setState(prev => ({
        ...prev,
        reconnectCount: prev.reconnectCount + 1,
      }));
      addEvent('RECONNECTING');
    };

    const handleReconnected = () => {
      addEvent('RECONNECTED');
    };

    const handleConnectionQualityChanged = (quality: ConnectionQuality, participant: any) => {
      if (participant.isLocal) {
        setState(prev => ({
          ...prev,
          networkMetrics: {
            ...prev.networkMetrics,
            connectionQuality: quality,
          },
        }));
      }
    };

    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      addEvent('TRACK_SUBSCRIBED', `${participant.identity}: ${track.kind}`);
    };

    const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
      addEvent('TRACK_UNSUBSCRIBED', `${participant.identity}: ${track.kind}`);
    };

    const handleParticipantConnected = (participant: any) => {
      addEvent('PARTICIPANT_JOINED', participant.identity);
    };

    const handleParticipantDisconnected = (participant: any) => {
      addEvent('PARTICIPANT_LEFT', participant.identity);
    };

    // Set initial state
    setState(prev => ({
      ...prev,
      connectionState: room.state,
      participantCount: room.remoteParticipants.size + 1,
    }));

    room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    // Periodic metrics update
    const metricsInterval = setInterval(() => {
      setState(prev => ({
        ...prev,
        networkMetrics: {
          ...prev.networkMetrics,
          ...getNetworkInfo(),
        },
        participantCount: room.remoteParticipants.size + 1,
        isCameraEnabled: room.localParticipant?.isCameraEnabled ?? false,
        isMicEnabled: room.localParticipant?.isMicrophoneEnabled ?? false,
      }));
    }, 2000);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      clearInterval(metricsInterval);
    };
  }, [room, addEvent]);

  // Log media toggle attempts
  const logMediaToggle = useCallback((type: 'camera' | 'microphone', success: boolean, error?: string) => {
    addEvent(`TOGGLE_${type.toUpperCase()}`, success ? 'success' : `failed: ${error}`);
  }, [addEvent]);

  // Send diagnostic report
  const sendReport = useCallback(async () => {
    const now = Date.now();
    if (now - lastReportTimeRef.current < REPORT_COOLDOWN_MS) {
      toast.info('Отчёт недавно отправлен', {
        description: 'Подождите 30 секунд перед повторной отправкой',
      });
      return false;
    }

    lastReportTimeRef.current = now;

    const report = {
      timestamp: new Date().toISOString(),
      roomName: state.roomName,
      participantName,
      sessionDuration: Math.round((now - state.startTime) / 1000),
      connectionState: state.connectionState,
      reconnectCount: state.reconnectCount,
      deviceInfo: state.deviceInfo,
      networkMetrics: state.networkMetrics,
      participantCount: state.participantCount,
      isCameraEnabled: state.isCameraEnabled,
      isMicEnabled: state.isMicEnabled,
      recentEvents: state.events.slice(0, 20),
    };

    try {
      // Log to error_logs table as CALL_DIAGNOSTICS
      await supabase.from('error_logs').insert([{
        error_type: 'CALL_DIAGNOSTICS',
        error_message: `Call diagnostics report from ${participantName}`,
        severity: 'info',
        source: 'call_diagnostics',
        url: window.location.href,
        user_agent: state.deviceInfo.userAgent,
        details: report as any,
      }]);

      toast.success('Отчёт отправлен', {
        description: 'Спасибо! Мы проанализируем данные.',
      });
      return true;
    } catch (err) {
      console.error('[useCallDiagnostics] Failed to send report:', err);
      toast.error('Не удалось отправить отчёт');
      return false;
    }
  }, [state, participantName]);

  // Check if device should use iOS Safe Mode
  const shouldUseIOSSafeMode = state.deviceInfo.isIOS || 
    (state.deviceInfo.isSafari && state.deviceInfo.platform !== 'desktop');

  return {
    state,
    addEvent,
    logMediaToggle,
    sendReport,
    shouldUseIOSSafeMode,
    isReconnecting: state.connectionState === ConnectionState.Reconnecting,
    reconnectCount: state.reconnectCount,
  };
}

export default useCallDiagnostics;
