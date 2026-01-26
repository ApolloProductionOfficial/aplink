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
import { cn } from '@/lib/utils';
import '@/styles/call-animations.css';

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

  // =========================================
  // ALL HOOKS MUST BE DECLARED HERE - BEFORE ANY CONDITIONAL RETURNS!
  // React Rule: Hooks must be called in the same order on every render.
  // =========================================

  const hasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Stable key for LiveKitRoom - prevents unmounting during navigation
  const roomKeyRef = useRef<string | null>(null);
  
  // Auto-reconnect state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track animation states for smooth transitions
  // IMPORTANT: These hooks MUST be declared BEFORE any early returns!
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const prevMinimizedRef = useRef(isMinimized);
  
  // Navigation tracking refs
  const wasMinimizedRef = useRef(isMinimized);
  const didNavigateRef = useRef(false);

  // Generate stable key when call starts
  useEffect(() => {
    if (isActive && !roomKeyRef.current) {
      roomKeyRef.current = `room-${roomSlug}-${Date.now()}`;
      console.log('[GlobalActiveCall] Generated stable room key:', roomKeyRef.current);
    } else if (!isActive) {
      roomKeyRef.current = null;
    }
  }, [isActive, roomSlug]);

  // Handle animation states on minimize/maximize transitions
  useEffect(() => {
    if (prevMinimizedRef.current !== isMinimized) {
      if (isMinimized) {
        // Transitioning TO minimized - play exit animation
        setIsAnimatingOut(true);
        const timer = setTimeout(() => setIsAnimatingOut(false), 500);
        return () => clearTimeout(timer);
      } else {
        // Transitioning FROM minimized - play entry animation
        setIsAnimatingIn(true);
        const timer = setTimeout(() => setIsAnimatingIn(false), 500);
        return () => clearTimeout(timer);
      }
    }
    prevMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  // Keep the room mounted at all times to prevent reconnects on minimize/maximize.
  useEffect(() => {
    if (!isActive) {
      didNavigateRef.current = false;
      return;
    }
    // No need to navigate on maximize - GlobalActiveCall already renders fullscreen LiveKitRoom
    // regardless of route. Navigation was causing LiveKit disconnect.
    wasMinimizedRef.current = isMinimized;
  }, [isActive, isMinimized]);

  // Reset on unmount
  useEffect(() => {
    return () => {
      hasConnectedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Handle room ready
  const handleRoomReady = useCallback((room: Room) => {
    console.log('[GlobalActiveCall] LiveKit room ready');
    setLiveKitRoom(room);
  }, [setLiveKitRoom]);

  // Handle connected - notify MeetingRoom via context handlers
  // IMPORTANT: Only play sounds/toasts on FIRST connection, not on minimize/maximize cycles
  const handleConnected = useCallback(() => {
    console.log('[GlobalActiveCall] Connected, hasConnectedRef:', hasConnectedRef.current);
    setIsConnected(true);
    
    // Check if this was a reconnection from network error
    const wasReconnecting = reconnectAttempt > 0 || isReconnecting;
    
    setReconnectAttempt(0); // Reset reconnect counter on successful connection
    setIsReconnecting(false);
    
    // Only play sound and show toast on FIRST connection
    // hasConnectedRef stays true during minimize/maximize to prevent re-triggering
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      playConnectedSound();
      toast.success('Подключено', {
        description: 'Вы успешно подключились к комнате',
      });
      // Only call onConnected on first connection
      eventHandlers.onConnected?.();
    } else if (wasReconnecting) {
      // Reconnection success after network error - play sound and show toast
      playConnectedSound();
      toast.success(
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
            <defs>
              <linearGradient id="reconnect-success-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981"/>
                <stop offset="100%" stopColor="#06b6e4"/>
              </linearGradient>
              <filter id="reconnect-success-glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#reconnect-success-gradient)" strokeWidth="2" fill="none" filter="url(#reconnect-success-glow)"/>
            <path d="M8 12l3 3 5-5" stroke="url(#reconnect-success-gradient)" strokeWidth="2.5" fill="none" strokeLinecap="round" filter="url(#reconnect-success-glow)"/>
          </svg>
          <div>
            <div className="font-medium">Связь восстановлена!</div>
            <div className="text-xs text-muted-foreground">Подключение стабильно</div>
          </div>
        </div>,
        { duration: 4000 }
      );
      eventHandlers.onConnected?.();
    }
    // If already connected (hasConnectedRef.current === true) and not reconnecting,
    // this is a maximize after minimize - do nothing special
  }, [playConnectedSound, eventHandlers, reconnectAttempt, isReconnecting]);

  // Handle disconnected
  // IMPORTANT: This is called on REAL disconnects (network, server, user ended call)
  // NOT on minimize/maximize - LiveKitRoom stays connected during those
  const handleDisconnected = useCallback(() => {
    console.log('[GlobalActiveCall] Disconnected - real disconnect, resetting state');
    hasConnectedRef.current = false;
    setIsConnected(false);
    playDisconnectedSound();
    
    // Call MeetingRoom's onDisconnected handler first
    eventHandlers.onDisconnected?.();
    
    endCall();
  }, [playDisconnectedSound, endCall, eventHandlers]);

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

  // Handle maximize - just set state, useEffect handles navigation
  const handleMaximize = useCallback(() => {
    // Exit any existing PiP
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    // Just maximize - useEffect will handle navigation when wasMinimizedRef changes
    maximize();
  }, [maximize]);

  // Handle minimize - go to home and show widget
  const handleMinimize = useCallback(() => {
    minimize();
    // Use replace to avoid creating back navigation entries
    navigate('/', { replace: true });
  }, [minimize, navigate]);

  // Handle error with auto-reconnect for ConnectionError
  const handleError = useCallback((error: Error) => {
    console.error('[GlobalActiveCall] Error:', error);
    
    // Check if this is a ConnectionError and we haven't exceeded max attempts
    const isConnectionError = error.name === 'ConnectionError' || 
      error.message?.toLowerCase().includes('connection') ||
      error.message?.toLowerCase().includes('cancelled');
    
    if (isConnectionError && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
      setIsReconnecting(true);
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000); // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      
      toast.info(
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5 animate-spin flex-shrink-0">
            <defs>
              <linearGradient id="reconnect-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6e4"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
            <path d="M21 12a9 9 0 11-6.219-8.56" stroke="url(#reconnect-gradient)" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="font-medium">Переподключение...</div>
            <div className="text-xs text-muted-foreground">Попытка {reconnectAttempt + 1} из {MAX_RECONNECT_ATTEMPTS}</div>
          </div>
        </div>,
        { duration: delay + 2000 }
      );
      
      // Schedule reconnect attempt
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[GlobalActiveCall] Reconnect attempt ${reconnectAttempt + 1}`);
        setReconnectAttempt(prev => prev + 1);
        setIsReconnecting(false);
        // The LiveKitRoom component will auto-reconnect when it detects disconnection
      }, delay);
    } else if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      // Max attempts exceeded
      setIsReconnecting(false);
      toast.error(
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
            <defs>
              <linearGradient id="error-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444"/>
                <stop offset="100%" stopColor="#f97316"/>
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="10" stroke="url(#error-gradient)" strokeWidth="2" fill="none"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="url(#error-gradient)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="font-medium">Не удалось подключиться</div>
            <div className="text-xs text-muted-foreground">Попробуйте перезагрузить страницу</div>
          </div>
        </div>,
        { duration: 10000 }
      );
    } else {
      // Other error types
      toast.error('Ошибка подключения', {
        description: error.message || 'Не удалось подключиться к комнате',
      });
    }
    
    eventHandlers.onError?.(error);
  }, [eventHandlers, reconnectAttempt]);

  // =========================================
  // EARLY RETURN - SAFE AFTER ALL HOOKS ARE DECLARED
  // =========================================
  
  // Don't render anything if no active call
  if (!isActive) {
    return null;
  }

  // Show fullscreen when call is active and not minimized
  // The call overlay should be visible regardless of the current route
  const shouldShowFullscreen = !isMinimized;

  return (
    <>
      {/* Single always-mounted LiveKitRoom instance */}
      <div
        className={cn(
          "fixed bg-background",
          // Smooth animation for opacity, transform and scale
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          shouldShowFullscreen 
            ? "inset-0 z-50 opacity-100 pointer-events-auto scale-100" 
            : "opacity-0 pointer-events-none scale-95",
          // Entry animation when maximizing
          isAnimatingIn && "animate-expand-from-widget"
        )}
        style={
          shouldShowFullscreen
            ? { transformOrigin: 'bottom right' }
            : { 
                width: 1, 
                height: 1, 
                overflow: 'hidden',
                transformOrigin: 'bottom right'
              }
        }
        aria-hidden={!shouldShowFullscreen}
      >
        <LiveKitRoom
          key={roomKeyRef.current || 'no-room'}
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
          isMaximizing={isAnimatingIn}
        />
      </div>

      {/* Minimize animation overlay */}
      {isAnimatingOut &&
        createPortal(
          <div 
            className="fixed inset-0 z-[9998] pointer-events-none animate-shrink-overlay"
            style={{
              background: 'radial-gradient(ellipse at bottom right, hsl(var(--primary) / 0.3) 0%, transparent 60%)',
            }}
          />,
          document.body
        )}

      {/* Floating minimized widget */}
      {isMinimized &&
        createPortal(
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
