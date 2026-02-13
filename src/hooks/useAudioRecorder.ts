import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const RECORDING_STORAGE_KEY = 'meeting-recording-backup';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  startRecording: (roomId?: string) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  getAudioBlob: () => Blob | null;
  getRecoveredRecording: () => Blob | null;
  clearRecoveredRecording: () => void;
}

// Convert blob to base64 for localStorage storage
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Convert base64 back to blob
const base64ToBlob = (base64: string): Blob => {
  const [header, data] = base64.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
  const byteCharacters = atob(data);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  return new Blob([byteNumbers], { type: mimeType });
};

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const isStoppingRef = useRef(false);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recoveredBlobRef = useRef<Blob | null>(null);
  
  // Server-side chunk upload refs
  const roomIdRef = useRef<string | null>(null);
  const chunkIndexRef = useRef(0);
  const serverUploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUploadedSizeRef = useRef(0);

  // Check for recovered recording on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECORDING_STORAGE_KEY);
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        // Only recover if less than 1 hour old
        if (Date.now() - timestamp < 3600000 && data) {
          recoveredBlobRef.current = base64ToBlob(data);
          console.log('Recovered recording from crash, size:', recoveredBlobRef.current.size);
        } else {
          localStorage.removeItem(RECORDING_STORAGE_KEY);
        }
      }
    } catch (e) {
      console.log('No recording to recover');
    }
  }, []);

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

  // Save recording to localStorage periodically (crash protection)
  // Skip backup if quota exceeded to prevent spam errors
  const quotaExceededRef = useRef(false);
  
  const saveBackup = useCallback(async () => {
    // Skip if we already know quota is exceeded
    if (quotaExceededRef.current) return;
    
    const blob = createBlobFromChunks();
    if (blob && blob.size > 0) {
      try {
        // Only save if blob is under 5MB (more conservative limit)
        if (blob.size < 5 * 1024 * 1024) {
          const base64 = await blobToBase64(blob);
          localStorage.setItem(RECORDING_STORAGE_KEY, JSON.stringify({
            data: base64,
            timestamp: Date.now()
          }));
          console.log('Backup saved, size:', blob.size);
        } else {
          console.log('Recording too large for backup:', blob.size);
          // Clear old backup to free space
          localStorage.removeItem(RECORDING_STORAGE_KEY);
        }
      } catch (e: any) {
        // Handle QuotaExceededError - stop trying to save
        if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
          console.log('LocalStorage quota exceeded, disabling backup');
          quotaExceededRef.current = true;
          // Try to clear old data to free space
          localStorage.removeItem(RECORDING_STORAGE_KEY);
        } else {
          console.log('Failed to save backup:', e);
        }
      }
    }
  }, [createBlobFromChunks]);

  // Clear backup after successful save
  const clearBackup = useCallback(() => {
    localStorage.removeItem(RECORDING_STORAGE_KEY);
    console.log('Recording backup cleared');
  }, []);

  // Upload current recording chunk to server storage
  const uploadChunkToServer = useCallback(async () => {
    const currentRoomId = roomIdRef.current;
    if (!currentRoomId) return;
    
    const blob = createBlobFromChunks();
    if (!blob || blob.size <= lastUploadedSizeRef.current) return; // No new data
    
    try {
      const chunkIdx = chunkIndexRef.current++;
      const fileName = `${currentRoomId}/chunk_${chunkIdx}_${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from('call-recordings')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          upsert: true,
        });
      
      if (error) {
        console.warn('[AudioRecorder] Chunk upload failed:', error.message);
      } else {
        lastUploadedSizeRef.current = blob.size;
        console.log('[AudioRecorder] Chunk uploaded to server:', fileName, 'size:', blob.size);
      }
    } catch (e) {
      console.warn('[AudioRecorder] Server upload error:', e);
    }
  }, [createBlobFromChunks]);

  const startRecording = useCallback(async (roomId?: string) => {
    try {
      // Reset state
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      isStoppingRef.current = false;
      roomIdRef.current = roomId || `recording_${Date.now()}`;
      chunkIndexRef.current = 0;
      lastUploadedSizeRef.current = 0;
      clearBackup();

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
        
        // Clear backup interval
        if (backupIntervalRef.current) {
          clearInterval(backupIntervalRef.current);
          backupIntervalRef.current = null;
        }
        // Clear server upload interval
        if (serverUploadIntervalRef.current) {
          clearInterval(serverUploadIntervalRef.current);
          serverUploadIntervalRef.current = null;
        }
      };

      // Handle when user stops microphone or track ends unexpectedly
      micStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.log('Audio track ended unexpectedly');
          // Save current chunks before stopping
          createBlobFromChunks();
          saveBackup(); // Save backup on unexpected end
          uploadChunkToServer(); // Upload final chunk to server
          
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
      
      // Start periodic backup every 5 seconds (localStorage)
      backupIntervalRef.current = setInterval(saveBackup, 5000);
      
      // Start periodic server upload every 30 seconds (crash-proof)
      serverUploadIntervalRef.current = setInterval(uploadChunkToServer, 30000);
      
      console.log('Microphone recording started, roomId:', roomIdRef.current);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [createBlobFromChunks, saveBackup, clearBackup, uploadChunkToServer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    isStoppingRef.current = true;
    
    // Clear backup interval
    if (backupIntervalRef.current) {
      clearInterval(backupIntervalRef.current);
      backupIntervalRef.current = null;
    }
    // Clear server upload interval
    if (serverUploadIntervalRef.current) {
      clearInterval(serverUploadIntervalRef.current);
      serverUploadIntervalRef.current = null;
    }
    
    // Final upload to server
    await uploadChunkToServer();
    
    return new Promise((resolve) => {
      // First, always try to create blob from existing chunks
      const existingBlob = createBlobFromChunks();
      
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        console.log('Recorder inactive, returning existing blob:', existingBlob?.size);
        setIsRecording(false);
        clearBackup(); // Clear backup on successful stop
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
        clearBackup(); // Clear backup on successful stop
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
  }, [createBlobFromChunks, clearBackup]);

  const getAudioBlob = useCallback(() => {
    // Always try to get the latest from chunks
    if (audioChunksRef.current.length > 0) {
      return createBlobFromChunks();
    }
    return audioBlobRef.current;
  }, [createBlobFromChunks]);

  const getRecoveredRecording = useCallback(() => {
    return recoveredBlobRef.current;
  }, []);

  const clearRecoveredRecording = useCallback(() => {
    recoveredBlobRef.current = null;
    localStorage.removeItem(RECORDING_STORAGE_KEY);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    getAudioBlob,
    getRecoveredRecording,
    clearRecoveredRecording,
  };
};
