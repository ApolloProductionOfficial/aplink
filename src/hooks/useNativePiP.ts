import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, Track } from 'livekit-client';
import { toast } from 'sonner';

/**
 * Hook for managing native browser Picture-in-Picture functionality
 * Allows viewing the call in a floating window when switching tabs
 */
export function useNativePiP(room: Room | null) {
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Check if PiP is supported
  useEffect(() => {
    setIsPiPSupported(
      'pictureInPictureEnabled' in document && 
      document.pictureInPictureEnabled
    );
  }, []);

  // Listen for PiP events
  useEffect(() => {
    const handleEnterPiP = () => {
      setIsPiPActive(true);
    };

    const handleLeavePiP = () => {
      setIsPiPActive(false);
      activeVideoRef.current = null;
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

  return {
    isPiPActive,
    isPiPSupported,
    requestPiP,
    exitPiP,
    togglePiP,
  };
}
