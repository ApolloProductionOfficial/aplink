import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Room } from 'livekit-client';

interface CallEventHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onError?: (error: Error) => void;
}

interface ActiveCallState {
  isActive: boolean;
  isMinimized: boolean;
  roomName: string;
  roomSlug: string;
  participantName: string;
  participantIdentity?: string;
  roomDisplayName: string;
  liveKitRoom: Room | null;
  headerButtons: ReactNode | null;
  connectionIndicator: ReactNode | null;
  eventHandlers: CallEventHandlers;
  // Panel visibility states - managed globally for persistence across routes
  showTranslator: boolean;
  showCaptions: boolean;
  showIPPanel: boolean;
  isAdmin: boolean;
  // Reconnection state - managed globally to block UI during reconnect
  isRoomReconnecting: boolean;
  // Guest identity preservation - prevents identity change on reconnect
  guestIdentity: string | null;
  // Fallback mode flag - when true, use stable video settings
  useFallbackVideoProfile: boolean;
}

interface ActiveCallContextType extends ActiveCallState {
  startCall: (params: {
    roomName: string;
    roomSlug: string;
    participantName: string;
    participantIdentity?: string;
    roomDisplayName: string;
  }) => void;
  endCall: () => void;
  minimize: () => void;
  maximize: () => void;
  setLiveKitRoom: (room: Room | null) => void;
  setHeaderButtons: (node: ReactNode | null) => void;
  setConnectionIndicator: (node: ReactNode | null) => void;
  setEventHandlers: (handlers: CallEventHandlers) => void;
  // Panel visibility setters
  setShowTranslator: (show: boolean) => void;
  setShowCaptions: (show: boolean) => void;
  setShowIPPanel: (show: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  // Reconnection state setters
  setIsRoomReconnecting: (isReconnecting: boolean) => void;
  setGuestIdentity: (identity: string | null) => void;
  setUseFallbackVideoProfile: (useFallback: boolean) => void;
  // Force reconnect trigger (incremented to trigger controlled reconnect)
  forceReconnectKey: number;
  triggerForceReconnect: () => void;
}

const defaultState: ActiveCallState = {
  isActive: false,
  isMinimized: false,
  roomName: '',
  roomSlug: '',
  participantName: '',
  participantIdentity: undefined,
  roomDisplayName: '',
  liveKitRoom: null,
  headerButtons: null,
  connectionIndicator: null,
  eventHandlers: {},
  // Panel defaults
  showTranslator: false,
  showCaptions: false,
  showIPPanel: false,
  isAdmin: false,
  // Reconnection defaults
  isRoomReconnecting: false,
  guestIdentity: null,
  useFallbackVideoProfile: false,
};

const ActiveCallContext = createContext<ActiveCallContextType | null>(null);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveCallState>(defaultState);
  const [forceReconnectKey, setForceReconnectKey] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const handlersRef = useRef<CallEventHandlers>({});
  
  // MOBILE FIX: Strict lock to prevent duplicate startCall executions
  const isStartingCallRef = useRef(false);
  const activeRoomSlugRef = useRef<string | null>(null);

