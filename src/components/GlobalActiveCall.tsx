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
 * When minimized: shows floating widget + hidden LiveKitRoom
 * When maximized: hidden (MeetingRoom shows UI using room from context)
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
    liveKitRoom,
    endCall,
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

  // Handle connected
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
  }, [playConnectedSound]);

  // Handle disconnected
  const handleDisconnected = useCallback(() => {
    console.log('[GlobalActiveCall] Disconnected');
    hasConnectedRef.current = false;
    setIsConnected(false);
    playDisconnectedSound();
    endCall();
    
    // Navigate to home page if not already there
    if (location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [playDisconnectedSound, endCall, navigate, location.pathname]);

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

  // When minimized, show the floating widget and keep LiveKitRoom mounted but hidden
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

  // When NOT minimized but active, we need to keep the connection alive
  // but MeetingRoom will handle the UI. We render a hidden LiveKitRoom
  // only if we don't already have a connected room.
  // 
  // However, if MeetingRoom is mounted, it will also try to render LiveKitRoom.
  // To prevent duplicate connections, we check if we're on the meeting room route.
  const isOnMeetingRoomRoute = location.pathname.startsWith('/room/');
  
  // If we're on the meeting room route, let MeetingRoom handle the LiveKitRoom
  if (isOnMeetingRoomRoute) {
    return null;
  }

  // If we're NOT on meeting room route but call is active and not minimized,
  // this is an edge case (shouldn't normally happen). Redirect to room.
  navigate(`/room/${roomSlug}?name=${encodeURIComponent(participantName)}`, { replace: true });
  return null;
}
