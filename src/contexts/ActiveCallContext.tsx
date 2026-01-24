import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Room } from 'livekit-client';

interface ActiveCallState {
  isActive: boolean;
  isMinimized: boolean;
  roomName: string;
  roomSlug: string;
  participantName: string;
  participantIdentity?: string;
  roomDisplayName: string;
  liveKitRoom: Room | null;
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
};

const ActiveCallContext = createContext<ActiveCallContextType | null>(null);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ActiveCallState>(defaultState);
  const roomRef = useRef<Room | null>(null);

  const startCall = useCallback((params: {
    roomName: string;
    roomSlug: string;
    participantName: string;
    participantIdentity?: string;
    roomDisplayName: string;
  }) => {
    setState({
      isActive: true,
      isMinimized: false,
      roomName: params.roomName,
      roomSlug: params.roomSlug,
      participantName: params.participantName,
      participantIdentity: params.participantIdentity,
      roomDisplayName: params.roomDisplayName,
      liveKitRoom: roomRef.current,
    });
  }, []);

  const endCall = useCallback(() => {
    roomRef.current = null;
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

  return (
    <ActiveCallContext.Provider
      value={{
        ...state,
        startCall,
        endCall,
        minimize,
        maximize,
        setLiveKitRoom,
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
