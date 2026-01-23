import { useState, useRef, useEffect, useCallback } from "react";
import { Room, RoomEvent, DataPacket_Kind } from "livekit-client";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
          
          if (!isOpen) {
            setUnreadCount(prev => prev + 1);
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
  }, [room, isOpen]);

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

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        onClick={onToggle}
        variant={isOpen ? "default" : "outline"}
        size="icon"
        className={cn(
          "relative w-12 h-12 rounded-xl border-border/50 transition-all",
          isOpen ? "bg-primary/20 border-primary/50" : "bg-card hover:bg-card/80"
        )}
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed right-4 bottom-24 z-[60] w-80 h-96 glass-dark rounded-2xl border border-border/50 flex flex-col overflow-hidden animate-scale-in shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Чат</span>
              <span className="text-xs text-muted-foreground">({messages.length})</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
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
                        "max-w-[85%] px-3 py-2 rounded-xl text-sm",
                        msg.isLocal
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/50 rounded-bl-sm"
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
          <div className="p-3 border-t border-border/30">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                className="flex-1 h-9 bg-background/50 border-border/50"
              />
              <Button
                onClick={sendMessage}
                size="icon"
                className="h-9 w-9"
                disabled={!inputValue.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
