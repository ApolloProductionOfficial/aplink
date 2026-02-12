import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  LiveKitRoom as LKRoom,
  RoomAudioRenderer,
  useRoomContext,
  useTracks,
  useParticipants,
  GridLayout,
  ParticipantTile,
  LayoutContextProvider,
  useLocalParticipant,
  VideoTrack,
  DisconnectButton,
  useStartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, RoomEvent, Room, RemoteParticipant, VideoPresets, LocalParticipant, ConnectionState, ConnectionQuality } from "livekit-client";
import { BackgroundBlur, VirtualBackground } from "@livekit/track-processors";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, 
  VideoOff, 
  Video, 
  Mic, 
  MicOff,
  MonitorUp, 
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Hand,
  Volume2,
  VolumeX,
  Pencil,
  Mic2,
  Check,
  LayoutGrid,
  MonitorPlay,
  VolumeOff,
  User,
  Presentation,
  PictureInPicture,
  RefreshCw,
  Circle,
  MoreHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MobileTooltip } from "@/components/ui/MobileTooltip";
import { cn } from "@/lib/utils";
import { InCallChat } from "@/components/InCallChat";
import { VirtualBackgroundSelector } from "@/components/VirtualBackgroundSelector";
import { EmojiReactions } from "@/components/EmojiReactions";
import { CallTimer } from "@/components/CallTimer";
import { CallDiagnosticsPanel } from "@/components/CallDiagnosticsPanel";
import { useRaiseHand } from "@/hooks/useRaiseHand";
import { useNoiseSuppression } from "@/hooks/useNoiseSuppression";
import { useVoiceNotifications } from "@/hooks/useVoiceNotifications";
import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { useCallDiagnostics } from "@/hooks/useCallDiagnostics";
import { CollaborativeWhiteboard } from "@/components/CollaborativeWhiteboard";
import { DrawingOverlay } from "@/components/DrawingOverlay";
import { CallMenuHint } from "@/components/CallMenuHint";
import { AudioProblemDetector } from "@/components/AudioProblemDetector";
import { FocusVideoLayout } from "@/components/FocusVideoLayout";
import { GalleryVideoLayout } from "@/components/GalleryVideoLayout";
import { WebinarVideoLayout } from "@/components/WebinarVideoLayout";
import { ConnectionLoadingScreen } from "@/components/ConnectionLoadingScreen";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useNativePiP } from "@/hooks/useNativePiP";
import { useIsMobile } from "@/hooks/use-mobile";
import { useActiveCall } from "@/contexts/ActiveCallContext";
import { toast } from "sonner";

// ====== iOS DETECTION ======

/** Detect if current device is iOS (iPhone/iPad) or Safari on mobile */
function detectIsIOSOrMobileSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isMobileDevice = /Mobi|Android/i.test(ua) || isIOS;
  return isIOS || (isSafari && isMobileDevice);
}

// ====== TELEGRAM CALL ERROR NOTIFICATION (rate-limited, module-level) ======
let _lastTelegramNotifyTime = 0;
async function sendCallErrorToTelegram(errorType: string, message: string, details?: Record<string, unknown>) {
  const now = Date.now();
  if (now - _lastTelegramNotifyTime < 30000) return; // Max 1 per 30s
  _lastTelegramNotifyTime = now;
  try {
    await supabase.functions.invoke('send-telegram-notification', {
      body: {
        errorType: `CALL_${errorType}`,
        errorMessage: message,
        source: 'Call Diagnostics',
        severity: errorType === 'NEGOTIATION_ERROR' ? 'error' : 'warning',
        details: {
          ...details,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 200) : '',
        },
      },
    });
  } catch (err) {
    console.warn('[LiveKitRoom] Failed to send Telegram notification:', err);
  }
}

// ====== TOKEN UTILITIES ======

/** Decode JWT payload without external libraries */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** Get token expiration timestamp in seconds */
function getTokenExp(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp || null;
}

/** Check if error is token-related (expired/invalid) */
function isTokenError(error: any): boolean {
  const msg = String(error?.message || error || '').toLowerCase();
  const reasonName = String(error?.reasonName || '').toLowerCase();
  const status = error?.status;
  return (
    status === 401 ||
    reasonName === 'notallowed' ||
    msg.includes('token is expired') ||
    msg.includes('invalid token') ||
    msg.includes('expired') ||
    msg.includes('401')
  );
}

/** Check if error is NegotiationError */
function isNegotiationError(error: any): boolean {
  return error?.name === 'NegotiationError' || error?.code === 13;
}

interface LiveKitRoomProps {
  roomName: string;
  participantName: string;
  participantIdentity?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onError?: (error: Error) => void;
  /** Callback to get room reference for translator integration */
  onRoomReady?: (room: Room) => void;
  /** Header buttons passed from parent */
  headerButtons?: React.ReactNode;
  /** Room display name for header */
  roomDisplayName?: string;
  /** Callback when user clicks minimize (logo) */
  onMinimize?: () => void;
  /** Connection quality indicator element */
  connectionIndicator?: React.ReactNode;
  /** True when entering from minimized state - disables translate animations */
  isMaximizing?: boolean;
}

