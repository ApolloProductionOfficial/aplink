import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface VoiceCommandsOptions {
  onMuteToggle: () => void;
  onCameraToggle: () => void;
  onRaiseHand: () => void;
  onScreenShare: () => void;
  onLeave: () => void;
  enabled?: boolean;
  language?: string;
}

// Voice command patterns (Russian + English)
const COMMAND_PATTERNS = {
  mute: [
    /выключ(и|ить)?\s*(микрофон|звук|мик)/i,
    /включ(и|ить)?\s*(микрофон|звук|мик)/i,
    /заглуш(и|ить)/i,
    /mute/i,
    /unmute/i,
    /toggle\s*mic/i,
    /микрофон/i,
  ],
  camera: [
    /выключ(и|ить)?\s*(камер[ау]|видео)/i,
    /включ(и|ить)?\s*(камер[ау]|видео)/i,
    /камер[ау]/i,
    /camera/i,
    /video/i,
    /toggle\s*camera/i,
  ],
  raiseHand: [
    /подн(ими|ять)?\s*руку/i,
    /опусти(ть)?\s*руку/i,
    /руку?\s*(вверх|поднять)/i,
    /raise\s*hand/i,
    /lower\s*hand/i,
    /hand/i,
  ],
  screenShare: [
    /показ(ать|ывай)?\s*экран/i,
    /(поделись|делиться)\s*экран/i,
    /демонстраци[яю]/i,
    /share\s*screen/i,
    /screen\s*share/i,
    /экран/i,
  ],
  leave: [
    /выйти/i,
    /покинуть/i,
    /уйти/i,
    /leave/i,
    /exit/i,
    /disconnect/i,
  ],
};

export function useVoiceCommands({
  onMuteToggle,
  onCameraToggle,
  onRaiseHand,
  onScreenShare,
  onLeave,
  enabled = true,
  language = 'ru-RU',
}: VoiceCommandsOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const processCommand = useCallback((transcript: string) => {
    const text = transcript.toLowerCase().trim();
    console.log('[VoiceCommands] Received:', text);

    // Check each command pattern
    for (const pattern of COMMAND_PATTERNS.mute) {
      if (pattern.test(text)) {
        onMuteToggle();
        toast({ title: '🎤 Микрофон', description: 'Голосовая команда выполнена' });
        return true;
      }
    }

    for (const pattern of COMMAND_PATTERNS.camera) {
      if (pattern.test(text)) {
        onCameraToggle();
        toast({ title: '📹 Камера', description: 'Голосовая команда выполнена' });
        return true;
      }
    }

    for (const pattern of COMMAND_PATTERNS.raiseHand) {
      if (pattern.test(text)) {
        onRaiseHand();
        toast({ title: '✋ Рука', description: 'Голосовая команда выполнена' });
        return true;
      }
    }

    for (const pattern of COMMAND_PATTERNS.screenShare) {
      if (pattern.test(text)) {
        onScreenShare();
        toast({ title: '🖥️ Экран', description: 'Голосовая команда выполнена' });
        return true;
      }
    }

    for (const pattern of COMMAND_PATTERNS.leave) {
      if (pattern.test(text)) {
        // Confirm before leaving
        toast({ 
          title: '🚪 Выход', 
          description: 'Скажите "да" или "подтверждаю" для выхода',
        });
        return true;
      }
    }

    return false;
  }, [onMuteToggle, onCameraToggle, onRaiseHand, onScreenShare, onLeave]);

  const startListening = useCallback(() => {
    if (!isSupported || !enabled) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onstart = () => {
        console.log('[VoiceCommands] Started listening');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        processCommand(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceCommands] Error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          // Restart on recoverable errors
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (enabled) startListening();
          }, 1000);
        }
      };

      recognition.onend = () => {
        console.log('[VoiceCommands] Ended');
        setIsListening(false);
        // Auto-restart for continuous listening
        if (enabled) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (enabled) startListening();
          }, 500);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[VoiceCommands] Failed to start:', err);
    }
  }, [isSupported, enabled, language, processCommand]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