  const startCall = useCallback((params: {
    roomName: string;
    roomSlug: string;
    participantName: string;
    participantIdentity?: string;
    roomDisplayName: string;
  }) => {
    // MOBILE FIX: Use ref-based lock to prevent race conditions
    // Check ref BEFORE setState to prevent concurrent calls from queuing up
    if (isStartingCallRef.current) {
      console.log('[ActiveCallContext] startCall already in progress - skipping');
      return;
    }
    
    if (activeRoomSlugRef.current === params.roomSlug) {
      console.log('[ActiveCallContext] Call already active for room:', params.roomSlug, '- skipping');
      return;
    }
    
    // Lock immediately before any async work
    isStartingCallRef.current = true;
    activeRoomSlugRef.current = params.roomSlug;
    
    console.log('[ActiveCallContext] Starting call for room:', params.roomSlug);
    
    // Use functional update to ensure we're working with latest state
    setState(prev => {
      // Double-check inside setState in case of rapid calls
      if (prev.isActive && prev.roomSlug === params.roomSlug) {
        console.log('[ActiveCallContext] (inside setState) Call already active, skipping');
        return prev;
      }
      
      return {
        ...defaultState,
        isActive: true,
        isMinimized: false,
        roomName: params.roomName,
        roomSlug: params.roomSlug,
        participantName: params.participantName,
        participantIdentity: params.participantIdentity,
        roomDisplayName: params.roomDisplayName,
        liveKitRoom: roomRef.current,
        headerButtons: prev.headerButtons,
        connectionIndicator: prev.connectionIndicator,
        eventHandlers: handlersRef.current,
        // Preserve admin status
        isAdmin: prev.isAdmin,
        // Preserve guest identity if already set
        guestIdentity: prev.guestIdentity,
        // Reset fallback profile on new call
        useFallbackVideoProfile: false,
        isRoomReconnecting: false,
      };
    });
    
    // Release lock after setState is queued (microtask)
    queueMicrotask(() => {
      isStartingCallRef.current = false;
    });
  }, []);

  const endCall = useCallback(() => {
    console.log('[ActiveCallContext] Ending call');
    roomRef.current = null;
    handlersRef.current = {};
    // Reset refs to allow new calls
    isStartingCallRef.current = false;
    activeRoomSlugRef.current = null;
    setState(defaultState);
    setForceReconnectKey(0);
  }, []);

  const minimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: true }));
  }, []);

  const maximize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  const setLiveKitRoom = useCallback((room: Room | null) => {
    roomRef.current = room;
    setState(prev => ({ ...prev, liveKitRoom: room }));
  }, []);

  const setHeaderButtons = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, headerButtons: node }));
  }, []);

  const setConnectionIndicator = useCallback((node: ReactNode | null) => {
    setState(prev => ({ ...prev, connectionIndicator: node }));
  }, []);

  const setEventHandlers = useCallback((handlers: CallEventHandlers) => {
    handlersRef.current = handlers;
    setState(prev => ({ ...prev, eventHandlers: handlers }));
  }, []);

  // Panel visibility setters
  const setShowTranslator = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showTranslator: show }));
  }, []);

  const setShowCaptions = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showCaptions: show }));
  }, []);

  const setShowIPPanel = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showIPPanel: show }));
  }, []);

  const setIsAdmin = useCallback((isAdmin: boolean) => {
    setState(prev => ({ ...prev, isAdmin }));
  }, []);

  // Reconnection state setters
  const setIsRoomReconnecting = useCallback((isReconnecting: boolean) => {
    setState(prev => ({ ...prev, isRoomReconnecting: isReconnecting }));
  }, []);

  const setGuestIdentity = useCallback((identity: string | null) => {
    setState(prev => ({ ...prev, guestIdentity: identity }));
  }, []);

  const setUseFallbackVideoProfile = useCallback((useFallback: boolean) => {
    setState(prev => ({ ...prev, useFallbackVideoProfile: useFallback }));
  }, []);

  // Force reconnect trigger
  const triggerForceReconnect = useCallback(() => {
    console.log('[ActiveCallContext] Triggering force reconnect');
    setForceReconnectKey(prev => prev + 1);
  }, []);

  return (
    <ActiveCallContext.Provider
      value={{
        ...state,
        startCall,
        endCall,
        minimize,
        maximize,
        setLiveKitRoom,
        setHeaderButtons,
        setConnectionIndicator,
        setEventHandlers,
        setShowTranslator,
        setShowCaptions,
        setShowIPPanel,
        setIsAdmin,
        setIsRoomReconnecting,
        setGuestIdentity,
        setUseFallbackVideoProfile,
        forceReconnectKey,
        triggerForceReconnect,
      }}
    >
      {children}
    </ActiveCallContext.Provider>
  );
}

export function useActiveCall() {
  const context = useContext(ActiveCallContext);
  if (!context) {
    throw new Error('useActiveCall must be used within ActiveCallProvider');
  }
  return context;
}