export function LiveKitRoom({
  roomName,
  participantName,
  participantIdentity,
  onConnected,
  onDisconnected,
  onParticipantJoined,
  onParticipantLeft,
  onError,
  onRoomReady,
  headerButtons,
  roomDisplayName,
  onMinimize,
  connectionIndicator,
  isMaximizing = false,
}: LiveKitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Connection step tracking for loading UI (0-3: token, connect, media, audio)
  const [connectionStep, setConnectionStep] = useState(0);
  
  // Get context for reconnect state, guest identity, fallback profile
  const { 
    setIsRoomReconnecting, 
    isRoomReconnecting,
    guestIdentity, 
    setGuestIdentity, 
    useFallbackVideoProfile, 
    setUseFallbackVideoProfile,
    forceReconnectKey,
    triggerForceReconnect,
  } = useActiveCall();
  
  // Prevent re-fetching token on component updates
  const hasInitializedRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  
  // MOBILE FIX: Stronger debounce and serial lock for token fetch
  // Prevents reconnect storms from creating duplicate participants
  const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const lastFetchRoomRef = useRef<string | null>(null);
  const lastFetchIdentityRef = useRef<string | null>(null);
  // MOBILE STABILITY: Increased debounce to prevent reconnect storms
  const FETCH_DEBOUNCE_MS = 5000; // 5 seconds debounce for mobile stability
  const FETCH_SERIAL_LOCK_MS = 2000; // Minimum time between fetch attempts
  const serialLockRef = useRef<Promise<boolean> | null>(null);
  const tokenGenerationIdRef = useRef<number>(0); // Unique ID per token generation attempt
  
  // Stable token ref to prevent re-renders from triggering reconnection
  const tokenRef = useRef<string | null>(null);
  const tokenExpRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // NegotiationError tracking for auto-fallback
  const negotiationErrorsRef = useRef<number[]>([]);
  const NEGOTIATION_ERROR_WINDOW_MS = 60000; // 60 seconds
  const NEGOTIATION_ERROR_THRESHOLD = 2;
  
  // Force reconnect counter - when incremented, we refresh token and remount LKRoom
  const [lkInstanceKey, setLkInstanceKey] = useState(0);
  const forceReconnectCooldownRef = useRef<number>(0);
  const forceReconnectAttemptsRef = useRef<number>(0);
  const MAX_FORCE_RECONNECT_ATTEMPTS = 3;
  const FORCE_RECONNECT_COOLDOWN_MS = 15000;
  
  // Memoize token to prevent LKRoom from seeing "new" token on re-renders
  // IMPORTANT: use state token here; refs don't trigger renders and shouldn't be hook deps
  const memoizedToken = useMemo(() => token, [token]);

  // Fetch token function with serial lock - prevents concurrent requests
  const fetchToken = useCallback(async (isRefresh = false): Promise<boolean> => {
    // MOBILE FIX: Serial lock - wait for any pending fetch to complete
    if (serialLockRef.current) {
      console.log("[LiveKitRoom] Waiting for pending token fetch to complete...");
      await serialLockRef.current;
    }
    
    // MOBILE FIX: Strong debounce - reject if too soon after last fetch for same room+identity
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const identityToUse = participantIdentity || guestIdentity || undefined;
    
    // Check if this is a duplicate request (same room, same identity, within debounce window)
    if (!isRefresh && 
        timeSinceLastFetch < FETCH_DEBOUNCE_MS && 
        lastFetchRoomRef.current === roomName &&
        lastFetchIdentityRef.current === identityToUse) {
      console.log("[LiveKitRoom] Token fetch debounced (duplicate request)", { 
        timeSinceLastFetch, 
        room: roomName,
        identity: identityToUse 
      });
      return false;
    }
    
    if (isFetchingRef.current) {
      console.log("[LiveKitRoom] Token fetch already in progress");
      return false;
    }
    
    // Increment generation ID and capture it for this request
    const currentGenerationId = ++tokenGenerationIdRef.current;
    
    lastFetchTimeRef.current = now;
    lastFetchRoomRef.current = roomName;
    lastFetchIdentityRef.current = identityToUse || null;
    isFetchingRef.current = true;
    
    // Create a promise that resolves when this fetch completes (for serial lock)
    let resolveLock: (value: boolean) => void;
    serialLockRef.current = new Promise(resolve => { resolveLock = resolve; });
    
    try {
      if (!isRefresh) {
        setLoading(true);
        setError(null);
        setConnectionStep(0); // Step 0: Getting token
      }
      
      console.log("[LiveKitRoom] Requesting token for room:", roomName, isRefresh ? "(refresh)" : "(initial)", "identity:", identityToUse, "genId:", currentGenerationId);

      const { data, error: fnError } = await supabase.functions.invoke(
        "livekit-token",
        {
          body: {
            roomName,
            participantName,
            participantIdentity: identityToUse,
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Failed to get token");
      }

      if (!data?.token || !data?.url) {
        throw new Error("Invalid token response");
      }
      
      // MOBILE FIX: Check if this response is still relevant (newer request may have started)
      if (currentGenerationId !== tokenGenerationIdRef.current) {
        console.log("[LiveKitRoom] Stale token response ignored, genId:", currentGenerationId, "current:", tokenGenerationIdRef.current);
        resolveLock!(false);
        return false;
      }

      // Step 1: Token received, now connecting
      setConnectionStep(1);

      // Save guest identity from response for future reconnects
      if (!participantIdentity && data.identity) {
        setGuestIdentity(data.identity);
        lastFetchIdentityRef.current = data.identity;
        console.log("[LiveKitRoom] Saved guest identity:", data.identity);
      }

      // Extract and store token expiration
      const exp = getTokenExp(data.token);
      tokenExpRef.current = exp;
      console.log("[LiveKitRoom] Token received, exp:", exp ? new Date(exp * 1000).toISOString() : 'unknown', "genId:", currentGenerationId);

      hasInitializedRef.current = true;
      currentRoomRef.current = roomName;
      tokenRef.current = data.token;
      setToken(data.token);
      setServerUrl(data.url);
      
      // Step 2: Server URL received, setting up media
      setConnectionStep(2);
      
      // Schedule token refresh 2 minutes before expiration
      if (exp && refreshTimerRef.current === null) {
        const nowSec = Math.floor(Date.now() / 1000);
        const refreshIn = Math.max((exp - nowSec - 120) * 1000, 60000); // At least 1 minute
        console.log("[LiveKitRoom] Scheduling token refresh in", Math.round(refreshIn / 1000), "seconds");
        
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          console.log("[LiveKitRoom] Token refresh timer fired");
          fetchToken(true);
        }, refreshIn);
      }
      
      // Step 3: Ready to connect audio
      setTimeout(() => setConnectionStep(3), 300);
      
      resolveLock!(true);
      return true;
    } catch (err) {
      console.error("[LiveKitRoom] Error getting token:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to connect";
      if (!isRefresh) {
        setError(errorMessage);
      }
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      resolveLock!(false);
      return false;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      // Keep serialLockRef.current set so awaiting code gets the result
      // It will be replaced on next fetch attempt
    }
  }, [roomName, participantName, participantIdentity, guestIdentity, setGuestIdentity, onError]);

  // Initial token fetch
  useEffect(() => {
    if ((hasInitializedRef.current && currentRoomRef.current === roomName && tokenRef.current) || isFetchingRef.current) {
      if (!isFetchingRef.current) {
        console.log("[LiveKitRoom] Already have token for room, skipping re-fetch");
      }
      return;
    }

    fetchToken(false);
    
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [roomName, fetchToken]);

  // Handle force reconnect from context
  useEffect(() => {
    if (forceReconnectKey > 0) {
      console.log("[LiveKitRoom] Force reconnect triggered from context, key:", forceReconnectKey);
      handleForceReconnect("context");
    }
  }, [forceReconnectKey]);

  // Force reconnect handler with cooldown and retry limit
  const handleForceReconnect = useCallback(async (reason: string) => {
    const now = Date.now();
    
    // Check cooldown
    if (now - forceReconnectCooldownRef.current < FORCE_RECONNECT_COOLDOWN_MS) {
      console.log("[LiveKitRoom] Force reconnect in cooldown, skipping");
      return;
    }
    
    // Check max attempts
    if (forceReconnectAttemptsRef.current >= MAX_FORCE_RECONNECT_ATTEMPTS) {
      console.warn("[LiveKitRoom] Max force reconnect attempts reached");
      toast.error("Не удалось восстановить соединение", {
        description: "Попробуйте перезагрузить страницу",
      });
      return;
    }
    
    forceReconnectCooldownRef.current = now;
    forceReconnectAttemptsRef.current++;
    
    console.log("[LiveKitRoom] Executing force reconnect, reason:", reason, "attempt:", forceReconnectAttemptsRef.current);
    
    // Clear old token to force fresh fetch
    tokenRef.current = null;
    hasInitializedRef.current = false;
    
    // Fetch new token
    const success = await fetchToken(false);
    
    if (success) {
      // Increment instance key to remount LKRoom with new token
      setLkInstanceKey(prev => prev + 1);
      toast.info("Переподключение...", {
        description: "Восстанавливаем соединение",
        duration: 3000,
      });
    }
  }, [fetchToken]);


  // Handle NegotiationError and trigger fallback if repeated
  const handleNegotiationError = useCallback((error: any) => {
    const now = Date.now();
    
    // Clean old errors outside window
    negotiationErrorsRef.current = negotiationErrorsRef.current.filter(
      ts => now - ts < NEGOTIATION_ERROR_WINDOW_MS
    );
    
    // Add this error
    negotiationErrorsRef.current.push(now);
    
    console.warn("[LiveKitRoom] NegotiationError count in window:", negotiationErrorsRef.current.length);
    
    // Send Telegram notification
    sendCallErrorToTelegram('NEGOTIATION_ERROR', `NegotiationError (code 13) in room ${roomName}`, {
      roomName,
      participantName,
      errorCount: negotiationErrorsRef.current.length,
      useFallbackVideoProfile,
    });
    
    // If threshold exceeded, enable fallback and reconnect
    if (negotiationErrorsRef.current.length >= NEGOTIATION_ERROR_THRESHOLD && !useFallbackVideoProfile) {
      console.log("[LiveKitRoom] Enabling fallback video profile due to repeated NegotiationErrors");
      setUseFallbackVideoProfile(true);
      toast.info("Включён стабильный режим видео", {
        description: "Качество снижено для стабильности соединения",
        duration: 5000,
      });
      handleForceReconnect("negotiation-fallback");
    }
  }, [useFallbackVideoProfile, setUseFallbackVideoProfile, handleForceReconnect, sendCallErrorToTelegram, roomName, participantName]);

  const handleConnected = useCallback(() => {
    console.log("[LiveKitRoom] Connected to room");
    onConnected?.();
  }, [onConnected]);

  const handleDisconnected = useCallback(() => {
    console.log("[LiveKitRoom] Disconnected from room");
    onDisconnected?.();
  }, [onDisconnected]);

  // Loading phrases are now in ConnectionLoadingScreen component

  // iOS Safe Mode detection - enable automatically for iOS/Safari mobile
  const isIOSSafeMode = useMemo(() => {
    return useFallbackVideoProfile || detectIsIOSOrMobileSafari();
  }, [useFallbackVideoProfile]);
  
  // Mobile device detection for adapted behavior
  const isMobileDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Dynamic room options based on fallback mode or iOS Safe Mode
  const roomOptions = useMemo(() => {
    if (isIOSSafeMode) {
      // iOS Safe Mode: VP8, no simulcast, 540p, mono audio, keep tracks alive for stability
      console.log("[LiveKitRoom] Using iOS SAFE MODE (VP8, 540p, no simulcast, mono audio, stopLocalTrackOnUnpublish: false)");
      return {
        adaptiveStream: true,
        dynacast: true,
        // KEY FIX: Don't stop tracks on unpublish — helps with reconnection
        stopLocalTrackOnUnpublish: false,
        // Custom reconnect policy with longer delays for iOS
        reconnectPolicy: {
          nextRetryDelayInMs: (context: { retryCount: number; elapsedMs: number }) => {
            const baseDelay = 1500;
            const maxDelay = 15000;
            const delay = Math.min(baseDelay * Math.pow(1.5, context.retryCount), maxDelay);
            // Give up after 30 seconds
            if (context.elapsedMs > 30000) return null;
            return delay;
          }
        },
        videoCaptureDefaults: {
          resolution: {
            width: 960,
            height: 540,
            frameRate: 20, // Lower framerate for iOS stability
          },
        },
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 1, // Mono for iOS stability
        },
        publishDefaults: {
          simulcast: false, // Disable simulcast to reduce renegotiations
          videoCodec: 'vp8' as const, // VP8 is more stable on iOS Safari
          dtx: true,
          red: true,
        },
      };
    }
    
    // Default HD profile for desktop/modern browsers
    return {
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: {
          width: 1920,
          height: 1080,
          frameRate: 30,
        },
      },
      audioCaptureDefaults: {
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 2,
      },
      publishDefaults: {
        simulcast: true,
        videoCodec: 'vp9' as const,
        backupCodec: { codec: 'h264' as const },
        dtx: true,
        red: true,
        videoSimulcastLayers: [
          VideoPresets.h360,
          VideoPresets.h540,
          VideoPresets.h1080,
        ],
      },
      // Keep tracks alive across reconnections to prevent re-negotiation failures
      stopLocalTrackOnUnpublish: false,
    };
  }, [isIOSSafeMode]);

  // Serialize error properly for logging (Error objects serialize to {} by default)
  const serializeError = useCallback((err: any): string => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    const obj: Record<string, any> = {
      message: err.message || 'No message',
      name: err.name || 'Error',
    };
    if (err.code) obj.code = err.code;
    if (err.reason) obj.reason = err.reason;
    if (err.reasonName) obj.reasonName = err.reasonName;
    if (err.status) obj.status = err.status;
    if (err.stack) obj.stack = err.stack.substring(0, 300);
    return JSON.stringify(obj);
  }, []);

  // Handle room error with smart recovery
  const handleRoomError = useCallback((err: Error) => {
    // Check if it's a token error
    if (isTokenError(err)) {
      console.warn("[LiveKitRoom] Token error detected, triggering force reconnect");
      handleForceReconnect("token");
      return;
    }
    
    // Check if it's a NegotiationError
    if (isNegotiationError(err)) {
      // Use console.warn instead of error to avoid triggering error notifications
      console.warn("[LiveKitRoom] NegotiationError:", serializeError(err));
      handleNegotiationError(err);
      return;
    }
    
    // For other errors, log with proper serialization and notify
    console.warn("[LiveKitRoom] Room error:", serializeError(err));
    onError?.(err);
  }, [handleForceReconnect, handleNegotiationError, onError, serializeError]);

  // =========================================
  // EARLY RETURNS - SAFE AFTER ALL HOOKS ABOVE
  // =========================================

  if (loading) {
    return (
      <ConnectionLoadingScreen 
        currentStep={connectionStep} 
        roomName={roomDisplayName || roomName} 
      />
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="glass-dark rounded-2xl p-8 flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <VideoOff className="w-6 h-6 text-destructive" />
          </div>
          <p className="text-destructive font-medium text-lg">Ошибка подключения</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!memoizedToken || !serverUrl) {
    return null;
  }

  return (
    <LKRoom
      key={`lk-instance-${lkInstanceKey}`}
      serverUrl={serverUrl}
      token={memoizedToken}
      connect={true}
      // Desktop: mic on by default, camera off by default.
      // Mobile Safari: we start mic on the FIRST user interaction (gesture requirement), without any extra button.
      audio={!isMobileDevice}
      video={false}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleRoomError}
      options={roomOptions}
      style={{ height: "100%" }}
    >
      <LayoutContextProvider>
        <LiveKitContent
          onParticipantJoined={onParticipantJoined}
          onParticipantLeft={onParticipantLeft}
          onRoomReady={onRoomReady}
          headerButtons={headerButtons}
          roomDisplayName={roomDisplayName}
          onMinimize={onMinimize}
          participantName={participantName}
          connectionIndicator={connectionIndicator}
          isMaximizing={isMaximizing}
          onNegotiationError={handleNegotiationError}
          isIOSSafeMode={isIOSSafeMode}
          roomName={roomName}
          isMobileDevice={isMobileDevice}
        />
      </LayoutContextProvider>
    </LKRoom>
  );
}

