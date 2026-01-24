import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Room } from 'livekit-client';
import { toast } from 'sonner';
import { useActiveCall } from '@/contexts/ActiveCallContext';
import { LiveKitRoom } from '@/components/LiveKitRoom';
import { MinimizedCallWidget } from '@/components/MinimizedCallWidget';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionSounds } from '@/hooks/useConnectionSounds';

/**
 * Global component that renders the active call.
 * When minimized, shows a floating widget and keeps the call connection alive.
 * Rendered in App.tsx at root level, outside of Routes.
 */
export function GlobalActiveCall() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { playConnectedSound, playDisconnectedSound } = useConnectionSounds();
  
  const {
    isActive,
    isMinimized,
    roomSlug,
    participantName,
    participantIdentity,
    roomDisplayName,
    endCall,
    maximize,
    setLiveKitRoom,
  } = useActiveCall();

  const hasConnectedRef = useRef(false);

  // Handle room ready
  const handleRoomReady = useCallback((room: Room) => {
    console.log('[GlobalActiveCall] LiveKit room ready');
    setLiveKitRoom(room);
  }, [setLiveKitRoom]);

  // Handle connected
  const handleConnected = useCallback(() => {
    console.log('[GlobalActiveCall] Connected');
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      playConnectedSound();
      toast.success('Подключено', {
        description: 'Вы успешно подключились к комнате',
      });
    }
  }, [playConnectedSound]);

  // Handle disconnected
  const handleDisconnected = useCallback(() => {
    console.log('[GlobalActiveCall] Disconnected');
    hasConnectedRef.current = false;
    playDisconnectedSound();
    endCall();
    
    // Navigate to dashboard if not already there
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  }, [playDisconnectedSound, endCall, navigate, location.pathname]);

  // Handle end call button
  const handleEndCall = useCallback(() => {
    endCall();
    navigate('/dashboard', { replace: true });
  }, [endCall, navigate]);


  // Handle maximize - navigate back to room
  const handleMaximize = useCallback(() => {
    maximize();
    navigate(`/room/${roomSlug}?name=${encodeURIComponent(participantName)}`);
  }, [maximize, navigate, roomSlug, participantName]);

  // Handle error
  const handleError = useCallback((error: Error) => {
    console.error('[GlobalActiveCall] Error:', error);
    toast.error('Ошибка подключения', {
      description: error.message || 'Не удалось подключиться к комнате',
    });
  }, []);

  // Reset on unmount
  useEffect(() => {
    return () => {
      hasConnectedRef.current = false;
    };
  }, []);

  // Don't render anything if no active call
  if (!isActive) {
    return null;
  }

  // When not minimized, the MeetingRoom page renders the full call UI.
  if (!isMinimized) {
    return null;
  }

  return (
    <>
      {/* Hidden but active LiveKit room - maintains connection while user navigates */}
      <div
        className="fixed opacity-0 pointer-events-none"
        style={{ width: 1, height: 1, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <LiveKitRoom
          roomName={roomSlug}
          participantName={participantName}
          participantIdentity={participantIdentity}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
          onRoomReady={handleRoomReady}
        />
      </div>

      {/* Floating minimized widget - rendered via portal to body */}
      {createPortal(
        <MinimizedCallWidget
          roomName={roomDisplayName}
          onMaximize={handleMaximize}
          onEndCall={handleEndCall}
        />,
        document.body
      )}
    </>
  );
}
