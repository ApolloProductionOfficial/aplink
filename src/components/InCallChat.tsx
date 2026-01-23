import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { MessageCircle, Send, X, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConnectionSounds } from "@/hooks/useConnectionSounds";

interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text: string;
  timestamp: Date;
  isLocal: boolean;
}

interface InCallChatProps {
  room: Room | null;
  participantName: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function InCallChat({ room, participantName, isOpen, onToggle }: InCallChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playMessageSound } = useConnectionSounds();

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
          };

          setMessages(prev => [...prev, newMessage]);
          
          // Play sound and increment unread if chat is closed
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

  // Send message
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
      };

      setMessages(prev => [...prev, localMessage]);
      setInputValue("");
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [room, inputValue, participantName]);

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

  // Only render button when chat is closed (button goes in bottom panel)
  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        variant="outline"
        size="icon"
        className="relative w-12 h-12 rounded-full border-white/20 bg-white/10 hover:bg-white/20 transition-all hover:scale-105"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    );
  }

  // Draggable chat panel (when open)
  return (
    <div
      className={cn(
        "fixed z-[60] w-80 h-[420px] glass-dark rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden",
        isDragging && "cursor-grabbing select-none"
      )}
      style={{
        right: `calc(1rem - ${position.x}px)`,
        bottom: `calc(6rem - ${position.y}px)`,
      }}
    >
      {/* Header - drag handle */}
      <div
        className="flex items-center justify-between p-3 border-b border-white/10 cursor-grab active:cursor-grabbing bg-black/20"
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
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                    msg.isLocal
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-white/10 rounded-bl-md"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/10 bg-black/20">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Сообщение..."
            className="flex-1 h-10 bg-white/10 border-white/10 rounded-full px-4 text-sm focus:border-primary/50"
          />
          <Button
            onClick={sendMessage}
            size="icon"
            className="h-10 w-10 rounded-full shrink-0"
            disabled={!inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
