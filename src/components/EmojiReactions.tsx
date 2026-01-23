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
      setReactions(prev => prev.filter(r => Date.now() - r.timestamp < 2500));
    }, 2500);

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
            x: 20 + Math.random() * 60, // Random position 20-80%
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
        x: 20 + Math.random() * 60,
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
      {/* Floating reactions overlay */}
      <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-emoji-float"
            style={{ 
              left: `${reaction.x}%`, 
              bottom: '25%',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-5xl drop-shadow-lg">{reaction.emoji}</span>
              <span className="text-xs text-white/80 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm mt-1">
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
            className="w-12 h-12 rounded-xl border-border/50 bg-card hover:bg-card/80 transition-all"
          >
            <Smile className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-64 p-2 glass-dark border-border/50" 
          side="top"
          align="center"
        >
          <div className="grid grid-cols-6 gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className={cn(
                  "text-2xl p-2 rounded-lg transition-all",
                  "hover:bg-primary/20 hover:scale-110 active:scale-95"
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
