import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { MessageCircle, Send, X, GripHorizontal, Smile, Mic, Square, Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";

const CHAT_EMOJIS = ['😀', '😂', '❤️', '🔥', '👍', '💰', '🍑', '🍆', '💎', '💋', '🥵', '💸', '👑', '🎬', '🚀'];

interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text?: string;
  timestamp: Date;
  isLocal: boolean;
  type: 'text' | 'voice';
  audioData?: string; // base64 audio
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playMessageSound } = useConnectionSounds();

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
            audioData: message.audioData,
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

  // Voice message recording - click to start/stop
  const toggleVoiceRecording = useCallback(async () => {
    if (isRecordingVoice) {
      // Stop recording
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
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        recordingStartRef.current = Date.now();
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = async () => {
          setIsRecordingVoice(false);
          stream.getTracks().forEach(track => track.stop());
          
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          
          if (audioChunksRef.current.length === 0) return;
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            if (room) {
              const messageData = {
                type: 'voice_message',
                senderName: participantName,
                senderIdentity: room.localParticipant.identity,
                audioData: base64Audio,
                duration,
                timestamp: new Date().toISOString(),
              };
              
              const encoder = new TextEncoder();
              await room.localParticipant.publishData(encoder.encode(JSON.stringify(messageData)), { reliable: true });
              
              setMessages(prev => [...prev, {
                id: `${Date.now()}-voice`,
                senderName: participantName,
                senderIdentity: room.localParticipant.identity,
                timestamp: new Date(),
                isLocal: true,
                type: 'voice',
                audioData: base64Audio,
                audioDuration: duration,
              }]);
            }
          };
          reader.readAsDataURL(audioBlob);
        };
        
        recorder.start(100);
        mediaRecorderRef.current = recorder;
        setIsRecordingVoice(true);
        setRecordingDuration(0);
        
        // Update duration display
        recordingIntervalRef.current = setInterval(() => {
          setRecordingDuration(Math.round((Date.now() - recordingStartRef.current) / 1000));
        }, 1000);
        
      } catch (err) {
        console.error('Failed to start voice recording:', err);
      }
    }
  }, [isRecordingVoice, room, participantName]);

  // Play/pause voice message
  const togglePlayVoice = useCallback((messageId: string, audioData: string) => {
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
      
      // Play new
      const audio = new Audio(audioData);
      audio.onended = () => {
        setPlayingMessageId(null);
        audioRef.current = null;
      };
      audio.play();
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

  // Button component (used in both modes)
  const ChatButton = (
    <Button
      onClick={onToggle}
      variant="outline"
      size="icon"
      className={cn(
        "relative w-12 h-12 rounded-full border-white/[0.12] transition-all hover:scale-105 hover:shadow-lg",
        isOpen 
          ? "bg-primary/20 border-primary/50" 
          : "bg-white/10 hover:bg-white/20"
      )}
    >
      <MessageCircle className="w-5 h-5" />
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
  return (
    <div
      className={cn(
        "fixed z-[60] w-80 h-[420px] bg-black/40 backdrop-blur-2xl rounded-[1.5rem] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_1px_rgba(255,255,255,0.1)] flex flex-col overflow-hidden",
        isDragging && "cursor-grabbing select-none"
      )}
      style={{
        right: `calc(1rem - ${position.x}px)`,
        bottom: `calc(6rem - ${position.y}px)`,
      }}
    >
      {/* Header - drag handle */}
      <div
        className="flex items-center justify-between p-3 border-b border-white/[0.08] cursor-grab active:cursor-grabbing bg-black/30"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-white/30" />
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Чат</span>
          <span className="text-xs text-muted-foreground">({messages.length})</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-white/10"
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
                      onClick={() => msg.audioData && togglePlayVoice(msg.id, msg.audioData)}
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
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        🎤 {formatDuration(msg.audioDuration || 0)}
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
            <PopoverContent side="top" align="end" className="w-auto p-2 bg-black/80 backdrop-blur-xl border-white/10 rounded-xl">
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
              <Mic className="w-4 h-4" />
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
            <span className="text-muted-foreground ml-1">нажмите ещё раз для отправки</span>
          </div>
        )}
      </div>
    </div>
  );
}
