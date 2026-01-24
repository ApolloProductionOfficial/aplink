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
    setState(prev => ({
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
    }));
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
