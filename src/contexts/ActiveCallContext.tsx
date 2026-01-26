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
};

const ActiveCallContext = createContext<ActiveCallContextType | null>(null);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveCallState>(defaultState);
  const roomRef = useRef<Room | null>(null);
  const handlersRef = useRef<CallEventHandlers>({});

  const startCall = useCallback((params: {
    roomName: string;
    roomSlug: string;
    participantName: string;
    participantIdentity?: string;
    roomDisplayName: string;
  }) => {
    // Skip if call is already active for the same room - prevents double initialization on maximize
    setState(prev => {
      if (prev.isActive && prev.roomSlug === params.roomSlug) {
        console.log('[ActiveCallContext] Call already active for room:', params.roomSlug, '- skipping startCall');
        return prev;
      }
      
      console.log('[ActiveCallContext] Starting call for room:', params.roomSlug);
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
      };
    });
  }, []);

  const endCall = useCallback(() => {
    roomRef.current = null;
    handlersRef.current = {};
    setState(defaultState);
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
