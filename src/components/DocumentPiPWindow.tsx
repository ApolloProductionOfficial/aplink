import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, Track } from 'livekit-client';

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

// SVG icon strings for PiP window (can't use React components in separate document)
const SVG_ICONS = {
  micOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  micOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5.12"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  camOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`,
  camOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`,
  screenShare: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><path d="m9 10 3-3 3 3"/><path d="M12 7v6"/></svg>`,
  screenShareActive: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/><path d="m9 13 3 3 3-3"/><path d="M12 16v-6"/></svg>`,
  endCall: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)"/></svg>`,
  backArrow: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
};

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
  const [isPiPOpen, setIsPiPOpen] = useState(false);
  const isOpeningRef = useRef(false);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  const isSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const cleanupVideos = useCallback(() => {
    videoElementsRef.current.forEach((video) => {
      try { video.srcObject = null; video.remove(); } catch {}
    });
    videoElementsRef.current.clear();
  }, []);

  const closePiP = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) pipWindowRef.current.close();
    pipWindowRef.current = null;
    cleanupVideos();
    setIsPiPOpen(false);
    isOpeningRef.current = false;
  }, [cleanupVideos]);

  const createParticipantCard = useCallback((
    doc: Document, name: string, videoTrack: any | null, isLocal: boolean, identity: string,
  ) => {
    const card = doc.createElement('div');
    card.style.cssText = `position:relative;flex:1 1 0;min-width:140px;max-width:300px;height:100%;border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);`;

    if (videoTrack && !videoTrack.isMuted) {
      const video = doc.createElement('video');
      video.autoplay = true; video.playsInline = true; video.muted = isLocal;
      video.style.cssText = `width:100%;height:100%;object-fit:cover;${isLocal ? 'transform:scaleX(-1);' : ''}`;
      try { videoTrack.attach(video); videoElementsRef.current.set(identity, video); } catch {}
      card.appendChild(video);
    } else {
      const avatar = doc.createElement('div');
      avatar.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);`;
      const letter = doc.createElement('div');
      letter.textContent = (name || '?')[0].toUpperCase();
      letter.style.cssText = `width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:white;font-family:system-ui,-apple-system,sans-serif;`;
      avatar.appendChild(letter); card.appendChild(avatar);
    }

    const label = doc.createElement('div');
    label.textContent = name || 'Unknown';
    label.style.cssText = `position:absolute;bottom:8px;left:8px;color:white;font-size:11px;font-weight:500;background:rgba(0,0,0,0.6);padding:2px 8px;border-radius:6px;font-family:system-ui,-apple-system,sans-serif;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
    card.appendChild(label);
    return card;
  }, []);

  const createButton = useCallback((
    doc: Document, svgIcon: string, onClick: () => void, isActiveState: boolean = false, isDanger: boolean = false,
  ) => {
    const btn = doc.createElement('button');
    btn.innerHTML = svgIcon;
    btn.onclick = onClick;
    const bg = isDanger ? '#ef4444' : isActiveState ? '#ef4444' : 'rgba(255,255,255,0.1)';
    const hoverBg = isDanger ? '#dc2626' : isActiveState ? '#dc2626' : 'rgba(255,255,255,0.2)';
    btn.style.cssText = `width:40px;height:40px;border-radius:50%;border:none;background:${bg};color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;`;
    btn.onmouseenter = () => { btn.style.background = hoverBg; btn.style.transform = 'scale(1.1)'; };
    btn.onmouseleave = () => { btn.style.background = bg; btn.style.transform = 'scale(1)'; };
    return btn;
  }, []);

  const buildPiPContent = useCallback(() => {
    const pipWindow = pipWindowRef.current;
    if (!pipWindow || pipWindow.closed || !room) return;
    const doc = pipWindow.document;
    doc.body.innerHTML = '';
    doc.body.style.cssText = `margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;display:flex;flex-direction:column;height:100vh;`;

    // Top bar
    const topBar = doc.createElement('div');
    topBar.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);`;

    const backBtn = doc.createElement('button');
    backBtn.innerHTML = `${SVG_ICONS.backArrow} <span style="margin-left:4px">Back</span>`;
    backBtn.onclick = () => { onBackToTab(); closePiP(); };
    backBtn.style.cssText = `background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);color:white;padding:5px 12px;border-radius:20px;cursor:pointer;font-size:12px;font-family:system-ui;display:flex;align-items:center;gap:2px;transition:all 0.2s;`;
    backBtn.onmouseenter = () => { backBtn.style.background = 'rgba(255,255,255,0.15)'; };
    backBtn.onmouseleave = () => { backBtn.style.background = 'rgba(255,255,255,0.08)'; };
    topBar.appendChild(backBtn);

    const closeBtn = doc.createElement('button');
    closeBtn.innerHTML = SVG_ICONS.close;
    closeBtn.onclick = () => closePiP();
    closeBtn.style.cssText = `background:none;border:none;color:rgba(255,255,255,0.6);cursor:pointer;padding:4px;display:flex;align-items:center;border-radius:50%;transition:all 0.2s;`;
    closeBtn.onmouseenter = () => { closeBtn.style.background = 'rgba(255,255,255,0.1)'; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = 'none'; };
    topBar.appendChild(closeBtn);
    doc.body.appendChild(topBar);

    // Video grid
    const grid = doc.createElement('div');
    grid.style.cssText = `flex:1;display:flex;gap:4px;padding:4px;min-height:0;`;
    cleanupVideos();

    const allParticipants: Array<{ name: string; track: any; isLocal: boolean; identity: string }> = [];
    const localCam = room.localParticipant.getTrackPublication(Track.Source.Camera);
    allParticipants.push({ name: participantName || room.localParticipant.name || 'You', track: localCam?.track || null, isLocal: true, identity: room.localParticipant.identity });

    for (const p of Array.from(room.remoteParticipants.values())) {
      const cam = p.getTrackPublication(Track.Source.Camera);
      allParticipants.push({ name: p.name || p.identity, track: cam?.track || null, isLocal: false, identity: p.identity });
    }

    for (const p of allParticipants) {
      grid.appendChild(createParticipantCard(doc, p.name, p.track, p.isLocal, p.identity));
    }
    doc.body.appendChild(grid);

    // Control bar
    const controls = doc.createElement('div');
    controls.style.cssText = `display:flex;align-items:center;justify-content:center;gap:10px;padding:8px;background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);`;

    if (onToggleMic) {
      controls.appendChild(createButton(doc, isMicMuted ? SVG_ICONS.micOff : SVG_ICONS.micOn, onToggleMic, isMicMuted));
    }
    if (onToggleCamera) {
      controls.appendChild(createButton(doc, isCameraMuted ? SVG_ICONS.camOff : SVG_ICONS.camOn, onToggleCamera, isCameraMuted));
    }
    if (onToggleScreenShare) {
      controls.appendChild(createButton(doc, isScreenSharing ? SVG_ICONS.screenShareActive : SVG_ICONS.screenShare, onToggleScreenShare, isScreenSharing));
    }
    controls.appendChild(createButton(doc, SVG_ICONS.endCall, () => { onEndCall(); closePiP(); }, false, true));

    doc.body.appendChild(controls);
  }, [room, participantName, isMicMuted, isCameraMuted, isScreenSharing, onToggleMic, onToggleCamera, onToggleScreenShare, onEndCall, onBackToTab, closePiP, cleanupVideos, createParticipantCard, createButton]);

  const openPiP = useCallback(async () => {
    if (!isSupported || !room || isOpeningRef.current) return;
    if (pipWindowRef.current && !pipWindowRef.current.closed) return;
    isOpeningRef.current = true;
    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({ width: 500, height: 300 });
      pipWindowRef.current = pipWindow;
      setIsPiPOpen(true);
      pipWindow.addEventListener('pagehide', () => {
        cleanupVideos(); pipWindowRef.current = null; setIsPiPOpen(false); isOpeningRef.current = false;
      });
      buildPiPContent();
    } catch (err) {
      console.warn('[DocPiP] Failed to open:', err);
    } finally {
      isOpeningRef.current = false;
    }
  }, [isSupported, room, buildPiPContent, cleanupVideos]);

  useEffect(() => {
    if (isPiPOpen && pipWindowRef.current && !pipWindowRef.current.closed) buildPiPContent();
  }, [isPiPOpen, isMicMuted, isCameraMuted, isScreenSharing, buildPiPContent]);

  useEffect(() => {
    if (!isActive || !isSupported || !room) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') openPiP();
      else if (document.visibilityState === 'visible') closePiP();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); closePiP(); };
  }, [isActive, isSupported, room, openPiP, closePiP]);

  useEffect(() => {
    if (!room || !isPiPOpen) return;
    const handleTrackChange = () => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) buildPiPContent();
    };
    const events = ['trackSubscribed', 'trackUnsubscribed', 'participantConnected', 'participantDisconnected', 'trackMuted', 'trackUnmuted'] as const;
    events.forEach(e => room.on(e as any, handleTrackChange));
    return () => { events.forEach(e => room.off(e as any, handleTrackChange)); };
  }, [room, isPiPOpen, buildPiPContent]);

  return null;
}
