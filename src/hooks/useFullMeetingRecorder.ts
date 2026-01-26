import { useRef, useState, useCallback, useEffect } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrack, Track } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

interface UseFullMeetingRecorderReturn {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  getAudioBlob: () => Blob | null;
}

export const useFullMeetingRecorder = (room: Room | null): UseFullMeetingRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const remoteSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Subscribe to remote audio tracks
  useEffect(() => {
    if (!room || !audioContextRef.current || !destinationRef.current || !isRecording) return;

    const handleTrackSubscribed = (
      track: RemoteTrack,
      publication: any,
      participant: RemoteParticipant
    ) => {
      if (track.kind === 'audio' && track.mediaStream) {
        try {
          const source = audioContextRef.current!.createMediaStreamSource(track.mediaStream);
          source.connect(destinationRef.current!);
          remoteSourcesRef.current.set(participant.identity, source);
          console.log('[FullRecorder] Connected remote audio from:', participant.identity);
        } catch (err) {
          console.error('[FullRecorder] Failed to connect remote audio:', err);
        }
      }
    };

    const handleTrackUnsubscribed = (
      track: RemoteTrack,
      publication: any,
      participant: RemoteParticipant
    ) => {
      const source = remoteSourcesRef.current.get(participant.identity);
      if (source) {
        try {
          source.disconnect();
        } catch {}
        remoteSourcesRef.current.delete(participant.identity);
        console.log('[FullRecorder] Disconnected remote audio from:', participant.identity);
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    // Connect existing remote participants
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track && publication.track.mediaStream) {
          try {
            const source = audioContextRef.current!.createMediaStreamSource(publication.track.mediaStream);
            source.connect(destinationRef.current!);
            remoteSourcesRef.current.set(participant.identity, source);
            console.log('[FullRecorder] Connected existing remote audio from:', participant.identity);
          } catch (err) {
            console.error('[FullRecorder] Failed to connect existing remote audio:', err);
          }
        }
      });
    });

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [room, isRecording]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      // Create audio context for mixing
      audioContextRef.current = new AudioContext({ sampleRate: 48000 });
      destinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Get local microphone
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      // Connect local mic to destination
      const localSource = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
      localSource.connect(destinationRef.current);
      console.log('[FullRecorder] Connected local microphone');

      // Connect existing remote participants
      if (room) {
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((publication) => {
            if (publication.track && publication.track.mediaStream) {
              try {
                const source = audioContextRef.current!.createMediaStreamSource(publication.track.mediaStream);
                source.connect(destinationRef.current!);
                remoteSourcesRef.current.set(participant.identity, source);
                console.log('[FullRecorder] Connected remote audio from:', participant.identity);
              } catch (err) {
                console.error('[FullRecorder] Failed to connect remote audio:', err);
              }
            }
          });
        });
      }

      // Create MediaRecorder with mixed stream
      // Try MP4 first for better compatibility, fallback to WebM
      chunksRef.current = [];
      
      const mimeTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
      console.log('[FullRecorder] Using MIME type:', mimeType);

      mediaRecorderRef.current = new MediaRecorder(destinationRef.current.stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      console.log('[FullRecorder] Recording started with all participants');
    } catch (err) {
      console.error('[FullRecorder] Failed to start recording:', err);
      throw err;
    }
  }, [isRecording, room]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isRecording || !mediaRecorderRef.current) return null;

    return new Promise((resolve) => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      mediaRecorderRef.current!.onstop = () => {
        // Use the actual mimeType that was used for recording
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        console.log('[FullRecorder] Recording stopped, size:', blob.size, 'type:', actualMimeType);

        // Cleanup
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
        }

        remoteSourcesRef.current.forEach((source) => {
          try {
            source.disconnect();
          } catch {}
        });
        remoteSourcesRef.current.clear();

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        destinationRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        resolve(blob);
      };

      mediaRecorderRef.current!.stop();
    });
  }, [isRecording]);

  const getAudioBlob = useCallback((): Blob | null => {
    if (chunksRef.current.length === 0) return null;
    const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    return new Blob(chunksRef.current, { type: actualMimeType });
  }, []);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    getAudioBlob,
  };
};
