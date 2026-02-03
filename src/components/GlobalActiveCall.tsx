import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Room, RoomEvent } from 'livekit-client';
import { toast } from 'sonner';
import { useActiveCall } from '@/contexts/ActiveCallContext';
import { LiveKitRoom } from '@/components/LiveKitRoom';
import { MinimizedCallWidget } from '@/components/MinimizedCallWidget';
import { CaptionsOverlay } from '@/components/CaptionsOverlay';
import { RealtimeTranslator } from '@/components/RealtimeTranslator';
import ParticipantsIPPanel from '@/components/ParticipantsIPPanel';
import { useAuth } from '@/hooks/useAuth';
import { useConnectionSounds } from '@/hooks/useConnectionSounds';
import { useLiveKitTranslationBroadcast } from '@/hooks/useLiveKitTranslationBroadcast';
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
    // Panel visibility from context
    showTranslator,
    showCaptions,
    showIPPanel,
    isAdmin,
    setShowTranslator,
    setShowCaptions,
    setShowIPPanel,
  } = useActiveCall();

  // Translation broadcast for LiveKit
  const { 
    isBroadcasting, 
    startBroadcast, 
    stopBroadcast, 
    playTranslatedAudio,
    sendTranslationToParticipants 
  } = useLiveKitTranslationBroadcast(liveKitRoom);

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

  // Handle incoming translation data from other participants
  useEffect(() => {
    if (!liveKitRoom) return;
    
    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));
        
        if (message.type === 'translation_audio' && message.audioBase64) {
          console.log('[GlobalActiveCall] Received translation from:', message.senderName);
          
          // Play the translated audio
          const audioUrl = `data:audio/mpeg;base64,${message.audioBase64}`;
          playTranslatedAudio(audioUrl);
          
          toast.success(`🌐 ${message.senderName}`, {
            description: message.text?.substring(0, 100) || 'Перевод получен',
            duration: 3000,
          });
        }
      } catch {
        // Not a translation message
      }
    };
    
    liveKitRoom.on(RoomEvent.DataReceived, handleDataReceived);
    
    return () => {
      liveKitRoom.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [liveKitRoom, playTranslatedAudio]);
  
  // Start/stop broadcast when translator is toggled
  useEffect(() => {
    if (showTranslator && liveKitRoom && !isBroadcasting) {
      startBroadcast();
    } else if (!showTranslator && isBroadcasting) {
      stopBroadcast();
    }
  }, [showTranslator, liveKitRoom, isBroadcasting, startBroadcast, stopBroadcast]);

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
    
    // Only play sound on FIRST connection
    // hasConnectedRef stays true during minimize/maximize to prevent re-triggering
    // NOTE: Don't show toast on first connection - it interrupts recording prompts
    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true;
      playConnectedSound();
      // Removed success toast - it was interrupting other important notifications
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
  const handleDisconnected = useCallback((reason?: any) => {
    console.log('[GlobalActiveCall] Disconnected, reason:', reason);
    
    // Check if user initiated disconnect (clicked "Exit" button)
    // reason === 3 or reasonName === 'Cancelled' means client-initiated disconnect
    const isUserInitiated = 
      reason === 3 || 
      reason?.reason === 3 || 
      reason?.reasonName === 'Cancelled' ||
      (typeof reason?.message === 'string' && reason.message.includes('Client initiated'));
    
    if (isUserInitiated) {
      console.log('[GlobalActiveCall] User initiated disconnect - ending call without reconnect');
    }
    
    hasConnectedRef.current = false;
    setIsConnected(false);
    playDisconnectedSound();
    
    // Reset reconnect state
    setReconnectAttempt(0);
    setIsReconnecting(false);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
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
    // Route through /__refresh to force cache-busting after ending a call
    navigate(`/__refresh?to=${encodeURIComponent('/')}&t=${Date.now()}`, { replace: true });
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

  // Handle error with auto-reconnect for ConnectionError and token errors
  const handleError = useCallback((error: Error) => {
    const errorMsg = String(error?.message || error || '').toLowerCase();
    const errorName = (error as any)?.name || '';
    const reasonName = (error as any)?.reasonName || '';
    const status = (error as any)?.status;
    
    // Check if this is a "Cancelled" error - user-initiated, don't report as error
    if (reasonName === 'Cancelled' || errorMsg.includes('cancelled')) {
      console.info('[GlobalActiveCall] User-initiated disconnect (Cancelled)');
      return;
    }
    
    // Check if this is a token error (expired/invalid)
    const isTokenError = 
      status === 401 ||
      reasonName.toLowerCase() === 'notallowed' ||
      errorMsg.includes('token is expired') ||
      errorMsg.includes('invalid token') ||
      errorMsg.includes('expired');
    
    if (isTokenError) {
      console.warn('[GlobalActiveCall] Token error detected - LiveKitRoom will handle reconnect');
      // Token errors are now handled by LiveKitRoom's internal force reconnect mechanism
      return;
    }
    
    // Check if this is a ConnectionError and we haven't exceeded max attempts
    const isConnectionError = errorName === 'ConnectionError' || 
      errorMsg.includes('connection');
    
    if (isConnectionError && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
      setIsReconnecting(true);
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
      
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
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`[GlobalActiveCall] Reconnect attempt ${reconnectAttempt + 1}`);
        setReconnectAttempt(prev => prev + 1);
        setIsReconnecting(false);
      }, delay);
    } else if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      setIsReconnecting(false);
      toast.error('Не удалось подключиться', {
        description: 'Попробуйте перезагрузить страницу',
      });
    } else if (errorName !== 'NegotiationError') {
      // Don't show toast for NegotiationError - handled by LiveKitRoom
      console.warn('[GlobalActiveCall] Error:', error);
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
      {/* Darkening overlay when maximizing */}
      {isAnimatingIn &&
        createPortal(
          <div 
            className="fixed inset-0 z-[59] pointer-events-none animate-maximize-overlay"
            style={{
              background: 'radial-gradient(ellipse at center, hsl(var(--background) / 0.95) 0%, hsl(var(--background)) 100%)',
            }}
          />,
          document.body
        )}

      {/* Single always-mounted LiveKitRoom instance */}
      {/* CRITICAL: Never reduce to 1x1 as it breaks MediaRecorder and Canvas */}
      {/* Instead, use visibility:hidden to completely hide while preserving DOM state */}
      <div
        className={cn(
          "fixed inset-0 bg-background",
          // Smooth animation for opacity, transform and scale
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          shouldShowFullscreen 
            ? "z-[60] opacity-100 pointer-events-auto scale-100 visible" 
            : "z-[-1] opacity-0 pointer-events-none scale-95 invisible",
          // Entry animation when maximizing
          isAnimatingIn && "animate-expand-from-widget"
        )}
        style={{ transformOrigin: 'bottom right' }}
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
            className="fixed inset-0 z-[59] pointer-events-none animate-shrink-overlay"
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

      {/* === GLOBAL PANELS - Rendered via portals for z-index independence === */}
      {/* IMPORTANT: Removed strict liveKitRoom check - panels handle null internally */}
      
      {/* Real-time Captions Overlay */}
      {showCaptions &&
        createPortal(
          <div 
            key={`captions-portal-${isMinimized}-${liveKitRoom?.name || 'pending'}`}
            className="captions-overlay-portal"
          >
            <CaptionsOverlay
              room={liveKitRoom}
              participantName={participantName}
              isEnabled={showCaptions && !!liveKitRoom}
              onToggle={() => setShowCaptions(false)}
            />
          </div>,
          document.body
        )}

      {/* Realtime Translator Panel */}
      {showTranslator &&
        createPortal(
          <div 
            key={`translator-portal-${isMinimized}-${liveKitRoom?.name || 'pending'}`}
            className="translator-panel-portal"
          >
            <RealtimeTranslator
              isActive={showTranslator && !!liveKitRoom}
              onToggle={() => setShowTranslator(false)}
              roomId={roomSlug}
              jitsiApi={null}
              liveKitRoom={liveKitRoom}
              onTranslatedAudio={(audioUrl) => {
                console.log('[GlobalActiveCall] Translation audio ready for broadcast');
              }}
              onSendTranslation={sendTranslationToParticipants}
            />
          </div>,
          document.body
        )}

      {/* IP Panel for admins */}
      {isAdmin && showIPPanel &&
        createPortal(
          <div 
            key={`ip-panel-portal-${isMinimized}-${liveKitRoom?.name || 'pending'}`}
            className="ip-panel-portal"
          >
            <ParticipantsIPPanel
              roomId={roomSlug}
              isOpen={showIPPanel && !!liveKitRoom}
              onClose={() => setShowIPPanel(false)}
            />
          </div>,
          document.body
        )}
    </>
  );
}
