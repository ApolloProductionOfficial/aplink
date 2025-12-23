import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  getAudioBlob: () => Blob | null;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const isStoppingRef = useRef(false);

  // Helper to create blob from chunks
  const createBlobFromChunks = useCallback(() => {
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioBlobRef.current = audioBlob;
      console.log('Created audio blob from chunks, size:', audioBlob.size);
      return audioBlob;
    }
    return audioBlobRef.current;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Reset state
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      isStoppingRef.current = false;

      // Use only microphone - avoid getDisplayMedia which can cause call to exit
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamsRef.current.push(micStream);

      // Create MediaRecorder directly from mic stream
      const mediaRecorder = new MediaRecorder(micStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Continuously update the blob so we always have the latest data
          createBlobFromChunks();
        }
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', audioChunksRef.current.length);
        createBlobFromChunks();
        
        // Stop all tracks and streams
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        streamsRef.current = [];
        setIsRecording(false);
      };

      // Handle when user stops microphone or track ends unexpectedly
      micStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.log('Audio track ended unexpectedly');
          // Save current chunks before stopping
          createBlobFromChunks();
          
          if (mediaRecorderRef.current?.state === 'recording' && !isStoppingRef.current) {
            isStoppingRef.current = true;
            try {
              mediaRecorderRef.current.stop();
            } catch (e) {
              console.log('Error stopping recorder:', e);
            }
            setIsRecording(false);
          }
        };
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(500); // Collect data every 500ms for more frequent saves
      setIsRecording(true);
      
      console.log('Microphone recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [createBlobFromChunks]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    isStoppingRef.current = true;
    
    return new Promise((resolve) => {
      // First, always try to create blob from existing chunks
      const existingBlob = createBlobFromChunks();
      
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        console.log('Recorder inactive, returning existing blob:', existingBlob?.size);
        setIsRecording(false);
        resolve(existingBlob && existingBlob.size > 0 ? existingBlob : null);
        return;
      }

      const recorder = mediaRecorderRef.current;
      
      // Set up onstop handler before stopping
      const originalOnStop = recorder.onstop;
      
      recorder.onstop = (event) => {
        if (originalOnStop) {
          originalOnStop.call(recorder, event);
        }
        
        const audioBlob = createBlobFromChunks();
        
        // Stop all streams
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        streamsRef.current = [];
        
        setIsRecording(false);
        console.log('Recording stopped, final blob size:', audioBlob?.size);
        resolve(audioBlob && audioBlob.size > 0 ? audioBlob : null);
      };

      try {
        recorder.stop();
      } catch (e) {
        console.error('Error stopping recorder:', e);
        // Return whatever we have
        const blob = createBlobFromChunks();
        setIsRecording(false);
        resolve(blob && blob.size > 0 ? blob : null);
      }
    });
  }, [createBlobFromChunks]);

  const getAudioBlob = useCallback(() => {
    // Always try to get the latest from chunks
    if (audioChunksRef.current.length > 0) {
      return createBlobFromChunks();
    }
    return audioBlobRef.current;
  }, [createBlobFromChunks]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    getAudioBlob,
  };
};
