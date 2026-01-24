import { useEffect, useCallback, useRef, useState } from 'react';
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
 * This component ALWAYS renders the LiveKitRoom when a call is active,
 * ensuring the connection persists across navigation.
 * 
 * Architecture:
 * - When isActive && !isMinimized && on room route: LiveKitRoom renders fullscreen
 * - When isActive && isMinimized: LiveKitRoom hidden, MinimizedCallWidget shown
 * - MeetingRoom only provides UI elements (headerButtons, connectionIndicator) via context
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
    headerButtons,
    connectionIndicator,
    liveKitRoom,
    eventHandlers,
    endCall,
    minimize,
    maximize,
    setLiveKitRoom,
  } = useActiveCall();

  const hasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);

  // Handle room ready
  const handleRoomReady = useCallback((room: Room) => {
    console.log('[GlobalActiveCall] LiveKit room ready');
    setLiveKitRoom(room);
  }, [setLiveKitRoom]);

  // Handle connected - notify MeetingRoom via context handlers
  const handleConnected = useCallback(() => {
    console.log('[GlobalActiveCall] Connected');
    setIsConnected(true);
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      playConnectedSound();
      toast.success('Подключено', {
        description: 'Вы успешно подключились к комнате',
      });
    }
    // Call MeetingRoom's onConnected handler
    eventHandlers.onConnected?.();
  }, [playConnectedSound, eventHandlers]);

  // Handle disconnected
  const handleDisconnected = useCallback(() => {
    console.log('[GlobalActiveCall] Disconnected');
    hasConnectedRef.current = false;
    setIsConnected(false);
    playDisconnectedSound();
    
    // Call MeetingRoom's onDisconnected handler first
    eventHandlers.onDisconnected?.();
    
    endCall();
    
    // Navigate to home page if not already there
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [playDisconnectedSound, endCall, navigate, location.pathname, eventHandlers]);

  // Handle participant joined
  const handleParticipantJoined = useCallback((identity: string, name: string) => {
    console.log('[GlobalActiveCall] Participant joined:', identity, name);
    eventHandlers.onParticipantJoined?.(identity, name);
  }, [eventHandlers]);

  // Handle participant left
  const handleParticipantLeft = useCallback((identity: string) => {
    console.log('[GlobalActiveCall] Participant left:', identity);
    eventHandlers.onParticipantLeft?.(identity);
  }, [eventHandlers]);

  // Handle end call button
  const handleEndCall = useCallback(() => {
    // Disconnect from room if connected
    if (liveKitRoom) {
      liveKitRoom.disconnect();
    }
    endCall();
    navigate('/', { replace: true });
  }, [endCall, navigate, liveKitRoom]);

  // Handle maximize - navigate back to room
  const handleMaximize = useCallback(() => {
    // Exit any existing PiP
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    maximize();
    navigate(`/room/${roomSlug}?name=${encodeURIComponent(participantName)}`);
  }, [maximize, navigate, roomSlug, participantName]);

  // Handle minimize - go to home and show widget
  const handleMinimize = useCallback(() => {
    minimize();
    navigate('/', { replace: true });
  }, [minimize, navigate]);

  // Handle error
  const handleError = useCallback((error: Error) => {
    console.error('[GlobalActiveCall] Error:', error);
    toast.error('Ошибка подключения', {
      description: error.message || 'Не удалось подключиться к комнате',
    });
    eventHandlers.onError?.(error);
  }, [eventHandlers]);

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

  // Check if we're on the meeting room route
  const isOnMeetingRoomRoute = location.pathname.startsWith('/room/');

  // When minimized: show floating widget + hidden LiveKitRoom
  if (isMinimized) {
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
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            onError={handleError}
            onRoomReady={handleRoomReady}
          />
        </div>

        {/* Floating minimized widget - rendered via portal to body */}
        {createPortal(
          <>
            {/* Hide right panels when minimized */}
            <style>{`[data-news-widget] { display: none !important; }`}</style>
            <MinimizedCallWidget
              roomName={roomDisplayName}
              onMaximize={handleMaximize}
              onEndCall={handleEndCall}
            />
          </>,
          document.body
        )}
      </>
    );
  }

  // When NOT minimized and on room route: render fullscreen LiveKitRoom
  if (isOnMeetingRoomRoute) {
    return (
      <div className="fixed inset-0 z-50 bg-background">
        <LiveKitRoom
          roomName={roomSlug}
          participantName={participantName}
          participantIdentity={participantIdentity}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onParticipantJoined={handleParticipantJoined}
          onParticipantLeft={handleParticipantLeft}
          onError={handleError}
          onRoomReady={handleRoomReady}
          headerButtons={headerButtons}
          roomDisplayName={roomDisplayName}
          onMinimize={handleMinimize}
          connectionIndicator={connectionIndicator}
        />
      </div>
    );
  }

  // If NOT on meeting room route but call is active and not minimized,
  // redirect to room
  navigate(`/room/${roomSlug}?name=${encodeURIComponent(participantName)}`, { replace: true });
  return null;
}
