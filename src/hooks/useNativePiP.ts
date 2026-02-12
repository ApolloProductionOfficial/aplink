import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, Track } from 'livekit-client';
import { toast } from 'sonner';

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Hook for managing native browser Picture-in-Picture functionality.
 * 
 * Issue 1 FIX: Uses refs instead of state for the visibility handler
 * to avoid stale closures. Resets userExitedPiPRef when user returns
 * to the tab so PiP re-triggers on subsequent tab switches.
 */
export function useNativePiP(room: Room | null, autoPiPOnTabSwitch: boolean = true) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const isIOS = useRef(isIOSDevice());
  const userExitedPiPRef = useRef(false);
  // Issue 1: Ref mirror to avoid stale closure in visibilitychange handler
  const isPiPActiveRef = useRef(false);
  const roomRef = useRef<Room | null>(null);

  // Keep roomRef in sync
  useEffect(() => { roomRef.current = room; }, [room]);

  // Check PiP support (disabled on iOS)
  useEffect(() => {
    if (isIOS.current) {
      setIsPiPSupported(false);
      return;
    }
    setIsPiPSupported(
      'pictureInPictureEnabled' in document && 
      document.pictureInPictureEnabled
    );
  }, []);

  // Listen for PiP events — sync ref
  useEffect(() => {
    const handleEnterPiP = () => {
      setIsPiPActive(true);
      isPiPActiveRef.current = true;
      userExitedPiPRef.current = false;
    };

    const handleLeavePiP = () => {
      setIsPiPActive(false);
      isPiPActiveRef.current = false;
      activeVideoRef.current = null;
      // If user manually closed PiP while tab is visible → disable auto for this session
      if (document.visibilityState === 'visible') {
        userExitedPiPRef.current = true;
      }
    };

    document.addEventListener('enterpictureinpicture', handleEnterPiP);
    document.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      document.removeEventListener('enterpictureinpicture', handleEnterPiP);
      document.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  // Request PiP for remote participant's video
  const requestPiP = useCallback(async () => {
    if (isIOS.current) return;
    
    const currentRoom = roomRef.current;
    if (!currentRoom || !isPiPSupported) {
      toast.error('Picture-in-Picture не поддерживается');
      return;
    }

    try {
      const remoteParticipants = Array.from(currentRoom.remoteParticipants.values());
      
      for (const participant of remoteParticipants) {
        const cameraPub = participant.getTrackPublication(Track.Source.Camera);
        const track = cameraPub?.track;
        
        if (track && !cameraPub.isMuted) {
          let videoElement = document.querySelector(
            `video[data-participant="${participant.identity}"]`
          ) as HTMLVideoElement | null;
          
          if (!videoElement) {
            const allVideos = document.querySelectorAll('video');
            for (const video of allVideos) {
              const htmlVideo = video as HTMLVideoElement;
              if (htmlVideo.srcObject instanceof MediaStream) {
                const tracks = htmlVideo.srcObject.getVideoTracks();
                if (tracks.some(t => t.id === track.mediaStreamTrack?.id)) {
                  videoElement = htmlVideo;
                  break;
                }
              }
            }
          }
          
          if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.muted = false;
            videoElement.style.position = 'fixed';
            videoElement.style.top = '-9999px';
            videoElement.style.left = '-9999px';
            document.body.appendChild(videoElement);
            track.attach(videoElement);
            
            videoElement.addEventListener('leavepictureinpicture', () => {
              track.detach(videoElement!);
              videoElement?.remove();
            }, { once: true });
          }
          
          if (videoElement && videoElement.readyState >= 2) {
            await videoElement.requestPictureInPicture();
            activeVideoRef.current = videoElement;
            return;
          } else if (videoElement) {
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Video not ready')), 3000);
              videoElement!.addEventListener('loadeddata', () => {
                clearTimeout(timeout);
                resolve();
              }, { once: true });
            });
            
            await videoElement.requestPictureInPicture();
            activeVideoRef.current = videoElement;
            return;
          }
        }
      }
      
      // Fallback: local video
      const localCameraPub = currentRoom.localParticipant.getTrackPublication(Track.Source.Camera);
      const localTrack = localCameraPub?.track;
      
      if (localTrack && !localCameraPub.isMuted) {
        const allVideos = document.querySelectorAll('video');
        for (const video of allVideos) {
          const htmlVideo = video as HTMLVideoElement;
          if (htmlVideo.srcObject instanceof MediaStream) {
            const tracks = htmlVideo.srcObject.getVideoTracks();
            if (tracks.some(t => t.id === localTrack.mediaStreamTrack?.id)) {
              await htmlVideo.requestPictureInPicture();
              activeVideoRef.current = htmlVideo;
              return;
            }
          }
        }
      }

      console.log('[useNativePiP] No video available for PiP');
    } catch (err) {
      console.error('[useNativePiP] Failed to request PiP:', err);
    }
  }, [isPiPSupported]);

  // Exit PiP
  const exitPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      activeVideoRef.current = null;
    } catch (err) {
      console.error('[useNativePiP] Failed to exit PiP:', err);
    }
  }, []);

  // Toggle PiP
  const togglePiP = useCallback(async () => {
    if (isPiPActive) {
      await exitPiP();
    } else {
      await requestPiP();
    }
  }, [isPiPActive, exitPiP, requestPiP]);

  // Issue 1 FIX: Auto PiP on tab switch using REFS (no stale closures)
  // Resets userExitedPiPRef when returning to tab so PiP re-triggers
  useEffect(() => {
    if (!autoPiPOnTabSwitch || !isPiPSupported || isIOS.current) return;

    const handleVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        // Tab hidden → auto-enter PiP
        if (roomRef.current && !isPiPActiveRef.current && !userExitedPiPRef.current) {
          try {
            await requestPiP();
          } catch {
            // Browser may block without user gesture
          }
        }
      } else if (document.visibilityState === 'visible') {
        // Tab visible → auto-exit PiP and RESET manual exit flag
        if (isPiPActiveRef.current) {
          try {
            await exitPiP();
          } catch {}
        }
        // Issue 1 FIX: Always reset so next tab switch triggers PiP again
        userExitedPiPRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoPiPOnTabSwitch, isPiPSupported, requestPiP, exitPiP]);
  // NOTE: Removed isPiPActive and room from deps — using refs instead

  // Reset user-exited flag on new room
  useEffect(() => {
    if (room) {
      userExitedPiPRef.current = false;
    }
  }, [room]);

  return {
    isPiPActive,
    isPiPSupported,
    requestPiP,
    exitPiP,
    togglePiP,
  };
}
