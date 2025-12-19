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

  const startRecording = useCallback(async () => {
    try {
      // Request tab audio capture (includes all audio from the tab - both your mic and others' audio)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required but we only use audio
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      // Also get microphone for local voice
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (e) {
        console.log('Microphone not available, using only tab audio');
      }

      // Create AudioContext to mix streams
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add tab audio if available
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySource = audioContext.createMediaStreamSource(
          new MediaStream(displayAudioTracks)
        );
        displaySource.connect(destination);
      }

      // Add microphone audio if available
      if (micStream) {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
        streamsRef.current.push(micStream);
      }

      streamsRef.current.push(displayStream);

      // Use combined audio stream
      const combinedStream = destination.stream;

      // Stop video track immediately (we only need audio)
      displayStream.getVideoTracks().forEach(track => track.stop());

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];
      audioBlobRef.current = null;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        
        // Stop all tracks and streams
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        streamsRef.current = [];
      };

      // Handle when user stops sharing
      displayStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
          }
        };
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      
      console.log('Full meeting audio recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      const originalOnStop = mediaRecorderRef.current.onstop;
      
      mediaRecorderRef.current.onstop = (event) => {
        if (originalOnStop) {
          originalOnStop.call(mediaRecorderRef.current, event);
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        
        // Stop all streams
        streamsRef.current.forEach(stream => {
          stream.getTracks().forEach(track => track.stop());
        });
        streamsRef.current = [];
        
        setIsRecording(false);
        console.log('Meeting recording stopped, blob size:', audioBlob.size);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const getAudioBlob = useCallback(() => {
    return audioBlobRef.current;
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    getAudioBlob,
  };
};
