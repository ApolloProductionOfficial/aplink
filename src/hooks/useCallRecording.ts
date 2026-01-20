import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseCallRecordingOptions {
  userId: string | undefined;
  roomName: string;
  onRecordingSaved?: (url: string) => void;
}

export const useCallRecording = ({ userId, roomName, onRecordingSaved }: UseCallRecordingOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    if (!userId) {
      toast.error("Необходимо авторизоваться для записи");
      return false;
    }

    try {
      // Get display media (captures all audio from the call)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required but we only use audio
        audio: true,
      });

      // Get microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Create AudioContext to mix streams
      audioContextRef.current = new AudioContext();
      const destination = audioContextRef.current.createMediaStreamDestination();

      // Add display audio
      const displayAudioTracks = displayStream.getAudioTracks();
      if (displayAudioTracks.length > 0) {
        const displaySource = audioContextRef.current.createMediaStreamSource(
          new MediaStream([displayAudioTracks[0]])
        );
        displaySource.connect(destination);
      }

      // Add microphone audio
      const micSource = audioContextRef.current.createMediaStreamSource(micStream);
      micSource.connect(destination);

      combinedStreamRef.current = destination.stream;

      // Stop video track (we only need audio)
      displayStream.getVideoTracks().forEach(track => track.stop());

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStreamRef.current, {
        mimeType: "audio/webm;codecs=opus",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await uploadRecording(audioBlob);
        
        // Cleanup
        micStream.getTracks().forEach(track => track.stop());
        displayStream.getTracks().forEach(track => track.stop());
        audioContextRef.current?.close();
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingStartTime(new Date());
      
      toast.success("Запись началась");
      return true;
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Не удалось начать запись. Проверьте разрешения.");
      return false;
    }
  }, [userId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const uploadRecording = async (audioBlob: Blob) => {
    if (!userId) return;

    setIsUploading(true);

    try {
      const fileName = `${userId}/${roomName}-${Date.now()}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from("call-recordings")
        .upload(fileName, audioBlob, {
          contentType: "audio/webm",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the URL
      const { data: urlData } = supabase.storage
        .from("call-recordings")
        .getPublicUrl(fileName);

      // Calculate duration
      const durationSeconds = recordingStartTime 
        ? Math.round((new Date().getTime() - recordingStartTime.getTime()) / 1000)
        : 0;

      toast.success(`Запись сохранена (${formatDuration(durationSeconds)})`);
      
      onRecordingSaved?.(urlData.publicUrl);
      
      return {
        url: urlData.publicUrl,
        durationSeconds,
      };
    } catch (error) {
      console.error("Error uploading recording:", error);
      toast.error("Не удалось сохранить запись");
      return null;
    } finally {
      setIsUploading(false);
      setRecordingStartTime(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRecordingDuration = useCallback(() => {
    if (!recordingStartTime) return 0;
    return Math.round((new Date().getTime() - recordingStartTime.getTime()) / 1000);
  }, [recordingStartTime]);

  return {
    isRecording,
    isUploading,
    startRecording,
    stopRecording,
    getRecordingDuration,
    recordingStartTime,
  };
};
