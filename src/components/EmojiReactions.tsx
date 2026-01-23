import { useState, useEffect, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EmojiReaction {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
  y: number;
  timestamp: number;
}

interface EmojiReactionsProps {
  room: Room | null;
  participantName: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🔥', '💯', '🙌', '😮', '🤔', '👎', '😢'];

export function EmojiReactions({ room, participantName }: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Remove reactions after animation completes
  useEffect(() => {
    if (reactions.length === 0) return;
    
    const timer = setTimeout(() => {
      setReactions(prev => prev.filter(r => Date.now() - r.timestamp < 3500));
    }, 3500);

    return () => clearTimeout(timer);
  }, [reactions]);

  // Listen for incoming reactions
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'emoji_reaction') {
          const newReaction: EmojiReaction = {
            id: `${Date.now()}-${Math.random()}`,
            emoji: message.emoji,
            senderName: message.senderName,
            x: 10 + Math.random() * 80, // Random position 10-90% horizontal
            y: 15 + Math.random() * 30, // Random position 15-45% from bottom
            timestamp: Date.now(),
          };

          setReactions(prev => [...prev, newReaction]);
        }
      } catch {
        // Not a reaction message
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  // Send reaction
  const sendReaction = useCallback(async (emoji: string) => {
    if (!room) return;

    const reactionData = {
      type: 'emoji_reaction',
      emoji,
      senderName: participantName,
      timestamp: Date.now(),
    };

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(reactionData));
      
      await room.localParticipant.publishData(data, { reliable: true });

      // Also show locally
      const localReaction: EmojiReaction = {
        id: `${Date.now()}-local`,
        emoji,
        senderName: participantName,
        x: 10 + Math.random() * 80,
        y: 15 + Math.random() * 30,
        timestamp: Date.now(),
      };

      setReactions(prev => [...prev, localReaction]);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to send reaction:', err);
    }
  }, [room, participantName]);

  return (
    <>
      {/* Floating reactions overlay - covers the ENTIRE screen */}
      <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-emoji-float"
            style={{ 
              left: `${reaction.x}%`, 
              bottom: `${reaction.y}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-6xl drop-shadow-2xl">{reaction.emoji}</span>
              <span className="text-xs text-white/80 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm mt-1 font-medium">
                {reaction.senderName}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Emoji picker button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full border-white/20 bg-white/10 hover:bg-white/20 transition-all hover:scale-105"
          >
            <Smile className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-3 glass-dark border-white/10 rounded-2xl" 
          side="top"
          align="center"
          sideOffset={12}
        >
          <div className="grid grid-cols-6 gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className={cn(
                  "text-2xl p-2.5 rounded-xl transition-all",
                  "hover:bg-white/20 hover:scale-125 active:scale-95"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

export default EmojiReactions;
