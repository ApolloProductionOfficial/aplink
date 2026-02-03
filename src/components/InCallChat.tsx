import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { MessageCircle, Send, X, GripHorizontal, Smile, Mic, Square, Play, Pause, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const CHAT_EMOJIS = ['😀', '😂', '❤️', '🔥', '👍', '💰', '🍑', '🍆', '💎', '💋', '🥵', '💸', '👑', '🎬', '🚀'];

interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text?: string;
  timestamp: Date;
  isLocal: boolean;
  type: 'text' | 'voice';
  audioData?: string; // base64 audio (legacy)
  audioUrl?: string; // URL to audio file in storage
  audioDuration?: number;
}

interface InCallChatProps {
  room: Room | null;
  participantName: string;
  isOpen: boolean;
  onToggle: () => void;
  /** If true, only renders the toggle button (for use in bottom panel) */
  buttonOnly?: boolean;
}

export function InCallChat({ room, participantName, isOpen, onToggle, buttonOnly = false }: InCallChatProps) {
  const isMobile = useIsMobile();
  
  // Use ref for initial messages to preserve across remounts
  const roomId = room?.name || 'default';
  const storageKey = `aplink-chat-${roomId}`;
  
  // Load persisted messages from sessionStorage on mount
  const loadPersistedMessages = (): ChatMessage[] => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch {}
    return [];
  };
  
  const [messages, setMessages] = useState<ChatMessage[]>(loadPersistedMessages);
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playMessageSound } = useConnectionSounds();

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, storageKey]);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Voice preview state (stop recording but don't send yet)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [recordingSize, setRecordingSize] = useState(0);
  const [isSendingVoice, setIsSendingVoice] = useState(false);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  // Receive messages from other participants
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'chat_message') {
          const newMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            senderName: message.senderName,
            senderIdentity: message.senderIdentity,
            text: message.text,
            timestamp: new Date(message.timestamp),
            isLocal: false,
            type: 'text',
          };

          setMessages(prev => [...prev, newMessage]);
          
          // Play sound and increment unread if chat is closed
          if (!isOpen) {
            setUnreadCount(prev => prev + 1);
            playMessageSound();
          }
        } else if (message.type === 'voice_message') {
          const newMessage: ChatMessage = {
            id: `${Date.now()}-${Math.random()}`,
            senderName: message.senderName,
            senderIdentity: message.senderIdentity,
            timestamp: new Date(message.timestamp),
            isLocal: false,
            type: 'voice',
            audioData: message.audioData, // Legacy base64
            audioUrl: message.audioUrl, // New URL-based
            audioDuration: message.duration,
          };

          setMessages(prev => [...prev, newMessage]);
          
          if (!isOpen) {
            setUnreadCount(prev => prev + 1);
            playMessageSound();
          }
        }
      } catch {
        // Not a chat message
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isOpen, playMessageSound]);

  // Clear unread count when chat opens
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(scrollToBottom, 100);
      inputRef.current?.focus();
    }
  }, [isOpen, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, scrollToBottom]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.startPosX + deltaX,
        y: dragRef.current.startPosY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Send text message
  const sendMessage = useCallback(async () => {
    if (!room || !inputValue.trim()) return;

    const messageData = {
      type: 'chat_message',
      senderName: participantName,
      senderIdentity: room.localParticipant.identity,
      text: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(messageData));
      
      await room.localParticipant.publishData(data, { reliable: true });

      // Add to local messages
      const localMessage: ChatMessage = {
        id: `${Date.now()}-local`,
        senderName: participantName,
        senderIdentity: room.localParticipant.identity,
        text: inputValue.trim(),
        timestamp: new Date(),
        isLocal: true,
        type: 'text',
      };

      setMessages(prev => [...prev, localMessage]);
      setInputValue("");
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [room, inputValue, participantName]);

  // Voice message recording - click to start/stop (saves to preview, not auto-send)
  const toggleVoiceRecording = useCallback(async () => {
    if (isRecordingVoice) {
      // Stop recording - save for preview, don't send
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      setIsRecordingVoice(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        recordingStartRef.current = Date.now();
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
            // Update size indicator
            const totalSize = audioChunksRef.current.reduce((acc, chunk) => acc + chunk.size, 0);
            setRecordingSize(totalSize);
          }
        };
        
        recorder.onstop = async () => {
          setIsRecordingVoice(false);
          stream.getTracks().forEach(track => track.stop());
          activeStreamRef.current = null;
          
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          
          if (audioChunksRef.current.length === 0) return;
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
          
          // Save to preview state instead of auto-sending
          setRecordedBlob(audioBlob);
          setRecordedDuration(duration);
        };
        
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecordingVoice(true);
        setRecordingDuration(0);
        setRecordingSize(0);
        
        // Update duration display
        recordingIntervalRef.current = setInterval(() => {
          setRecordingDuration(Math.round((Date.now() - recordingStartRef.current) / 1000));
        }, 1000);
        
      } catch (err) {
        console.error('Failed to start voice recording:', err);
      }
    }
  }, [isRecordingVoice]);

  // Play/stop preview of recorded voice
  const togglePreviewPlay = useCallback(() => {
    if (!recordedBlob) return;
    
    if (isPreviewPlaying && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewPlaying(false);
    } else {
      const url = URL.createObjectURL(recordedBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsPreviewPlaying(false);
        previewAudioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.play();
      previewAudioRef.current = audio;
      setIsPreviewPlaying(true);
    }
  }, [recordedBlob, isPreviewPlaying]);

  // Discard recorded voice message
  const discardRecording = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setRecordedBlob(null);
    setRecordedDuration(0);
    setIsPreviewPlaying(false);
  }, []);

  // Send the recorded voice message via Supabase Storage (no size limit)
  const sendVoiceMessage = useCallback(async () => {
    if (!recordedBlob || !room) return;
    
    setIsSendingVoice(true);
    
    try {
      // Generate unique filename
      const fileName = `voice-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, recordedBlob, {
          contentType: 'audio/webm',
          cacheControl: '3600'
        });
      
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(fileName);
      
      // Send only URL via Data Channel (very small payload)
      const messageData = {
        type: 'voice_message',
        senderName: participantName,
        senderIdentity: room.localParticipant.identity,
        audioUrl: publicUrl,
        duration: recordedDuration,
        timestamp: new Date().toISOString(),
      };
      
      const encoder = new TextEncoder();
      await room.localParticipant.publishData(
        encoder.encode(JSON.stringify(messageData)), 
        { reliable: true }
      );
      
      // Add to local messages
      setMessages(prev => [...prev, {
        id: `${Date.now()}-voice`,
        senderName: participantName,
        senderIdentity: room.localParticipant.identity,
        timestamp: new Date(),
        isLocal: true,
        type: 'voice',
        audioUrl: publicUrl,
        audioDuration: recordedDuration,
      }]);
      
      discardRecording();
      toast.success('Голосовое отправлено');
    } catch (err) {
      console.error('Failed to send voice message:', err);
      toast.error('Не удалось отправить голосовое');
    } finally {
      setIsSendingVoice(false);
    }
  }, [recordedBlob, recordedDuration, room, participantName, discardRecording]);

  // Play/pause voice message - supports both audioUrl and audioData
  const togglePlayVoice = useCallback((messageId: string, audioSource: string) => {
    if (playingMessageId === messageId) {
      // Pause current
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingMessageId(null);
    } else {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Play new - audioSource can be URL or base64 data URI
      const audio = new Audio(audioSource);
      audio.onended = () => {
        setPlayingMessageId(null);
        audioRef.current = null;
      };
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        toast.error('Не удалось воспроизвести');
      });
      audioRef.current = audio;
      setPlayingMessageId(messageId);
    }
  }, [playingMessageId]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Button component (used in both modes) - with glow animation when unread
  const ChatButton = (
    <Button
      onClick={onToggle}
      variant="outline"
      size="icon"
      className={cn(
        "relative w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
        isOpen 
          ? "bg-primary/20 border-primary/50" 
          : "bg-white/10 hover:bg-white/20",
        // Pulsing glow when there are unread messages
        unreadCount > 0 && !isOpen && "animate-pulse shadow-[0_0_20px_hsl(var(--primary)/0.6)] border-primary/50"
      )}
    >
      <MessageCircle className={cn(
        "w-5 h-5",
        unreadCount > 0 && !isOpen && "text-primary"
      )} />
      {unreadCount > 0 && !isOpen && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse font-bold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  // If buttonOnly mode, always return just the button
  if (buttonOnly) {
    return ChatButton;
  }

  // If not open and not buttonOnly, return button
  if (!isOpen) {
    return ChatButton;
  }

  // Draggable chat panel (when open)
  // Mobile: fullscreen bottom sheet | Desktop: draggable panel
  return (
    <div
      className={cn(
        "fixed z-[60] bg-black/40 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden",
        // Mobile: full-width bottom sheet (reduced height for usability)
        isMobile 
          ? "inset-x-0 bottom-0 h-[50vh] max-h-[400px] rounded-t-[1.5rem] animate-slide-up" 
          : "w-80 h-[420px] rounded-[1.5rem]",
        isDragging && !isMobile && "cursor-grabbing select-none"
      )}
      style={isMobile ? {} : {
        right: `calc(1rem - ${position.x}px)`,
        bottom: `calc(6rem - ${position.y}px)`,
      }}
    >
      {/* Header - drag handle (desktop only) */}
      <div
        className={cn(
          "flex items-center justify-between p-3 sm:p-3 border-b border-white/[0.08] bg-black/30",
          !isMobile && "cursor-grab active:cursor-grabbing"
        )}
        onMouseDown={isMobile ? undefined : handleDragStart}
      >
        <div className="flex items-center gap-2">
          {/* Mobile: drag indicator bar, Desktop: grip icon */}
          {isMobile ? (
            <div className="w-10 h-1 bg-white/30 rounded-full mx-auto" />
          ) : (
            <GripHorizontal className="w-4 h-4 text-white/30" />
          )}
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Чат</span>
          <span className="text-xs text-muted-foreground">({messages.length})</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-7 sm:w-7 rounded-full hover:bg-white/10"
          onClick={onToggle}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Нет сообщений</p>
            <p className="text-xs mt-1">Начните общение!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1",
                  msg.isLocal ? "items-end" : "items-start"
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {msg.isLocal ? "Вы" : msg.senderName}
                  </span>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                
                {msg.type === 'text' ? (
                  <div
                    className={cn(
                      "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                      msg.isLocal
                        ? "bg-primary/40 text-white rounded-br-md border border-primary/20"
                        : "bg-white/10 rounded-bl-md"
                    )}
                  >
                    {msg.text}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-2xl",
                      msg.isLocal
                        ? "bg-primary/40 rounded-br-md border border-primary/20"
                        : "bg-white/10 rounded-bl-md"
                    )}
                  >
                    <button 
                      onClick={() => {
                        const audioSource = msg.audioUrl || msg.audioData;
                        if (audioSource) togglePlayVoice(msg.id, audioSource);
                      }}
                      className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                    >
                      {playingMessageId === msg.id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 ml-0.5" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full bg-white/60 rounded-full transition-all",
                            playingMessageId === msg.id && "animate-pulse"
                          )}
                          style={{ width: playingMessageId === msg.id ? '100%' : '0%' }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        {/* Custom neon microphone icon */}
                        <svg viewBox="0 0 24 24" className="w-3 h-3">
                          <defs>
                            <linearGradient id="mic-neon" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#06b6e4"/>
                              <stop offset="100%" stopColor="#8b5cf6"/>
                            </linearGradient>
                            <filter id="mic-glow">
                              <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                              <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <path 
                            d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1ZM17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.92V22H13V18.92C16.39 18.43 19 15.53 19 12H17Z"
                            fill="url(#mic-neon)"
                            filter="url(#mic-glow)"
                          />
                        </svg>
                        {formatDuration(msg.audioDuration || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.08] bg-black/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Сообщение..."
            className="flex-1 h-10 bg-white/10 border-white/[0.08] rounded-full px-4 text-sm focus:border-primary/50"
            disabled={isRecordingVoice}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full shrink-0 hover:bg-white/10">
                <Smile className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]">
              <div className="grid grid-cols-5 gap-1">
                {CHAT_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setInputValue(prev => prev + emoji)}
                    className="text-xl p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Voice message button - click to toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shrink-0 transition-all",
              isRecordingVoice 
                ? "bg-destructive/40 hover:bg-destructive/50 animate-pulse" 
                : "hover:bg-white/10"
            )}
            onClick={toggleVoiceRecording}
            title={isRecordingVoice ? "Остановить запись" : "Записать голосовое"}
          >
            {isRecordingVoice ? (
              <Square className="w-4 h-4 text-destructive" />
            ) : (
              /* Custom neon microphone icon */
              <svg viewBox="0 0 24 24" className="w-4 h-4">
                <defs>
                  <linearGradient id="chat-mic-neon" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6e4"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
                  </linearGradient>
                  <filter id="chat-mic-glow">
                    <feGaussianBlur stdDeviation="0.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <path 
                  d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1ZM17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.92V22H13V18.92C16.39 18.43 19 15.53 19 12H17Z"
                  fill="url(#chat-mic-neon)"
                  filter="url(#chat-mic-glow)"
                />
              </svg>
            )}
          </Button>
          
          <Button
            onClick={sendMessage}
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            disabled={!inputValue.trim() || isRecordingVoice}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Recording indicator */}
        {isRecordingVoice && (
          <div className="mt-2 text-xs text-destructive flex items-center gap-1.5 justify-center">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            Запись... {formatDuration(recordingDuration)}
            <span className="text-muted-foreground ml-2">
              {(recordingSize / 1024).toFixed(1)} KB
            </span>
            <span className="text-muted-foreground ml-1">• нажмите ■</span>
          </div>
        )}
        
        {/* Voice message preview - shows after recording stops */}
        {recordedBlob && !isRecordingVoice && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
            {/* Play/Pause preview */}
            <button 
              onClick={togglePreviewPlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              title={isPreviewPlaying ? "Пауза" : "Прослушать"}
            >
              {isPreviewPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
            
            {/* Duration and waveform placeholder */}
            <div className="flex-1 flex items-center gap-2">
              <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full bg-primary/60 rounded-full transition-all",
                    isPreviewPlaying && "animate-pulse"
                  )}
                  style={{ width: isPreviewPlaying ? '100%' : '0%' }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDuration(recordedDuration)}
              </span>
            </div>
            
            {/* Delete */}
            <button 
              onClick={discardRecording}
              className="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-all"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
            
            {/* Send */}
            <button 
              onClick={sendVoiceMessage}
              disabled={isSendingVoice}
              className={cn(
                "w-8 h-8 rounded-full bg-primary hover:bg-primary/80 flex items-center justify-center transition-all",
                isSendingVoice && "opacity-50 cursor-not-allowed"
              )}
              title="Отправить"
            >
              {isSendingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
