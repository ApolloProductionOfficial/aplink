import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, Track, RemoteParticipant } from 'livekit-client';
import { cn } from '@/lib/utils';

interface DocumentPiPWindowProps {
  room: Room | null;
  isActive: boolean;
  onBackToTab: () => void;
  onEndCall: () => void;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  isMicMuted?: boolean;
  isCameraMuted?: boolean;
  isScreenSharing?: boolean;
  participantName?: string;
}

/**
 * Document Picture-in-Picture window — Google Meet style.
 * Opens an always-on-top browser window with participant videos & controls
 * when the user switches tabs. Auto-closes when returning.
 */
export function DocumentPiPWindow({
  room,
  isActive,
  onBackToTab,
  onEndCall,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  isMicMuted = false,
  isCameraMuted = false,
  isScreenSharing = false,
  participantName,
}: DocumentPiPWindowProps) {
  const pipWindowRef = useRef<Window | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const isOpeningRef = useRef(false);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Check if Document PiP is supported
  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  // Clean up video elements
  const cleanupVideos = useCallback(() => {
    videoElementsRef.current.forEach((video) => {
      try {
        video.srcObject = null;
        video.remove();
      } catch {}
    });
    videoElementsRef.current.clear();
  }, []);

  // Close PiP window
  const closePiP = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    cleanupVideos();
    setIsPiPOpen(false);
    isOpeningRef.current = false;
  }, [cleanupVideos]);

  // Create participant video element
  const createParticipantCard = useCallback((
    doc: Document,
    name: string,
    videoTrack: any | null,
    isLocal: boolean,
    identity: string,
  ) => {
    const card = doc.createElement('div');
    card.style.cssText = `
      position: relative;
      flex: 1 1 0;
      min-width: 140px;
      max-width: 300px;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    `;

    if (videoTrack && !videoTrack.isMuted) {
      const video = doc.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isLocal;
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        ${isLocal ? 'transform: scaleX(-1);' : ''}
      `;
      try {
        videoTrack.attach(video);
        videoElementsRef.current.set(identity, video);
      } catch (e) {
        console.warn('[DocPiP] Failed to attach track:', e);
      }
      card.appendChild(video);
    } else {
      // Avatar placeholder
      const avatar = doc.createElement('div');
      avatar.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
      `;
      const letter = doc.createElement('div');
      letter.textContent = (name || '?')[0].toUpperCase();
      letter.style.cssText = `
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 600;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      avatar.appendChild(letter);
      card.appendChild(avatar);
    }

    // Name label
    const label = doc.createElement('div');
    label.textContent = name || 'Unknown';
    label.style.cssText = `
      position: absolute;
      bottom: 8px;
      left: 8px;
      color: white;
      font-size: 12px;
      font-weight: 500;
      background: rgba(0,0,0,0.5);
      padding: 2px 8px;
      border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 80%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    card.appendChild(label);

    return card;
  }, []);

  // Create control button
  const createButton = useCallback((
    doc: Document,
    icon: string,
    onClick: () => void,
    isActive: boolean = false,
    isDanger: boolean = false,
  ) => {
    const btn = doc.createElement('button');
    btn.innerHTML = icon;
    btn.onclick = onClick;
    const bg = isDanger ? '#ef4444' : isActive ? '#ef4444' : 'rgba(255,255,255,0.1)';
    const hoverBg = isDanger ? '#dc2626' : isActive ? '#dc2626' : 'rgba(255,255,255,0.2)';
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: ${bg};
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      font-size: 18px;
    `;
    btn.onmouseenter = () => { btn.style.background = hoverBg; };
    btn.onmouseleave = () => { btn.style.background = bg; };
    return btn;
  }, []);

  // Build PiP window content
  const buildPiPContent = useCallback(() => {
    const pipWindow = pipWindowRef.current;
    if (!pipWindow || pipWindow.closed || !room) return;

    const doc = pipWindow.document;
    
    // Clear previous content
    doc.body.innerHTML = '';
    doc.body.style.cssText = `
      margin: 0;
      padding: 0;
      background: #1a1a2e;
      font-family: system-ui, -apple-system, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    `;

    // Top bar
    const topBar = doc.createElement('div');
    topBar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(0,0,0,0.3);
    `;

    const backBtn = doc.createElement('button');
    backBtn.innerHTML = '‹ Back to Tab';
    backBtn.onclick = () => { onBackToTab(); closePiP(); };
    backBtn.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: none;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      transition: background 0.2s;
    `;
    backBtn.onmouseenter = () => { backBtn.style.background = 'rgba(255,255,255,0.2)'; };
    backBtn.onmouseleave = () => { backBtn.style.background = 'rgba(255,255,255,0.1)'; };
    topBar.appendChild(backBtn);

    const closeBtn = doc.createElement('button');
    closeBtn.innerHTML = '✕ Close';
    closeBtn.onclick = () => closePiP();
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 6px 8px;
    `;
    topBar.appendChild(closeBtn);

    doc.body.appendChild(topBar);

    // Video grid
    const grid = doc.createElement('div');
    grid.style.cssText = `
      flex: 1;
      display: flex;
      gap: 4px;
      padding: 4px;
      min-height: 0;
    `;

    // Clean up old video elements
    cleanupVideos();

    // Add remote participants
    const remotes = Array.from(room.remoteParticipants.values());
    const allParticipants: Array<{ name: string; track: any; isLocal: boolean; identity: string }> = [];

    // Local participant
    const localCam = room.localParticipant.getTrackPublication(Track.Source.Camera);
    allParticipants.push({
      name: participantName || room.localParticipant.name || 'Вы',
      track: localCam?.track || null,
      isLocal: true,
      identity: room.localParticipant.identity,
    });

    // Remote participants
    for (const p of remotes) {
      const cam = p.getTrackPublication(Track.Source.Camera);
      allParticipants.push({
        name: p.name || p.identity,
        track: cam?.track || null,
        isLocal: false,
        identity: p.identity,
      });
    }

    for (const p of allParticipants) {
      const card = createParticipantCard(doc, p.name, p.track, p.isLocal, p.identity);
      grid.appendChild(card);
    }

    doc.body.appendChild(grid);

    // Control bar
    const controls = doc.createElement('div');
    controls.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px;
      background: rgba(0,0,0,0.4);
    `;

    // Mic button
    if (onToggleMic) {
      const micIcon = isMicMuted ? '🔇' : '🎤';
      controls.appendChild(createButton(doc, micIcon, onToggleMic, isMicMuted));
    }

    // Camera button
    if (onToggleCamera) {
      const camIcon = isCameraMuted ? '📷' : '📹';
      controls.appendChild(createButton(doc, camIcon, onToggleCamera, isCameraMuted));
    }

    // Screen share button
    if (onToggleScreenShare) {
      controls.appendChild(createButton(doc, '🖥️', onToggleScreenShare, isScreenSharing));
    }

    // End call button
    controls.appendChild(createButton(doc, '📞', () => { onEndCall(); closePiP(); }, false, true));

    doc.body.appendChild(controls);
  }, [room, participantName, isMicMuted, isCameraMuted, isScreenSharing, onToggleMic, onToggleCamera, onToggleScreenShare, onEndCall, onBackToTab, closePiP, cleanupVideos, createParticipantCard, createButton]);

  // Open Document PiP window
  const openPiP = useCallback(async () => {
    if (!isSupported || !room || isOpeningRef.current) return;
    if (pipWindowRef.current && !pipWindowRef.current.closed) return;

    isOpeningRef.current = true;

    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 500,
        height: 300,
      });

      pipWindowRef.current = pipWindow;
      setIsPiPOpen(true);

      // Listen for PiP window close
      pipWindow.addEventListener('pagehide', () => {
        cleanupVideos();
        pipWindowRef.current = null;
        setIsPiPOpen(false);
        isOpeningRef.current = false;
      });

      buildPiPContent();
    } catch (err) {
      console.warn('[DocPiP] Failed to open Document PiP:', err);
    } finally {
      isOpeningRef.current = false;
    }
  }, [isSupported, room, buildPiPContent, cleanupVideos]);

  // Update PiP content when state changes
  useEffect(() => {
    if (isPiPOpen && pipWindowRef.current && !pipWindowRef.current.closed) {
      buildPiPContent();
    }
  }, [isPiPOpen, isMicMuted, isCameraMuted, isScreenSharing, buildPiPContent]);

  // Auto-open on tab switch, auto-close on return
  useEffect(() => {
    if (!isActive || !isSupported || !room) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden → open Document PiP
        openPiP();
      } else if (document.visibilityState === 'visible') {
        // Tab visible → close Document PiP
        closePiP();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      closePiP();
    };
  }, [isActive, isSupported, room, openPiP, closePiP]);

  // Update content when participants change
  useEffect(() => {
    if (!room || !isPiPOpen) return;

    const handleTrackChange = () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        buildPiPContent();
      }
    };

    room.on('trackSubscribed', handleTrackChange);
    room.on('trackUnsubscribed', handleTrackChange);
    room.on('participantConnected', handleTrackChange);
    room.on('participantDisconnected', handleTrackChange);
    room.on('trackMuted', handleTrackChange);
    room.on('trackUnmuted', handleTrackChange);

    return () => {
      room.off('trackSubscribed', handleTrackChange);
      room.off('trackUnsubscribed', handleTrackChange);
      room.off('participantConnected', handleTrackChange);
      room.off('participantDisconnected', handleTrackChange);
      room.off('trackMuted', handleTrackChange);
      room.off('trackUnmuted', handleTrackChange);
    };
  }, [room, isPiPOpen, buildPiPContent]);

  // This component doesn't render anything in the main DOM
  return null;
}