interface LiveKitContentProps {
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onRoomReady?: (room: Room) => void;
  headerButtons?: React.ReactNode;
  roomDisplayName?: string;
  onMinimize?: () => void;
  participantName: string;
  connectionIndicator?: React.ReactNode;
  isMaximizing?: boolean;
  onNegotiationError?: (error: any) => void;
  isIOSSafeMode: boolean;
  roomName: string;
  /** MOBILE FIX: When true, media was not auto-started and user needs to tap to enable */
  isMobileDevice?: boolean;
}

function LiveKitContent({ 
  onParticipantJoined, 
  onParticipantLeft, 
  onRoomReady,
  headerButtons,
  roomDisplayName,
  onMinimize,
  participantName,
  connectionIndicator,
  isMaximizing = false,
  onNegotiationError,
  isIOSSafeMode,
  roomName,
  isMobileDevice = false,
}: LiveKitContentProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [newParticipants, setNewParticipants] = useState<Set<string>>(new Set());
  const roomReadyCalledRef = useRef(false);
  
  // Get reconnection state from context
  const { isRoomReconnecting, setIsRoomReconnecting } = useActiveCall();
  
  // Initialize diagnostics hook
  const diagnostics = useCallDiagnostics({
    room,
    roomName,
    participantName,
  });
  
  // Audio playback permission - handles browser autoplay blocking
  const { mergedProps: startAudioProps, canPlayAudio } = useStartAudio({ room, props: {} });
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  // MOBILE STABILITY: iOS/Safari requires getUserMedia to be triggered by a user gesture.
  // We auto-start ONLY the microphone on the first touch/click anywhere.
  // Camera must be enabled explicitly by the user (and is captured in the camera button handler).
  const autoStartMobileMicRef = useRef(false);

  useEffect(() => {
    if (!isMobileDevice) return;
    if (!room || !localParticipant) return;

    const onFirstInteraction = async () => {
      if (autoStartMobileMicRef.current) return;

      // Ignore early taps while the room is still connecting.
      // We keep the listener active so the next gesture (after connect) will work.
      if (room.state !== ConnectionState.Connected) return;

      autoStartMobileMicRef.current = true;
      console.log('[LiveKitRoom] Mobile: First user gesture detected - capturing microphone');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });

        const audioTrack = stream.getAudioTracks()[0];

        // Publish audio (unmuted)
        if (audioTrack) {
          await localParticipant.publishTrack(audioTrack, { source: Track.Source.Microphone });
          console.log('[LiveKitRoom] Mobile: Microphone published');
        }

        // Remote audio playback
        try {
          await room.startAudio();
        } catch {
          // handled by showAudioPrompt logic
        }

        // Stop listening after successful capture
        document.removeEventListener('touchstart', onFirstInteraction as any);
        document.removeEventListener('click', onFirstInteraction as any);
      } catch (err: any) {
        console.warn('[LiveKitRoom] Mobile: auto-start mic failed:', err);
        autoStartMobileMicRef.current = false;
        // If user denied permission, we'll show error when they try to toggle
      }
    };

    // Use both, because iOS can be picky about which one fires first.
    document.addEventListener('touchstart', onFirstInteraction as any);
    document.addEventListener('click', onFirstInteraction as any);

    return () => {
      document.removeEventListener('touchstart', onFirstInteraction as any);
      document.removeEventListener('click', onFirstInteraction as any);
    };
  }, [isMobileDevice, room, localParticipant]);

  // Show audio prompt when audio is blocked
  useEffect(() => {
    if (canPlayAudio === false) {
      setShowAudioPrompt(true);
      console.log('[LiveKitRoom] Audio blocked by browser, showing prompt');
    } else if (canPlayAudio === true) {
      setShowAudioPrompt(false);
    }
  }, [canPlayAudio]);
  
  // Try to start audio automatically when room connects
  useEffect(() => {
    if (room && canPlayAudio === false) {
      // Attempt to start audio on any user interaction
      const handleInteraction = async () => {
        try {
          await room.startAudio();
          console.log('[LiveKitRoom] Audio started after user interaction');
          setShowAudioPrompt(false);
        } catch (err) {
          console.log('[LiveKitRoom] Could not auto-start audio:', err);
        }
      };
      
      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });
      
      return () => {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
      };
    }
  }, [room, canPlayAudio]);
  
  // Raise hand hook
  const { isHandRaised, raisedHands, toggleHand } = useRaiseHand(room, participantName);
  
  // Noise suppression hook
  const { isEnabled: isNoiseSuppressionEnabled, toggle: toggleNoiseSuppression } = useNoiseSuppression();
  
  // Voice notifications hook
  const { announceHandRaised, announceParticipantJoined, announceParticipantLeft } = useVoiceNotifications();
  
  // Auto-hide panels state
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showDrawingOverlay, setShowDrawingOverlay] = useState(false);
  // Issue 5: Refs for stable data handler closure (prevents reconnection on whiteboard toggle)
  const showWhiteboardRef = useRef(false);
  const showDrawingOverlayRef = useRef(false);
  // Track if a remote participant has the whiteboard open (for mobile tile display)
  const [remoteWhiteboardSender, setRemoteWhiteboardSender] = useState<string | null>(null);
  const [currentBackground, setCurrentBackground] = useState<'none' | 'blur-light' | 'blur-strong' | 'image'>('none');
  const [isProcessingBackground, setIsProcessingBackground] = useState(false);
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false);
  
  // Layout mode: 'focus' (1-on-1), 'gallery' (grid), or 'webinar' (speaker + strip)
  // Default to gallery for grid view with connection quality indicators
  const [layoutMode, setLayoutMode] = useState<'focus' | 'gallery' | 'webinar'>('gallery');
  
  // Pinned participant identity
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  
  // Native browser PiP
  const { isPiPActive, isPiPSupported, togglePiP } = useNativePiP(room);
  
  // Mobile detection for touch handling and tooltip suppression
  const isMobile = useIsMobile();
  
  // Touch-to-show panels on mobile
  const lastTouchRef = useRef<number>(Date.now());
  
  // Track speaking participant for indicators
  const speakingParticipant = useMemo(() => undefined as string | undefined, []);
  
  // Track if gallery mode was suggested
  const galleryModeSuggestedRef = useRef(false);
  
  // Call recording state (records participants directly without picker dialog)
  const [isCallRecording, setIsCallRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const recordingDurationRef = useRef<NodeJS.Timeout | null>(null);
  const callRecorderRef = useRef<MediaRecorder | null>(null);
  const callRecordingChunksRef = useRef<Blob[]>([]);
  const callRecordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const callRecordingAnimationRef = useRef<number | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to room reconnection events
  useEffect(() => {
    if (!room) return;
    
    const handleReconnecting = () => {
      console.log('[LiveKitRoom] Reconnecting...');
      setIsRoomReconnecting(true);
      diagnostics.addEvent('RECONNECTING', roomName);
      toast.info("Переподключение...", {
        id: 'reconnecting',
        duration: 60000,
        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
      });
      // Send Telegram notification for reconnect event
      sendCallErrorToTelegram('RECONNECT', `Reconnecting in room ${roomName}`, { roomName, participant: participantName });
    };
    
    const handleReconnected = () => {
      console.log('[LiveKitRoom] Reconnected successfully');
      setIsRoomReconnecting(false);
      diagnostics.addEvent('RECONNECTED', roomName);
      toast.success("Связь восстановлена", {
        id: 'reconnecting',
        duration: 3000,
      });
    };
    
    const handleDisconnected = () => {
      console.log('[LiveKitRoom] Disconnected');
      setIsRoomReconnecting(false);
    };
    
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    
    return () => {
      room.off(RoomEvent.Reconnecting, handleReconnecting);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room, setIsRoomReconnecting, diagnostics, roomName, participantName]);

  // ====== ADAPTIVE BITRATE: Downgrade video quality on poor network ======
  const lastBitrateAdjustRef = useRef<number>(0);
  useEffect(() => {
    if (!room) return;

    const handleQualityChanged = (quality: ConnectionQuality, participant: any) => {
      if (!participant?.isLocal) return;
      const now = Date.now();
      // Throttle adjustments to max once per 10s
      if (now - lastBitrateAdjustRef.current < 10000) return;
      lastBitrateAdjustRef.current = now;

      const camPub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
      if (!camPub?.track || !camPub.track.mediaStreamTrack) return;

      const sender = camPub.track.sender;
      if (!sender) return;

      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) return;

      let targetMaxBitrate: number;
      switch (quality) {
        case ConnectionQuality.Poor:
          targetMaxBitrate = 150_000; // 150 kbps
          console.log('[LiveKitRoom] Adaptive bitrate: POOR network → 150kbps');
          toast.warning('Качество сети низкое', { description: 'Видео временно снижено', duration: 3000, id: 'adaptive-bitrate' });
          break;
        case ConnectionQuality.Good:
          targetMaxBitrate = 800_000; // 800 kbps
          console.log('[LiveKitRoom] Adaptive bitrate: GOOD network → 800kbps');
          break;
        case ConnectionQuality.Excellent:
          targetMaxBitrate = 2_500_000; // 2.5 Mbps
          console.log('[LiveKitRoom] Adaptive bitrate: EXCELLENT network → 2.5Mbps');
          break;
        default:
          return;
      }

      params.encodings[0].maxBitrate = targetMaxBitrate;
      sender.setParameters(params).catch(err => {
        console.warn('[LiveKitRoom] Failed to set adaptive bitrate:', err);
      });
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleQualityChanged);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handleQualityChanged); };
  }, [room]);

  // IMPORTANT: On mobile we publish tracks manually (gesture requirement), so `localParticipant.isMicrophoneEnabled`
  // may not reflect the real state. Use publication mute state instead.
  const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);
  const micPublication = localParticipant?.getTrackPublication(Track.Source.Microphone);

  const isCameraEnabled = isMobileDevice
    ? !!cameraPublication?.track && !cameraPublication.isMuted
    : (localParticipant?.isCameraEnabled ?? false);

  const isMicrophoneEnabled = isMobileDevice
    ? !!micPublication?.track && !micPublication.isMuted
    : (localParticipant?.isMicrophoneEnabled ?? false);

  const isScreenShareEnabled = localParticipant?.isScreenShareEnabled ?? false;

  // Check if there are remote participants (for self-view logic)
  const remoteParticipants = participants.filter(p => p.identity !== localParticipant?.identity);
  const hasRemoteParticipants = remoteParticipants.length > 0;
  const remoteParticipantCount = remoteParticipants.length;

  // Auto-switch to gallery for group calls (3+ participants)
  useEffect(() => {
    // Keep gallery mode for group calls
    if (remoteParticipantCount >= 2 && layoutMode === 'focus') {
      setLayoutMode('gallery');
    }
  }, [remoteParticipantCount, layoutMode]);

  // Suggest gallery mode only for real group calls (3+ total participants)
  useEffect(() => {
    // remoteParticipantCount >= 2 => total participants >= 3
    if (remoteParticipantCount >= 2 && !galleryModeSuggestedRef.current) {
      galleryModeSuggestedRef.current = true;
      toast.info('Групповой звонок', {
        description: 'Для 3+ участников удобнее «Галерея» или «Вебинар» (можно переключить в меню раскладки)',
        duration: 3500,
      });
    }
    if (remoteParticipantCount < 2) {
      galleryModeSuggestedRef.current = false;
    }
  }, [remoteParticipantCount]);
  
  // Toggle layout mode (cycle through all 3)
  const toggleLayoutMode = useCallback(() => {
    setLayoutMode(prev => {
      const modes: Array<'focus' | 'gallery' | 'webinar'> = ['focus', 'gallery', 'webinar'];
      const currentIndex = modes.indexOf(prev);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      const modeNames = { focus: 'Фокус-режим', gallery: 'Галерейный режим', webinar: 'Вебинар-режим' };
      const modeDescs = { 
        focus: 'Один участник на весь экран', 
        gallery: 'Все участники в сетке',
        webinar: 'Спикер + лента зрителей'
      };
      toast.success(modeNames[nextMode], {
        description: modeDescs[nextMode],
        duration: 2000,
      });
      return nextMode;
    });
  }, []);
  
  // Pin participant handler
  const handlePinParticipant = useCallback((identity: string | null) => {
    setPinnedParticipant(prev => {
      const newValue = prev === identity ? null : identity;
      if (newValue) {
        toast.success('Участник закреплен', {
          description: 'Будет показан на главном экране',
          duration: 2000,
        });
      } else {
        toast.info('Закрепление снято', { duration: 1500 });
      }
      return newValue;
    });
  }, []);
  
  // Issue 4 FIX: Single merged screen share layout effect with 500ms debounce
  // Prevents flicker from rapid layout toggles when screen share starts/stops
  const screenShareDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Check if anyone is screen sharing (remote or local)
    const someoneScreenSharing = participants.some(p => {
      const tracks = p.getTrackPublications();
      return Array.from(tracks.values()).some(t => t.source === Track.Source.ScreenShare && t.isSubscribed);
    }) || isScreenShareEnabled;
    
    const wasScreenSharing = prevScreenShareRef.current;
    prevScreenShareRef.current = someoneScreenSharing;
    
    // Clear pending debounce
    if (screenShareDebounceRef.current) {
      clearTimeout(screenShareDebounceRef.current);
      screenShareDebounceRef.current = null;
    }
    
    if (someoneScreenSharing && !wasScreenSharing) {
      // Screen share STARTED — debounce 500ms to prevent flicker from brief share attempts
      screenShareDebounceRef.current = setTimeout(() => {
        if (layoutMode !== 'focus') {
          setLayoutMode('focus');
          toast.info('Фокус-режим', {
            description: 'Автоматическое переключение для демонстрации экрана',
            duration: 2000,
          });
        }
      }, 500);
    } else if (!someoneScreenSharing && wasScreenSharing && layoutMode === 'focus') {
      // Screen share ENDED — return to gallery
      setLayoutMode('gallery');
      toast.info('Галерея', {
        description: 'Демонстрация завершена',
        duration: 2000,
      });
    }
    
    return () => {
      if (screenShareDebounceRef.current) {
        clearTimeout(screenShareDebounceRef.current);
      }
    };
  }, [participants, isScreenShareEnabled, layoutMode]);
  
  // Track active speaker (keep the handler in a separate effect)
  const [speakingParticipantState, setSpeakingParticipant] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (!room) return;
    
    const handleActiveSpeakerChange = (speakers: any[]) => {
      if (speakers.length > 0) {
        setSpeakingParticipant(speakers[0].identity);
      } else {
        setSpeakingParticipant(undefined);
      }
    };
    
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakerChange);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakerChange);
    };
  }, [room]);
  
  // Issue 5: Sync refs for stable closure access in data handler
  useEffect(() => { showWhiteboardRef.current = showWhiteboard; }, [showWhiteboard]);
  useEffect(() => { showDrawingOverlayRef.current = showDrawingOverlay; }, [showDrawingOverlay]);

  // Listen for whiteboard/drawing overlay open events from other participants
  // Issue 5 FIX: Uses refs instead of state to prevent handler re-registration on toggle
  useEffect(() => {
    if (!room) return;
    
    const handleRemoteWhiteboardEvents = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        
        // Auto-open whiteboard when another participant opens it
        if (message.type === 'WHITEBOARD_OPEN' && message.sender !== participantName) {
          setRemoteWhiteboardSender(message.sender);
          if (!isMobile && !showWhiteboardRef.current) {
            // Desktop: auto-open whiteboard
            setShowWhiteboard(true);
            toast.info(`${message.sender} открыл доску`, {
              description: 'Нажмите, чтобы рисовать вместе',
              duration: 3000,
            });
          } else if (isMobile) {
            // Mobile: show tile notification only
            toast.info(`${message.sender} открыл доску`, {
              description: 'Нажмите на плитку "Доска" для просмотра',
              duration: 3000,
            });
          }
        }
        
        // Drawing overlay is personal — only notify
        if (message.type === 'DRAWING_OVERLAY_OPEN' && message.sender !== participantName) {
          console.log('[LiveKitRoom] Remote participant opened drawing overlay (local-only):', message.sender);
          toast.info(`${message.sender} рисует на экране`, {
            description: 'Рисунки видны всем участникам',
            duration: 3000,
          });
        }
        
        // Close whiteboard when all participants close it
        if (message.type === 'WHITEBOARD_CLOSE' && message.sender !== participantName) {
          setRemoteWhiteboardSender(null);
          console.log('[LiveKitRoom] Remote participant closed whiteboard:', message.sender);
        }
        
        if (message.type === 'DRAWING_OVERLAY_CLOSE' && message.sender !== participantName) {
          console.log('[LiveKitRoom] Remote participant closed drawing overlay:', message.sender);
        }
      } catch {
        // Not a whiteboard/overlay message
      }
    };
    
    room.on(RoomEvent.DataReceived, handleRemoteWhiteboardEvents);
    return () => {
      room.off(RoomEvent.DataReceived, handleRemoteWhiteboardEvents);
    };
  }, [room, participantName, isMobile]); // Issue 5: Removed showWhiteboard, showDrawingOverlay from deps

  // Notify parent when room is ready and try to enable audio proactively
  useEffect(() => {
    if (room && onRoomReady && !roomReadyCalledRef.current) {
      roomReadyCalledRef.current = true;
      onRoomReady(room);
      
      // Proactively try to start audio when room connects
      // This will work if user has already interacted with the page
      room.startAudio().then(() => {
        console.log('[LiveKitRoom] Audio started on room ready');
        setShowAudioPrompt(false);
      }).catch(() => {
        // Expected to fail if no user interaction yet - that's ok
        console.log('[LiveKitRoom] Audio start on ready failed (expected if no interaction)');
      });
    }
  }, [room, onRoomReady]);

  // Hide onboarding after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowOnboarding(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide panels after 3 seconds of inactivity
  useEffect(() => {
    const startHideTimer = () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowTopPanel(false);
        setShowBottomPanel(false);
      }, 3000);
    };

    startHideTimer();

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse movement for panel visibility (desktop)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Skip mouse handling on mobile - use touch instead
    if (isMobile) return;

    // Behave like a finger tap: any activity shows both panels
    setShowTopPanel(true);
    setShowBottomPanel(true);

    // Reset hide timer on any movement
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowTopPanel(false);
      setShowBottomPanel(false);
    }, 3000);
  }, [isMobile]);

  // Show panels immediately when cursor enters the call area (desktop)
  const handleMouseEnter = useCallback(() => {
    if (isMobile) return;
    setShowTopPanel(true);
    setShowBottomPanel(true);
  }, [isMobile]);

  // Handle click to show panels (works like finger tap on desktop too)
  const handleClick = useCallback(() => {
    // Show both panels on click
    setShowTopPanel(true);
    setShowBottomPanel(true);
    lastTouchRef.current = Date.now();
    
    // Auto-hide after 4 seconds
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastTouchRef.current >= 4000) {
        setShowTopPanel(false);
        setShowBottomPanel(false);
      }
    }, 4000);
  }, []);

  // Touch handler for mobile - tap to show/hide panels
  const handleTouchStart = useCallback(() => {
    // Show panels on touch
    setShowTopPanel(true);
    setShowBottomPanel(true);
    lastTouchRef.current = Date.now();
    
    // Auto-hide after 4 seconds
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastTouchRef.current >= 4000) {
        setShowTopPanel(false);
        setShowBottomPanel(false);
      }
    }, 4000);
  }, []);

  // Track media toggle lock to prevent NegotiationError on iOS
  const isTogglingMediaRef = useRef(false);
  const toggleLockTimerRef = useRef<NodeJS.Timeout | null>(null);
  // iOS needs longer lock duration to prevent race conditions during SDP negotiation
  const isIOSSafeModeLocal = useMemo(() => detectIsIOSOrMobileSafari(), []);
  const TOGGLE_LOCK_DURATION_MS = isIOSSafeModeLocal ? 2000 : 800;
  
  // Safety: reset stuck toggle lock after max 3 seconds
  const releaseToggleLock = useCallback(() => {
    if (toggleLockTimerRef.current) clearTimeout(toggleLockTimerRef.current);
    toggleLockTimerRef.current = setTimeout(() => {
      if (isTogglingMediaRef.current) {
        console.warn('[LiveKitRoom] Toggle lock was stuck, releasing');
        isTogglingMediaRef.current = false;
      }
    }, 3000);
  }, []);

  // iOS Safe Mode detection for this component
  const isIOSSafeModeLive = useMemo(() => detectIsIOSOrMobileSafari(), []);

  // Mobile detection for toggle functions
  const isMobileToggle = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Toggle camera with iOS-safe mute/unmute approach
  // MOBILE FIX: On mobile, request getUserMedia directly in click handler to preserve gesture context
  const toggleCamera = useCallback(async () => {
    // Block if reconnecting
    if (isRoomReconnecting) {
      console.log('[LiveKitRoom] Reconnecting, skipping camera toggle');
      toast.info("Подождите завершения переподключения");
      return;
    }
    if (isTogglingMediaRef.current) {
      console.log('[LiveKitRoom] Media toggle in progress, skipping camera toggle');
      return;
    }
    
    try {
      isTogglingMediaRef.current = true;
      releaseToggleLock(); // Safety: auto-release if stuck
      diagnostics.addEvent('TOGGLE_CAMERA', 'start');
      
      const cameraPublication = localParticipant?.getTrackPublication(Track.Source.Camera);

      if (isMobileToggle) {
        // Mobile: keep a single published camera track; toggle via mute/unmute to avoid renegotiation.
        if (cameraPublication?.track) {
          if (cameraPublication.isMuted) {
            await cameraPublication.unmute();
            console.log('[LiveKitRoom] Mobile: Camera unmuted');
          } else {
            await cameraPublication.mute();
            console.log('[LiveKitRoom] Mobile: Camera muted');
          }
          diagnostics.logMediaToggle('camera', true, 'mute-toggle');
          return;
        }

        // First-time enable: capture + publish INSIDE the button tap gesture.
        try {
          console.log('[LiveKitRoom] Mobile: Capturing camera in gesture and publishing track...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: isIOSSafeModeLive ? 960 : 1280 },
              height: { ideal: isIOSSafeModeLive ? 540 : 720 },
              frameRate: { ideal: isIOSSafeModeLive ? 20 : 24 },
            },
            audio: false,
          });
          const videoTrack = stream.getVideoTracks()[0];
          if (!videoTrack) throw new Error('no video track');

          const pub = await localParticipant?.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            simulcast: false,
            // IMPORTANT: do NOT force VP8/VP9 here; let the SDK choose a Safari-compatible codec (often H264).
          });

          if (pub?.isMuted) await pub.unmute();
          diagnostics.logMediaToggle('camera', true, 'publishTrack');
          return;
        } catch (permErr: any) {
          console.error('[LiveKitRoom] Mobile: Camera capture/publish failed:', permErr);
          diagnostics.logMediaToggle('camera', false, `publish failed: ${permErr?.message}`);
          if (permErr?.name === 'NotAllowedError') {
            toast.error('Доступ к камере запрещён', {
              description: 'Разрешите доступ в настройках браузера',
            });
          } else {
            toast.error('Ошибка камеры', { description: permErr?.message || 'Попробуйте ещё раз' });
          }
          return;
        }
      }

      // Desktop: prefer mute/unmute if track already published (prevents NegotiationError)
      if (cameraPublication?.track) {
        if (cameraPublication.isMuted) {
          await cameraPublication.unmute();
          console.log('[LiveKitRoom] Desktop: Camera unmuted (mute/unmute)');
        } else {
          await cameraPublication.mute();
          console.log('[LiveKitRoom] Desktop: Camera muted (mute/unmute)');
        }
        diagnostics.logMediaToggle('camera', true, 'mute-toggle');
      } else {
        // First-time enable: use setCameraEnabled to create the track
        const currentState = localParticipant?.isCameraEnabled ?? false;
        await localParticipant?.setCameraEnabled(!currentState);
        diagnostics.logMediaToggle('camera', true, 'setCameraEnabled');
      }
    } catch (err: any) {
      diagnostics.logMediaToggle('camera', false, err?.message);
      
      // NegotiationError (code 13)
      if (err?.code === 13 || err?.name === 'NegotiationError') {
        console.warn('[LiveKitRoom] NegotiationError on camera toggle');
        onNegotiationError?.(err);
        
        // Don't retry with setCameraEnabled — it causes the same error.
        // Instead, wait for connection to stabilize and let the user try again.
        toast.warning('Подождите несколько секунд и попробуйте снова', {
          description: 'Соединение стабилизируется',
          duration: 4000,
        });
      } else {
        console.error('Failed to toggle camera:', err);
        toast.error('Ошибка камеры');
      }
    } finally {
      setTimeout(() => { isTogglingMediaRef.current = false; }, TOGGLE_LOCK_DURATION_MS);
    }
  }, [localParticipant, isRoomReconnecting, onNegotiationError, isIOSSafeModeLive, diagnostics, isMobileToggle, releaseToggleLock]);

  // Toggle microphone with iOS-safe mute/unmute approach
  // MOBILE FIX: On mobile, request getUserMedia directly in click handler to preserve gesture context
  const toggleMicrophone = useCallback(async () => {
    // Block if reconnecting
    if (isRoomReconnecting) {
      console.log('[LiveKitRoom] Reconnecting, skipping mic toggle');
      toast.info("Подождите завершения переподключения");
      return;
    }
    if (isTogglingMediaRef.current) {
      console.log('[LiveKitRoom] Media toggle in progress, skipping mic toggle');
      return;
    }
    
    try {
      isTogglingMediaRef.current = true;
      releaseToggleLock(); // Safety: auto-release if stuck
      diagnostics.addEvent('TOGGLE_MIC', 'start');
      
      const micPublication = localParticipant?.getTrackPublication(Track.Source.Microphone);

      if (isMobileToggle) {
        // Mobile: keep a single published mic track; toggle via mute/unmute to avoid renegotiation.
        if (micPublication?.track) {
          if (micPublication.isMuted) {
            await micPublication.unmute();
            console.log('[LiveKitRoom] Mobile: Microphone unmuted');
          } else {
            await micPublication.mute();
            console.log('[LiveKitRoom] Mobile: Microphone muted');
          }
          diagnostics.logMediaToggle('microphone', true, 'mute-toggle');
          return;
        }

        // If the mic wasn't captured yet (first gesture missed / permission prompt), capture+publish in this tap.
        try {
          console.log('[LiveKitRoom] Mobile: Capturing microphone in gesture and publishing track...');
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          const audioTrack = stream.getAudioTracks()[0];
          if (!audioTrack) throw new Error('no audio track');

          const pub = await localParticipant?.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
          });
          if (pub?.isMuted) await pub.unmute();

          diagnostics.logMediaToggle('microphone', true, 'publishTrack');
          return;
        } catch (permErr: any) {
          console.error('[LiveKitRoom] Mobile: Microphone capture/publish failed:', permErr);
          diagnostics.logMediaToggle('microphone', false, `publish failed: ${permErr?.message}`);
          if (permErr?.name === 'NotAllowedError') {
            toast.error('Доступ к микрофону запрещён', {
              description: 'Разрешите доступ в настройках браузера',
            });
          } else {
            toast.error('Ошибка микрофона', { description: permErr?.message || 'Попробуйте ещё раз' });
          }
          return;
        }
      }

      // Desktop: prefer mute/unmute if track already published (prevents NegotiationError)
      if (micPublication?.track) {
        if (micPublication.isMuted) {
          await micPublication.unmute();
          console.log('[LiveKitRoom] Desktop: Microphone unmuted (mute/unmute)');
        } else {
          await micPublication.mute();
          console.log('[LiveKitRoom] Desktop: Microphone muted (mute/unmute)');
        }
        diagnostics.logMediaToggle('microphone', true, 'mute-toggle');
      } else {
        // First-time enable: use setMicrophoneEnabled to create the track
        const currentState = localParticipant?.isMicrophoneEnabled ?? false;
        await localParticipant?.setMicrophoneEnabled(!currentState);
        diagnostics.logMediaToggle('microphone', true, 'setMicrophoneEnabled');
      }
    } catch (err: any) {
      diagnostics.logMediaToggle('microphone', false, err?.message);
      
      // NegotiationError (code 13)
      if (err?.code === 13 || err?.name === 'NegotiationError') {
        console.warn('[LiveKitRoom] NegotiationError on mic toggle');
        onNegotiationError?.(err);
        
        // Don't retry with setMicrophoneEnabled — it causes the same error.
        toast.warning('Подождите несколько секунд и попробуйте снова', {
          description: 'Соединение стабилизируется',
          duration: 4000,
        });
      } else {
        console.error('Failed to toggle microphone:', err);
        toast.error('Ошибка микрофона');
      }
    } finally {
      setTimeout(() => { isTogglingMediaRef.current = false; }, TOGGLE_LOCK_DURATION_MS);
    }
  }, [localParticipant, isRoomReconnecting, onNegotiationError, isIOSSafeModeLive, diagnostics, isMobileToggle, releaseToggleLock]);

  // Toggle screen share with lock
  const toggleScreenShare = useCallback(async () => {
    // Block if reconnecting
    if (isRoomReconnecting) {
      console.log('[LiveKitRoom] Reconnecting, skipping screen share toggle');
      toast.info("Подождите завершения переподключения");
      return;
    }
    if (isTogglingMediaRef.current) {
      console.log('[LiveKitRoom] Media toggle in progress, skipping screen share toggle');
      return;
    }
    try {
      isTogglingMediaRef.current = true;
      const currentState = localParticipant?.isScreenShareEnabled ?? false;
      await localParticipant?.setScreenShareEnabled(!currentState);
    } catch (err: any) {
      // Handle user cancellation (not an error - user just closed the picker)
      if (err?.name === 'NotAllowedError' || err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        console.log('[LiveKitRoom] Screen share cancelled by user');
        return; // Silent exit, not an error
      }
      
      // Handle security/permission errors
      if (err?.name === 'SecurityError' || err?.message?.includes('permission')) {
        console.warn('[LiveKitRoom] Screen share blocked by browser security policy');
        toast.error('Демонстрация экрана заблокирована', { 
          description: 'Проверьте разрешения браузера'
        });
        return;
      }
      
      if ((err?.code === 13 || err?.name === 'NegotiationError') && !isRoomReconnecting) {
        console.warn('[LiveKitRoom] NegotiationError on screen share, retrying...');
        onNegotiationError?.(err);
        await new Promise(r => setTimeout(r, 600));
        try {
          const currentState = localParticipant?.isScreenShareEnabled ?? false;
          await localParticipant?.setScreenShareEnabled(!currentState);
        } catch (retryErr) {
          console.error('Failed to toggle screen share after retry:', retryErr);
          toast.error('Не удалось включить демонстрацию экрана');
        }
      } else {
        // Log with more details for debugging
        console.error('Failed to toggle screen share:', {
          name: err?.name,
          message: err?.message,
          code: err?.code,
          stack: err?.stack
        });
        toast.error('Ошибка демонстрации экрана', {
          description: err?.message || 'Попробуйте ещё раз'
        });
      }
    } finally {
      setTimeout(() => { isTogglingMediaRef.current = false; }, TOGGLE_LOCK_DURATION_MS);
    }
  }, [localParticipant, isRoomReconnecting, onNegotiationError]);

  // Voice commands hook - must be after toggle functions are defined
  const { isListening: isVoiceCommandsActive, toggleListening: toggleVoiceCommands, isSupported: voiceCommandsSupported } = useVoiceCommands({
    onMuteToggle: toggleMicrophone,
    onCameraToggle: toggleCamera,
    onRaiseHand: toggleHand,
    onScreenShare: toggleScreenShare,
    onLeave: () => {},
    enabled: true,
  });
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleMic: toggleMicrophone,
    onToggleCamera: toggleCamera,
    onToggleLayoutMode: toggleLayoutMode,
    onRaiseHand: toggleHand,
    onToggleChat: () => setShowChat(prev => !prev),
    onPinParticipant: () => {
      // Pin/unpin the first remote participant (basic implementation)
      const firstRemote = remoteParticipants[0];
      if (firstRemote) {
        handlePinParticipant(pinnedParticipant === firstRemote.identity ? null : firstRemote.identity);
      }
    },
    onTogglePiP: isPiPSupported ? togglePiP : undefined,
    enabled: true,
  });

  // Virtual background handlers
  const applyBlurBackground = useCallback(async (intensity: number) => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        const processor = BackgroundBlur(intensity);
        await track.setProcessor(processor);
        setCurrentBackground(intensity <= 5 ? 'blur-light' : 'blur-strong');
      }
    } catch (err) {
      console.error('Failed to apply blur background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  const applyImageBackground = useCallback(async (imageUrl: string) => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        const processor = VirtualBackground(imageUrl);
        await track.setProcessor(processor);
        setCurrentBackground('image');
      }
    } catch (err) {
      console.error('Failed to apply image background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  const removeBackground = useCallback(async () => {
    try {
      setIsProcessingBackground(true);
      const track = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
      if (track) {
        await track.stopProcessor();
        setCurrentBackground('none');
      }
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setIsProcessingBackground(false);
    }
  }, [localParticipant]);

  // Format recording duration
  const formatRecordingDuration = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Toggle call recording - records participants + drawings via canvas
  const toggleCallRecording = useCallback(async () => {
    if (isCallRecording) {
      // Stop recording
      if (callRecorderRef.current) {
        callRecorderRef.current.stop();
        callRecorderRef.current = null;
      }
      if (callRecordingAnimationRef.current) {
        clearTimeout(callRecordingAnimationRef.current); // Issue 7: Changed from cancelAnimationFrame
        callRecordingAnimationRef.current = null;
      }
      if (callRecordingCanvasRef.current) {
        callRecordingCanvasRef.current = null;
      }
      if (recordingDurationRef.current) {
        clearInterval(recordingDurationRef.current);
        recordingDurationRef.current = null;
      }
      if (recordingAudioContextRef.current) {
        recordingAudioContextRef.current.close().catch(() => {});
        recordingAudioContextRef.current = null;
      }
      setIsCallRecording(false);
      return;
    }
    
    try {
      // Find all video elements in the call
      const videoElements = containerRef.current?.querySelectorAll('video') ?? [];
      if (videoElements.length === 0) {
        toast.error('Нет видео для записи');
        return;
      }
      
      // Create canvas to composite all videos + drawings
      // Issue 7 FIX: Reduced resolution from 1920x1080 to 1280x720
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d')!;
      callRecordingCanvasRef.current = canvas;
      
      // Issue 7 FIX: Throttled to 15fps using setTimeout instead of rAF at 60fps
      let isActive = true;
      const DRAW_INTERVAL_MS = 1000 / 15; // ~66ms per frame
      
      const drawFrame = () => {
        if (!isActive) return;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const videos = Array.from(containerRef.current?.querySelectorAll('video') ?? []) as HTMLVideoElement[];
        const count = videos.length;
        
        if (count === 1) {
          ctx.drawImage(videos[0], 0, 0, canvas.width, canvas.height);
        } else if (count === 2) {
          const halfW = canvas.width / 2;
          ctx.drawImage(videos[0], 0, 0, halfW, canvas.height);
          ctx.drawImage(videos[1], halfW, 0, halfW, canvas.height);
        } else if (count <= 4) {
          const halfW = canvas.width / 2;
          const halfH = canvas.height / 2;
          videos.forEach((video, i) => {
            const x = (i % 2) * halfW;
            const y = Math.floor(i / 2) * halfH;
            ctx.drawImage(video, x, y, halfW, halfH);
          });
        } else {
          const thirdW = canvas.width / 3;
          const thirdH = canvas.height / 3;
          videos.slice(0, 9).forEach((video, i) => {
            const x = (i % 3) * thirdW;
            const y = Math.floor(i / 3) * thirdH;
            ctx.drawImage(video, x, y, thirdW, thirdH);
          });
        }
        
        // OVERLAY: Draw the DrawingOverlay canvas if active
        if (drawingCanvasRef.current && showDrawingOverlay) {
          ctx.drawImage(drawingCanvasRef.current, 0, 0, canvas.width, canvas.height);
        }
        
        // Issue 7: setTimeout at 15fps instead of requestAnimationFrame at 60fps
        callRecordingAnimationRef.current = setTimeout(drawFrame, DRAW_INTERVAL_MS) as unknown as number;
      };
      
      drawFrame();
      
      // Issue 7: Capture at 15fps instead of 30fps
      const stream = canvas.captureStream(15);
      
      // Create AudioContext to mix all audio sources
      const audioContext = new AudioContext();
      recordingAudioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();
      
      // Collect audio from all video elements
      videoElements.forEach(video => {
        try {
          if ((video as HTMLVideoElement).srcObject instanceof MediaStream) {
            const mediaStream = (video as HTMLVideoElement).srcObject as MediaStream;
            const audioTracks = mediaStream.getAudioTracks();
            if (audioTracks.length > 0) {
              const source = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
              source.connect(destination);
            }
          }
        } catch {
          // Ignore cross-origin or unavailable audio
        }
      });
      
      // Try to add local microphone audio
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      } catch {
        console.log('[LiveKitRoom] Could not access local mic for recording');
      }
      
      // Merge audio into stream if available
      destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      
      // Create recorder with best available codec
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm'
      });
      
      callRecordingChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          callRecordingChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        isActive = false;
        
        const blob = new Blob(callRecordingChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Show preview instead of auto-download
        setRecordingPreviewUrl(url);
        
        toast.success('Запись готова!', {
          description: 'Просмотрите и сохраните видео',
        });
      };
      
      recorder.start(100);
      callRecorderRef.current = recorder;
      setIsCallRecording(true);
      setRecordingDuration(0);
      
      // Start duration timer
      recordingDurationRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      toast.success('Запись началась');
      
    } catch (err) {
      console.error('Failed to start call recording:', err);
      toast.error('Не удалось начать запись');
    }
  }, [isCallRecording, showDrawingOverlay]);

  // Convert to MP4 state
  const [isConvertingToMp4, setIsConvertingToMp4] = useState(false);

  // Save recording from preview
  const saveRecording = useCallback(() => {
    if (!recordingPreviewUrl) return;
    
    const a = document.createElement('a');
    a.href = recordingPreviewUrl;
    a.download = `aplink-call-${Date.now()}.webm`;
    a.click();
    
    URL.revokeObjectURL(recordingPreviewUrl);
    setRecordingPreviewUrl(null);
    setRecordingDuration(0);
    toast.success('Запись сохранена!');
  }, [recordingPreviewUrl]);

  // Convert and save as MP4
  const saveRecordingAsMp4 = useCallback(async () => {
    if (!recordingPreviewUrl) return;
    
    setIsConvertingToMp4(true);
    
    try {
      // Fetch the blob from the preview URL
      const response = await fetch(recordingPreviewUrl);
      const blob = await response.blob();
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      
      toast.loading('Конвертация в MP4...', { id: 'mp4-convert' });
      
      const { data, error } = await supabase.functions.invoke('convert-to-mp4', {
        body: formData,
      });
      
      if (error) {
        // Check if it's a configuration issue
        if (error.message?.includes('not configured') || error.message?.includes('503')) {
          toast.error('Конвертация MP4 недоступна', {
            id: 'mp4-convert',
            description: 'Сервис не настроен. Сохраните в WebM формате.',
          });
          return;
        }
        throw error;
      }
      
      // If we got back JSON with error, handle it
      if (data && typeof data === 'object' && 'error' in data) {
        toast.error('Ошибка конвертации', {
          id: 'mp4-convert',
          description: data.message || data.error,
        });
        return;
      }
      
      // Success - download the MP4
      const mp4Blob = new Blob([data], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);
      
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `aplink-call-${Date.now()}.mp4`;
      a.click();
      
      URL.revokeObjectURL(mp4Url);
      URL.revokeObjectURL(recordingPreviewUrl);
      setRecordingPreviewUrl(null);
      setRecordingDuration(0);
      
      toast.success('MP4 сохранён!', { id: 'mp4-convert' });
      
    } catch (err) {
      console.error('MP4 conversion failed:', err);
      toast.error('Не удалось конвертировать в MP4', {
        id: 'mp4-convert',
        description: 'Попробуйте сохранить в WebM формате',
      });
    } finally {
      setIsConvertingToMp4(false);
    }
  }, [recordingPreviewUrl]);

  // Discard recording preview
  const discardRecording = useCallback(() => {
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl);
      setRecordingPreviewUrl(null);
      setRecordingDuration(0);
      toast.info('Запись отменена');
    }
  }, [recordingPreviewUrl]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Screenshot detection with shutter sound
  useEffect(() => {
    const playShutterSound = () => {
      const shutterSound = new Audio('/audio/camera-shutter.mp3');
      shutterSound.volume = 0.4;
      shutterSound.play().catch(() => {});
    };

    const triggerFlash = () => {
      setShowScreenshotFlash(true);
      playShutterSound();
      
      // Notify other participants
      if (room) {
        const message = {
          type: 'SCREENSHOT_TAKEN',
          participantName,
          participantIdentity: localParticipant?.identity,
        };
        room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(message)),
          { reliable: true }
        );
      }
      
      setTimeout(() => setShowScreenshotFlash(false), 350);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen on Windows/Linux
      if (e.key === 'PrintScreen') {
        triggerFlash();
      }
      // Cmd+Shift+3 or Cmd+Shift+4 on Mac
      if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4')) {
        triggerFlash();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room, participantName, localParticipant]);

  // Listen for raise hand events for voice notifications + screenshot notifications
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        if (message.type === 'RAISE_HAND' && message.raised && message.participantIdentity !== localParticipant?.identity) {
          announceHandRaised(message.participantName);
        }
        // Screenshot notification from another participant
        if (message.type === 'SCREENSHOT_TAKEN' && message.participantIdentity !== localParticipant?.identity) {
          setShowScreenshotFlash(true);
          // Play shutter sound for remote screenshot too
          const shutterSound = new Audio('/audio/camera-shutter.mp3');
          shutterSound.volume = 0.35;
          shutterSound.play().catch(() => {});
          toast.info(`📸 ${message.participantName} сделал скриншот`);
          setTimeout(() => setShowScreenshotFlash(false), 350);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, announceHandRaised, localParticipant]);

  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      console.log("[LiveKitRoom] Participant joined:", participant.identity, participant.name);
      
      // Add to new participants for animation
      setNewParticipants(prev => new Set(prev).add(participant.identity));
      
      // Voice notification
      announceParticipantJoined(participant.name || participant.identity);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        setNewParticipants(prev => {
          const next = new Set(prev);
          next.delete(participant.identity);
          return next;
        });
      }, 500);
      
      onParticipantJoined?.(participant.identity, participant.name || participant.identity);
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      console.log("[LiveKitRoom] Participant left:", participant.identity);
      announceParticipantLeft(participant.name || participant.identity);
      onParticipantLeft?.(participant.identity);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    
    // Log audio track status for debugging
    const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
      if (track.kind === 'audio') {
        console.log('[LiveKitRoom] Audio track subscribed:', {
          participant: participant.identity,
          trackSid: track.sid,
          isMuted: track.isMuted,
          isEnabled: publication.isEnabled,
        });
      }
    };
    
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, onParticipantJoined, onParticipantLeft, announceParticipantJoined, announceParticipantLeft]);

  // Get all tracks including screen shares
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Get local camera track for self-view
  const localVideoTrack = localParticipant?.getTrackPublication(Track.Source.Camera)?.track;
  const localScreenTrack = localParticipant?.getTrackPublication(Track.Source.ScreenShare)?.track;

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full livekit-room-container bg-background relative cursor-default"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
    >
      {/* Subtle onboarding arrow hints */}
      {showOnboarding && (
        <>
          {/* Top arrow - minimal */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[60]">
            <ChevronUp className="w-5 h-5 text-foreground/40 animate-subtle-bounce-up" />
          </div>
          
          {/* Bottom arrow - minimal */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[60]">
            <ChevronDown className="w-5 h-5 text-foreground/40 animate-subtle-bounce-down" />
          </div>
        </>
      )}

      {/* Top Header Panel - glassmorphism style */}
      {headerButtons && (
        <div 
          className={cn(
            "absolute top-4 left-1/2 -translate-x-1/2 z-50",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            showTopPanel 
              ? "translate-y-0 opacity-100 scale-100" 
              : isMaximizing 
                ? "opacity-0 scale-95"
                : "-translate-y-8 opacity-0 scale-90 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-4 py-2 sm:py-2.5 rounded-[2rem] sm:rounded-[2.5rem] bg-background/40 backdrop-blur-2xl border border-border/20 shadow-[0_8px_32px_hsl(var(--background)/0.4)]">
            {/* Diagnostics button */}
            <CallDiagnosticsPanel
              state={diagnostics.state}
              onSendReport={diagnostics.sendReport}
              isIOSSafeMode={isIOSSafeMode}
            />

            {/* PiP button removed from header - available in "More" menu */}

            {/* Room name - hidden on mobile */}
            {roomDisplayName && !isMobile && (
              <span className="text-sm font-semibold truncate max-w-[120px] px-2">{roomDisplayName}</span>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-border/20" />

            {/* Header buttons from parent */}
            {headerButtons}

            {/* Divider */}
            <div className="w-px h-5 bg-border/20" />

            {/* Timer button with built-in connection quality indicator */}
            <CallTimer room={room} isHost={true} />
          </div>
        </div>
      )}

      {/* Main video - Focus, Gallery, or Webinar layout */}
      <div className="flex-1 relative overflow-hidden">
        {layoutMode === 'focus' ? (
          <FocusVideoLayout
            localParticipant={localParticipant as LocalParticipant}
            isCameraEnabled={isCameraEnabled}
            isMicrophoneEnabled={isMicrophoneEnabled}
            showChat={showChat}
            isMaximizing={isMaximizing}
            speakingParticipant={speakingParticipant}
            pinnedParticipant={pinnedParticipant}
            onPinParticipant={handlePinParticipant}
          />
        ) : layoutMode === 'gallery' ? (
          <GalleryVideoLayout
            localParticipant={localParticipant as LocalParticipant}
            isCameraEnabled={isCameraEnabled}
            speakingParticipant={speakingParticipant}
            pinnedParticipant={pinnedParticipant}
            onPinParticipant={handlePinParticipant}
          />
        ) : (
          <WebinarVideoLayout
            localParticipant={localParticipant as LocalParticipant}
            isCameraEnabled={isCameraEnabled}
            speakingParticipant={speakingParticipant}
            pinnedParticipant={pinnedParticipant}
            onPinParticipant={handlePinParticipant}
          />
        )}
        
        {/* Raised hand indicators - BIG fullscreen overlay */}
        {raisedHands.size > 0 && (
          <div className="fixed inset-0 pointer-events-none z-[99998] flex justify-center pt-20">
            <div className="flex flex-col gap-3">
              {Array.from(raisedHands.entries()).map(([identity, hand]) => (
                <div
                  key={identity}
                  className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-warning/90 shadow-[0_0_40px_hsl(var(--warning)/0.6),0_0_80px_hsl(var(--warning)/0.3)] animate-bounce"
                >
                  <Hand className="w-7 h-7 text-warning-foreground animate-pulse" />
                  <span className="text-warning-foreground text-lg font-bold">{hand.participantName}</span>
                  <span className="text-warning-foreground/80 text-sm">поднял руку</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile whiteboard tile - appears as a floating tile when remote participant has whiteboard open */}
      {isMobile && (remoteWhiteboardSender || showWhiteboard) && !showWhiteboard && (
        <button
          onClick={() => setShowWhiteboard(true)}
          className="absolute bottom-24 right-3 z-40 flex flex-col items-center justify-center w-28 h-20 rounded-2xl bg-background/60 backdrop-blur-xl border border-primary/30 shadow-[0_4px_20px_hsl(var(--primary)/0.2)] active:scale-95 transition-all"
        >
          <Pencil className="w-6 h-6 text-primary mb-1" />
          <span className="text-xs font-medium text-foreground">Доска</span>
          {remoteWhiteboardSender && (
            <span className="text-[9px] text-muted-foreground truncate max-w-[100px]">{remoteWhiteboardSender}</span>
          )}
        </button>
      )}

      {/* Audio Problem Detector */}
      <AudioProblemDetector
        room={room}
        localParticipant={localParticipant as LocalParticipant}
      />

      {/* Screenshot flash overlay */}
      {showScreenshotFlash && <div className="screenshot-flash" />}

      {/* Recording indicator with timer - fixed position */}
      {isCallRecording && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99997] flex items-center gap-2 px-4 py-2 bg-destructive/20 backdrop-blur-xl border border-destructive/50 rounded-full shadow-[0_0_20px_hsl(var(--destructive)/0.3)]">
          <span className="w-2.5 h-2.5 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm font-bold text-destructive">REC</span>
          <span className="text-sm text-foreground/90 font-mono">{formatRecordingDuration(recordingDuration)}</span>
        </div>
      )}

      {/* Recording preview dialog */}
      {recordingPreviewUrl && (
        <div className="fixed inset-0 z-[99999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-4 sm:p-6 max-w-2xl w-full border border-border/20 shadow-2xl">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Предпросмотр записи
            </h3>
            <video 
              src={recordingPreviewUrl} 
              controls 
              className="w-full rounded-xl bg-background/50"
              autoPlay={false}
            />
            <p className="text-xs text-muted-foreground mt-3 text-center">
              WebM — универсальный формат. MP4 — для совместимости с iPhone/iPad.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-4 justify-end">
              <Button 
                variant="ghost" 
                onClick={discardRecording}
                className="hover:bg-destructive/20 hover:text-destructive order-3 sm:order-1"
                disabled={isConvertingToMp4}
              >
                Отменить
              </Button>
              <Button 
                variant="outline"
                onClick={saveRecordingAsMp4}
                disabled={isConvertingToMp4}
                className="order-2 sm:order-2"
              >
                {isConvertingToMp4 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Конвертация...
                  </>
                ) : (
                  'Экспорт .mp4'
                )}
              </Button>
              <Button 
                onClick={saveRecording}
                className="bg-primary hover:bg-primary/90 order-1 sm:order-3"
                disabled={isConvertingToMp4}
              >
                Сохранить .webm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audio blocked warning - prominent button to enable audio */}
      {showAudioPrompt && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] animate-fade-in pointer-events-auto">
          <button
            {...startAudioProps}
            onClick={async () => {
              try {
                await room.startAudio();
                setShowAudioPrompt(false);
                console.log('[LiveKitRoom] Audio enabled by user click');
              } catch (err) {
                console.error('[LiveKitRoom] Failed to start audio:', err);
              }
            }}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-accent hover:bg-accent/80 text-accent-foreground shadow-2xl backdrop-blur-xl border border-border/50 transition-all hover:scale-105 cursor-pointer"
          >
            <VolumeOff className="w-6 h-6" />
            <div className="text-left">
              <div className="font-bold text-sm">Нажмите для включения звука</div>
              <div className="text-xs opacity-80">Браузер заблокировал автовоспроизведение</div>
            </div>
          </button>
        </div>
      )}

      {/* Bottom Control Bar - Responsive with glassmorphism */}
      <div 
        className={cn(
          "absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 z-50 w-full px-2 sm:px-0 sm:w-auto",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          showBottomPanel 
            ? "translate-y-0 opacity-100 scale-100" 
            : isMaximizing
              ? "opacity-0 scale-95"
              : "translate-y-12 opacity-0 scale-90 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl sm:rounded-[2.5rem] bg-background/40 backdrop-blur-2xl border border-border/20 shadow-[0_8px_32px_hsl(var(--background)/0.4)] flex-wrap sm:flex-nowrap max-w-full overflow-visible">
          {/* Camera toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleCamera}
                variant={isCameraEnabled ? "outline" : "secondary"}
                size="icon"
                className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-border/40",
                  isCameraEnabled 
                    ? "bg-foreground/15 hover:bg-foreground/25" 
                    : "bg-destructive/40 border-destructive/60 hover:bg-destructive/50"
                )}
              >
                {isCameraEnabled ? (
                  <Video className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_hsl(var(--foreground)/0.5)]" />
                ) : (
                  <VideoOff className="w-5 h-5 stroke-[1.8] text-destructive drop-shadow-[0_0_3px_hsl(var(--foreground)/0.4)]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-background/80 border-border/20">
              <p>{isCameraEnabled ? "Выключить камеру (V)" : "Включить камеру (V)"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Mic toggle with popup menu */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={isMicrophoneEnabled ? "outline" : "secondary"}
                    size="icon"
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-border/40",
                      isMicrophoneEnabled 
                        ? "bg-foreground/15 hover:bg-foreground/25" 
                        : "bg-destructive/40 border-destructive/60 hover:bg-destructive/50"
                    )}
                  >
                    {isMicrophoneEnabled ? (
                      <Mic className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_hsl(var(--foreground)/0.5)]" />
                    ) : (
                      <MicOff className="w-5 h-5 stroke-[1.8] text-destructive drop-shadow-[0_0_3px_hsl(var(--foreground)/0.4)]" />
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-background/80 border-border/20">
                <p>{isMicrophoneEnabled ? "Настройки микрофона (M)" : "Включить микрофон (M)"}</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="p-3 bg-background/40 backdrop-blur-2xl border border-border/20 rounded-2xl shadow-[0_8px_32px_hsl(var(--background)/0.4)]"
            >
              <div className="flex flex-col items-center gap-3">
                {/* Main: Toggle Mic (centered on top) */}
                <button
                  onClick={toggleMicrophone}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "bg-foreground/10 backdrop-blur-sm border border-border/30",
                    "hover:bg-foreground/20 transition-all hover:scale-110 hover:shadow-lg",
                    !isMicrophoneEnabled && "bg-destructive/30 border-destructive/50 shadow-[0_0_15px_hsl(var(--destructive)/0.2)]"
                  )}
                  title={isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                >
                  {isMicrophoneEnabled ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <span className="text-[10px] text-muted-foreground -mt-1">
                  {isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
                </span>
                
                {/* Bottom row: Noise (left) + Voice (right) */}
                <div className="flex items-center gap-4">
                  {/* Noise Suppression */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={toggleNoiseSuppression}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        "bg-foreground/10 backdrop-blur-sm border border-border/30",
                        "hover:bg-foreground/20 transition-all hover:scale-110 hover:shadow-lg",
                        isNoiseSuppressionEnabled && "bg-primary/30 border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
                      )}
                      title={isNoiseSuppressionEnabled ? "Выкл. шумоподавление" : "Вкл. шумоподавление"}
                    >
                      {isNoiseSuppressionEnabled ? <VolumeX className="w-4 h-4 text-primary" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">Шумоподавление</span>
                  </div>
                  
                  {/* Voice Commands */}
                  {voiceCommandsSupported && (
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={toggleVoiceCommands}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          "bg-foreground/10 backdrop-blur-sm border border-border/30",
                          "hover:bg-foreground/20 transition-all hover:scale-110 hover:shadow-lg",
                          isVoiceCommandsActive && "bg-accent/30 border-accent/50 shadow-[0_0_15px_hsl(var(--accent)/0.3)]"
                        )}
                        title={isVoiceCommandsActive ? "Выкл. голосовые команды" : "Голосовые команды"}
                      >
                        <Mic2 className={cn("w-4 h-4", isVoiceCommandsActive && "text-accent-foreground")} />
                      </button>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">Голос. команды</span>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Screen share toggle with menu */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant={isScreenShareEnabled ? "default" : "outline"}
                    size="icon"
                    className={cn(
                      "w-12 h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-border/40",
                      isScreenShareEnabled 
                        ? "bg-primary/40 border-primary/60 hover:bg-primary/50" 
                        : "bg-foreground/15 hover:bg-foreground/25"
                    )}
                  >
                    <MonitorUp className={cn(
                      "w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_hsl(var(--foreground)/0.5)]",
                      isScreenShareEnabled && "text-primary"
                    )} />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-background/80 border-border/20">
                <p>{isScreenShareEnabled ? "Остановить демонстрацию" : "Демонстрация экрана"}</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="w-auto p-3 bg-background/40 backdrop-blur-2xl border border-border/20 rounded-2xl shadow-[0_8px_32px_hsl(var(--background)/0.4)]"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-muted-foreground font-medium text-center mb-1">Демонстрация</span>
                <div className="flex items-center gap-3">
                  {/* Share screen */}
                  <button
                    onClick={toggleScreenShare}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                      isScreenShareEnabled 
                        ? "bg-primary/20 border border-primary/30" 
                        : "bg-foreground/5 hover:bg-foreground/10"
                    )}
                  >
                    <MonitorUp className={cn("w-5 h-5", isScreenShareEnabled ? "text-primary" : "text-primary")} />
                    <span className="text-xs whitespace-nowrap">{isScreenShareEnabled ? "Остановить" : "Экран"}</span>
                  </button>
                  
                  {/* Direct call recording - use Circle icon to differentiate from camera */}
                  <button
                    onClick={toggleCallRecording}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all relative",
                      isCallRecording 
                        ? "bg-destructive/20 border border-destructive/40" 
                        : "bg-foreground/5 hover:bg-foreground/10"
                    )}
                  >
                    {/* REC indicator when recording */}
                    {isCallRecording && (
                      <div className="absolute -top-1 -right-1 flex items-center gap-1 px-1.5 py-0.5 bg-destructive rounded-full animate-pulse">
                        <div className="w-1.5 h-1.5 bg-destructive-foreground rounded-full" />
                        <span className="text-[8px] font-bold text-destructive-foreground">REC</span>
                      </div>
                    )}
                    <Circle className={cn("w-5 h-5", isCallRecording ? "text-destructive fill-destructive" : "text-destructive")} />
                    <span className="text-xs whitespace-nowrap">{isCallRecording ? "Стоп" : "REC"}</span>
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Divider */}
          <div className="w-px h-8 bg-border/20 mx-0.5" />

          {/* More menu - secondary functions */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-12 h-12 rounded-full bg-foreground/15 hover:bg-foreground/25 border-border/40 transition-all hover:scale-105 hover:shadow-lg"
                  >
                    <MoreHorizontal className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_hsl(var(--foreground)/0.5)]" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-background/80 border-border/20">
                <p>Ещё (M)</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent 
              side="top" 
              align="center" 
              sideOffset={12}
              className="w-auto p-4 bg-background/60 backdrop-blur-2xl border border-border/20 rounded-2xl shadow-[0_8px_32px_hsl(var(--background)/0.4)]"
            >
              <div className="flex flex-col gap-4">
                {/* Layout modes section */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">Режим отображения</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setLayoutMode('focus');
                        toast.success('Фокус-режим');
                      }}
                      title="Один участник в фокусе, остальные мини"
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                        layoutMode === 'focus' 
                          ? "bg-primary/20 border border-primary/30" 
                          : "bg-foreground/5 hover:bg-foreground/10"
                      )}
                    >
                      <User className={cn("w-4 h-4", layoutMode === 'focus' && "text-primary")} />
                      <span className="text-[9px] whitespace-nowrap">Фокус</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setLayoutMode('gallery');
                        toast.success('Галерейный режим');
                      }}
                      title="Все участники равномерно на экране"
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                        layoutMode === 'gallery' 
                          ? "bg-primary/20 border border-primary/30" 
                          : "bg-foreground/5 hover:bg-foreground/10"
                      )}
                    >
                      <LayoutGrid className={cn("w-4 h-4", layoutMode === 'gallery' && "text-primary")} />
                      <span className="text-[9px] whitespace-nowrap">Галерея</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setLayoutMode('webinar');
                        toast.success('Вебинар-режим');
                      }}
                      title="Спикер крупно, зрители списком"
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                        layoutMode === 'webinar' 
                          ? "bg-primary/20 border border-primary/30" 
                          : "bg-foreground/5 hover:bg-foreground/10"
                      )}
                    >
                      <Presentation className={cn("w-4 h-4", layoutMode === 'webinar' && "text-primary")} />
                      <span className="text-[9px] whitespace-nowrap">Вебинар</span>
                    </button>
                  </div>
                </div>
                
                {/* Tools grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* PiP */}
                  {isPiPSupported && (
                    <CallMenuHint hint="Видео в отдельном мини-окне" side="top">
                      <button
                        onClick={togglePiP}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                          isPiPActive 
                            ? "bg-primary/20 border border-primary/30" 
                            : "bg-foreground/5 hover:bg-foreground/10"
                        )}
                      >
                        <PictureInPicture className={cn("w-5 h-5", isPiPActive && "text-primary")} />
                        <span className="text-[9px] whitespace-nowrap">PiP</span>
                      </button>
                    </CallMenuHint>
                  )}
                  
                  {/* Whiteboard */}
                  <CallMenuHint hint="Совместная доска для рисования" side="top">
                    <button
                      onClick={() => {
                        setShowWhiteboard(true);
                        setShowDrawingOverlay(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                        showWhiteboard 
                          ? "bg-primary/20 border border-primary/30" 
                          : "bg-foreground/5 hover:bg-foreground/10"
                      )}
                    >
                      <LayoutGrid className="w-5 h-5" />
                      <span className="text-[9px] whitespace-nowrap">Доска</span>
                    </button>
                  </CallMenuHint>
                  
                  {/* Drawing on screen */}
                  <CallMenuHint hint="Рисовать поверх экрана" side="top">
                    <button
                      onClick={() => {
                        setShowDrawingOverlay(true);
                        setShowWhiteboard(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[56px]",
                        showDrawingOverlay 
                          ? "bg-primary/20 border border-primary/30" 
                          : "bg-foreground/5 hover:bg-foreground/10"
                      )}
                    >
                      <Pencil className="w-5 h-5" />
                      <span className="text-[9px] whitespace-nowrap">Рисовать</span>
                    </button>
                  </CallMenuHint>
                  
                </div>
                
                {/* Virtual Background row */}
                <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/20">
                  <VirtualBackgroundSelector
                    onSelectBlur={applyBlurBackground}
                    onSelectImage={applyImageBackground}
                    onRemove={removeBackground}
                    currentBackground={currentBackground}
                    isProcessing={isProcessingBackground}
                    onResetAllEffects={() => {
                      if (isNoiseSuppressionEnabled) toggleNoiseSuppression();
                    }}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Chat toggle button - FIRST */}
          <InCallChat
            room={room}
            participantName={participantName}
            isOpen={showChat}
            onToggle={() => setShowChat(!showChat)}
            buttonOnly
          />

          {/* Emoji Reactions - second */}
          <EmojiReactions
            room={room}
            participantName={participantName}
          />

          {/* Raise Hand - third */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={toggleHand}
                variant="outline"
                size="icon"
                className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all hover:scale-105 hover:shadow-lg border-border/40",
                  isHandRaised 
                    ? "bg-warning/30 border-warning/50 animate-pulse" 
                    : "bg-foreground/15 hover:bg-foreground/25"
                )}
              >
                <Hand className={cn("w-5 h-5", isHandRaised && "text-warning")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-background/80 border-border/20">
              <p>{isHandRaised ? "Опустить руку" : "Поднять руку"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-8 bg-border/20 mx-0.5" />

          {/* Leave button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <DisconnectButton className="flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-destructive/90 hover:bg-destructive text-destructive-foreground transition-all hover:scale-105 hover:shadow-lg border border-destructive/60 shadow-[0_0_15px_hsl(var(--destructive)/0.3)]">
                <PhoneOff className="w-5 h-5 stroke-[1.8] drop-shadow-[0_0_3px_hsl(var(--foreground)/0.5)]" />
                <span className="text-sm font-medium tracking-wide">Выйти</span>
              </DisconnectButton>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-background/80 border-border/20">
              <p>Выйти из звонка (Esc×2)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Floating Chat Panel - separate instance for the panel */}
      {showChat && (
        <InCallChat
          room={room}
          participantName={participantName}
          isOpen={true}
          onToggle={() => setShowChat(false)}
        />
      )}

      {/* Collaborative Whiteboard - rendered inside ResizableWhiteboardWindow for desktop */}
      <CollaborativeWhiteboard
        room={room}
        participantName={participantName}
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        windowMode={true}
      />

      {/* Drawing Overlay - for drawing on screen */}
      <DrawingOverlay
        room={room}
        participantName={participantName}
        isOpen={showDrawingOverlay}
        onClose={() => setShowDrawingOverlay(false)}
        onCanvasReady={(canvas) => { drawingCanvasRef.current = canvas; }}
      />

      <RoomAudioRenderer />
    </div>
  );
}

export default LiveKitRoom;
