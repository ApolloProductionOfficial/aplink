import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { Room } from 'livekit-client';

// Device ID utility for unique guest identity (prevents duplicate participants on mobile)
const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem('aplink_device_id');
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    localStorage.setItem('aplink_device_id', id);
  }
  return id;
};

// Issue 8: Translation entry type for history panel
export interface TranslationEntry {
  id: string;
  senderName: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  timestamp: number;
}

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
  // Panel visibility states
  showTranslator: boolean;
  showCaptions: boolean;
  showIPPanel: boolean;
  isAdmin: boolean;
  // Reconnection state
  isRoomReconnecting: boolean;
  guestIdentity: string | null;
  useFallbackVideoProfile: boolean;
  // Issue 8: Translation history
  translationHistory: TranslationEntry[];
  showTranslationHistory: boolean;
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
  setShowTranslator: (show: boolean) => void;
  setShowCaptions: (show: boolean) => void;
  setShowIPPanel: (show: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setIsRoomReconnecting: (isReconnecting: boolean) => void;
  setGuestIdentity: (identity: string | null) => void;
  setUseFallbackVideoProfile: (useFallback: boolean) => void;
  forceReconnectKey: number;
  triggerForceReconnect: () => void;
  // Issue 8: Translation history methods
  addTranslationEntry: (entry: Omit<TranslationEntry, 'id'>) => void;
  clearTranslationHistory: () => void;
  setShowTranslationHistory: (show: boolean) => void;
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
  showTranslator: false,
  showCaptions: false,
  showIPPanel: false,
  isAdmin: false,
  isRoomReconnecting: false,
  guestIdentity: null,
  useFallbackVideoProfile: false,
  // Issue 8
  translationHistory: [],
  showTranslationHistory: false,
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
    if (isStartingCallRef.current) {
      console.log('[ActiveCallContext] startCall already in progress - skipping');
      return;
    }
    
    if (activeRoomSlugRef.current === params.roomSlug) {
      console.log('[ActiveCallContext] Call already active for room:', params.roomSlug, '- skipping');
      return;
    }
    
    isStartingCallRef.current = true;
    activeRoomSlugRef.current = params.roomSlug;
    
    const effectiveIdentity = params.participantIdentity || `guest-${getDeviceId()}-${Date.now().toString(36)}`;
    
    console.log('[ActiveCallContext] Starting call for room:', params.roomSlug, 'identity:', effectiveIdentity);
    
    setState(prev => {
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
        participantIdentity: effectiveIdentity,
        roomDisplayName: params.roomDisplayName,
        liveKitRoom: roomRef.current,
        headerButtons: prev.headerButtons,
        connectionIndicator: prev.connectionIndicator,
        eventHandlers: handlersRef.current,
        isAdmin: prev.isAdmin,
        guestIdentity: prev.guestIdentity || effectiveIdentity,
        useFallbackVideoProfile: false,
        isRoomReconnecting: false,
      };
    });
    
    queueMicrotask(() => {
      isStartingCallRef.current = false;
    });
  }, []);

  const endCall = useCallback(() => {
    console.log('[ActiveCallContext] Ending call');
    roomRef.current = null;
    handlersRef.current = {};
    isStartingCallRef.current = false;
    activeRoomSlugRef.current = null;
    setState(defaultState);
    setForceReconnectKey(0);
    // Clear chat sessionStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('aplink-chat-')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch {}
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

  const setIsRoomReconnecting = useCallback((isReconnecting: boolean) => {
    setState(prev => ({ ...prev, isRoomReconnecting: isReconnecting }));
  }, []);

  const setGuestIdentity = useCallback((identity: string | null) => {
    setState(prev => ({ ...prev, guestIdentity: identity }));
  }, []);

  const setUseFallbackVideoProfile = useCallback((useFallback: boolean) => {
    setState(prev => ({ ...prev, useFallbackVideoProfile: useFallback }));
  }, []);

  const triggerForceReconnect = useCallback(() => {
    console.log('[ActiveCallContext] Triggering force reconnect');
    setForceReconnectKey(prev => prev + 1);
  }, []);

  // Issue 8: Translation history methods
  const addTranslationEntry = useCallback((entry: Omit<TranslationEntry, 'id'>) => {
    setState(prev => ({
      ...prev,
      translationHistory: [
        ...prev.translationHistory.slice(-49), // Keep last 50 entries
        { ...entry, id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ],
    }));
  }, []);

  const clearTranslationHistory = useCallback(() => {
    setState(prev => ({ ...prev, translationHistory: [], showTranslationHistory: false }));
  }, []);

  const setShowTranslationHistory = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showTranslationHistory: show }));
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
        // Issue 8
        addTranslationEntry,
        clearTranslationHistory,
        setShowTranslationHistory,
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
