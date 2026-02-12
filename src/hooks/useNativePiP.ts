import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, Track } from 'livekit-client';
import { toast } from 'sonner';

/**
 * Detect if running on iOS (iPhone/iPad)
 * iOS Safari doesn't support programmatic PiP requests
 */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Hook for managing native browser Picture-in-Picture functionality
 * Allows viewing the call in a floating window when switching tabs
 * 
 * NOTE: iOS Safari does not support programmatic PiP - only user-initiated
 * via native video controls, so we disable this feature on iOS
 */
export function useNativePiP(room: Room | null, autoPiPOnTabSwitch: boolean = true) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const isIOS = useRef(isIOSDevice());
  const userExitedPiPRef = useRef(false);

  // Check if PiP is supported (disabled on iOS)
  useEffect(() => {
    // iOS doesn't support programmatic PiP requests
    if (isIOS.current) {
      setIsPiPSupported(false);
      return;
    }
    
    setIsPiPSupported(
      'pictureInPictureEnabled' in document && 
      document.pictureInPictureEnabled
    );
  }, []);

  // Listen for PiP events
  useEffect(() => {
    const handleEnterPiP = () => {
      setIsPiPActive(true);
      userExitedPiPRef.current = false;
    };

    const handleLeavePiP = () => {
      setIsPiPActive(false);
      activeVideoRef.current = null;
      // If user manually closed PiP, don't auto-reopen on next tab switch
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
    // Skip on iOS - programmatic PiP not supported
    if (isIOS.current) {
      console.log('[useNativePiP] PiP not supported on iOS');
      return;
    }
    
    if (!room || !isPiPSupported) {
      toast.error('Picture-in-Picture не поддерживается');
      return;
    }

    try {
      // Find remote participant with video
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      
      for (const participant of remoteParticipants) {
        const cameraPub = participant.getTrackPublication(Track.Source.Camera);
        const track = cameraPub?.track;
        
        if (track && !cameraPub.isMuted) {
          // Create or find video element for this track
          let videoElement = document.querySelector(
            `video[data-participant="${participant.identity}"]`
          ) as HTMLVideoElement | null;
          
          // If no dedicated video found, create a temporary one
          if (!videoElement) {
            // Find any video element that has this track attached
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
          
          // If still not found, create temporary video and attach track
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
            
            // Clean up after PiP ends
            videoElement.addEventListener('leavepictureinpicture', () => {
              track.detach(videoElement!);
              videoElement?.remove();
            }, { once: true });
          }
          
          if (videoElement && videoElement.readyState >= 2) {
            await videoElement.requestPictureInPicture();
            activeVideoRef.current = videoElement;
            toast.success('Picture-in-Picture активен', {
              description: 'Окно будет видно при переключении вкладок',
              duration: 2000,
            });
            return;
          } else if (videoElement) {
            // Wait for video to be ready
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Video not ready')), 3000);
              videoElement!.addEventListener('loadeddata', () => {
                clearTimeout(timeout);
                resolve();
              }, { once: true });
            });
            
            await videoElement.requestPictureInPicture();
            activeVideoRef.current = videoElement;
            toast.success('Picture-in-Picture активен');
            return;
          }
        }
      }
      
      // No remote video found, try local video
      const localCameraPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
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
              toast.success('Picture-in-Picture активен (ваше видео)');
              return;
            }
          }
        }
      }

      toast.error('Нет видео для Picture-in-Picture');
    } catch (err) {
      console.error('[useNativePiP] Failed to request PiP:', err);
      toast.error('Не удалось активировать Picture-in-Picture');
    }
  }, [room, isPiPSupported]);

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

  // Auto PiP when switching tabs (like Google Meet)
  useEffect(() => {
    if (!autoPiPOnTabSwitch || !isPiPSupported || isIOS.current) return;

    const handleVisibility = async () => {
      if (document.visibilityState === 'hidden' && room && !isPiPActive && !userExitedPiPRef.current) {
        // Tab hidden → auto-enter PiP
        try {
          await requestPiP();
        } catch {
          // Silently fail — browser may block without user gesture
        }
      } else if (document.visibilityState === 'visible' && isPiPActive) {
        // Tab visible again → auto-exit PiP
        try {
          await exitPiP();
        } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoPiPOnTabSwitch, isPiPSupported, isPiPActive, room, requestPiP, exitPiP]);

  // Reset user-exited flag when entering a new room
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
