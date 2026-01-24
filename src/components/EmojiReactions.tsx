import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Room, RoomEvent } from "livekit-client";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CustomReaction {
  id: string;
  label: string;
  svg: React.ReactNode;
  glowColor: string;
}

// Custom neon SVG reactions
const CUSTOM_REACTIONS: CustomReaction[] = [
  {
    id: 'money',
    label: 'Деньги',
    svg: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <circle cx="24" cy="24" r="20" stroke="#00ff88" strokeWidth="2" opacity="0.6"/>
        <circle cx="24" cy="24" r="16" stroke="#00ff88" strokeWidth="1" opacity="0.3"/>
        <text x="24" y="32" textAnchor="middle" fill="#00ff88" fontSize="24" fontWeight="bold" fontFamily="Arial">$</text>
      </svg>
    ),
    glowColor: 'rgba(0, 255, 136, 0.6)'
  },
  {
    id: 'fire',
    label: 'Огонь',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="fire-grad-main" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ff4400"/>
            <stop offset="50%" stopColor="#ff8800"/>
            <stop offset="100%" stopColor="#ffcc00"/>
          </linearGradient>
          <linearGradient id="fire-grad-inner" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#ffcc00"/>
            <stop offset="100%" stopColor="#ffffff"/>
          </linearGradient>
        </defs>
        <path d="M24 4 C18 14 10 20 10 30 C10 40 16 46 24 46 C32 46 38 40 38 30 C38 20 30 14 24 4" 
              fill="url(#fire-grad-main)" className="animate-pulse"/>
        <path d="M24 18 C21 24 16 28 16 34 C16 40 19 44 24 44 C29 44 32 40 32 34 C32 28 27 24 24 18" 
              fill="url(#fire-grad-inner)" opacity="0.9"/>
      </svg>
    ),
    glowColor: 'rgba(255, 136, 0, 0.7)'
  },
  {
    id: 'peach',
    label: 'Персик',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="peach-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb6c1"/>
            <stop offset="100%" stopColor="#ff6b8a"/>
          </linearGradient>
        </defs>
        <ellipse cx="24" cy="28" rx="14" ry="16" fill="url(#peach-grad)"/>
        <ellipse cx="20" cy="28" rx="10" ry="14" fill="#ff8fa3" opacity="0.5"/>
        <path d="M24 12 Q28 8 26 4" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <ellipse cx="25" cy="6" rx="3" ry="2" fill="#4ade80" opacity="0.8"/>
      </svg>
    ),
    glowColor: 'rgba(255, 107, 138, 0.6)'
  },
  {
    id: 'eggplant',
    label: 'Баклажан',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="eggplant-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7"/>
            <stop offset="100%" stopColor="#6b21a8"/>
          </linearGradient>
        </defs>
        <ellipse cx="24" cy="30" rx="11" ry="15" fill="url(#eggplant-grad)" transform="rotate(-15 24 30)"/>
        <ellipse cx="22" cy="28" rx="6" ry="10" fill="#c084fc" opacity="0.3" transform="rotate(-15 22 28)"/>
        <path d="M24 15 L20 9 M24 15 L28 9 M24 15 L24 6" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="24" cy="6" r="3" fill="#4ade80"/>
      </svg>
    ),
    glowColor: 'rgba(168, 85, 247, 0.6)'
  },
  {
    id: 'rocket',
    label: 'Ракета',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="rocket-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#e0e7ff"/>
            <stop offset="100%" stopColor="#a5b4fc"/>
          </linearGradient>
          <linearGradient id="rocket-fire" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffcc00"/>
            <stop offset="100%" stopColor="#ff4400"/>
          </linearGradient>
        </defs>
        <path d="M24 4 L18 18 L14 22 L16 32 L22 28 L26 28 L32 32 L34 22 L30 18 Z" 
              fill="url(#rocket-grad)" stroke="#818cf8" strokeWidth="1"/>
        <circle cx="24" cy="16" r="4" fill="#818cf8"/>
        <circle cx="24" cy="16" r="2" fill="#c7d2fe"/>
        <path d="M20 32 L24 46 L28 32" fill="url(#rocket-fire)" className="animate-pulse"/>
        <path d="M22 34 L24 42 L26 34" fill="#ffff00" opacity="0.8"/>
      </svg>
    ),
    glowColor: 'rgba(129, 140, 248, 0.6)'
  },
  {
    id: 'crown',
    label: 'Корона',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="crown-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd700"/>
            <stop offset="100%" stopColor="#ffaa00"/>
          </linearGradient>
        </defs>
        <path d="M6 38 L10 14 L18 24 L24 6 L30 24 L38 14 L42 38 Z" 
              fill="url(#crown-grad)" stroke="#ffd700" strokeWidth="1"/>
        <circle cx="24" cy="6" r="3" fill="#fff5cc"/>
        <circle cx="10" cy="14" r="2.5" fill="#fff5cc"/>
        <circle cx="38" cy="14" r="2.5" fill="#fff5cc"/>
        <rect x="8" y="36" width="32" height="4" rx="1" fill="#ffcc00"/>
        <circle cx="16" cy="30" r="2" fill="#ff6b6b"/>
        <circle cx="24" cy="28" r="2.5" fill="#4ade80"/>
        <circle cx="32" cy="30" r="2" fill="#60a5fa"/>
      </svg>
    ),
    glowColor: 'rgba(255, 215, 0, 0.6)'
  },
  {
    id: 'diamond',
    label: 'Алмаз',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="diamond-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9"/>
            <stop offset="50%" stopColor="#06b6d4"/>
            <stop offset="100%" stopColor="#0891b2"/>
          </linearGradient>
        </defs>
        <path d="M12 16 L24 4 L36 16 L24 46 Z" fill="url(#diamond-grad)" stroke="#22d3ee" strokeWidth="1"/>
        <path d="M12 16 L24 24 L36 16" stroke="#a5f3fc" strokeWidth="1.5" fill="none"/>
        <path d="M24 24 L24 46" stroke="#a5f3fc" strokeWidth="1.5"/>
        <path d="M18 10 L24 16 L30 10" stroke="#a5f3fc" strokeWidth="1" fill="none" opacity="0.6"/>
        <polygon points="16,16 24,4 24,24" fill="#a5f3fc" opacity="0.3"/>
      </svg>
    ),
    glowColor: 'rgba(6, 182, 212, 0.6)'
  },
  {
    id: 'kiss',
    label: 'Поцелуй',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="kiss-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff6b8a"/>
            <stop offset="100%" stopColor="#ff1744"/>
          </linearGradient>
        </defs>
        <path d="M24 44 C8 32 4 20 12 12 C18 6 24 10 24 16 C24 10 30 6 36 12 C44 20 40 32 24 44" 
              fill="url(#kiss-grad)"/>
        <path d="M18 20 C18 16 22 14 24 18 C26 14 30 16 30 20" 
              fill="#ffb6c1" opacity="0.5"/>
        <ellipse cx="16" cy="22" rx="3" ry="2" fill="#ff8fa3" opacity="0.6"/>
        <ellipse cx="32" cy="22" rx="3" ry="2" fill="#ff8fa3" opacity="0.6"/>
      </svg>
    ),
    glowColor: 'rgba(255, 23, 68, 0.6)'
  },
  {
    id: 'star',
    label: 'Звезда',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047"/>
            <stop offset="100%" stopColor="#facc15"/>
          </linearGradient>
        </defs>
        <path d="M24 4 L28 18 L44 18 L32 28 L36 44 L24 34 L12 44 L16 28 L4 18 L20 18 Z" 
              fill="url(#star-grad)" stroke="#fde047" strokeWidth="1"/>
        <path d="M24 10 L26 18 L34 18 L28 24 L30 32 L24 28 L18 32 L20 24 L14 18 L22 18 Z" 
              fill="#fef9c3" opacity="0.5"/>
      </svg>
    ),
    glowColor: 'rgba(250, 204, 21, 0.6)'
  },
  {
    id: 'lightning',
    label: 'Молния',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="lightning-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047"/>
            <stop offset="100%" stopColor="#f59e0b"/>
          </linearGradient>
        </defs>
        <path d="M28 4 L14 26 L22 26 L20 44 L34 22 L26 22 Z" 
              fill="url(#lightning-grad)" stroke="#fde047" strokeWidth="1"/>
        <path d="M26 8 L18 24 L24 24 L22 36" 
              stroke="#fef9c3" strokeWidth="2" fill="none" opacity="0.6"/>
      </svg>
    ),
    glowColor: 'rgba(245, 158, 11, 0.6)'
  },
  // Text-based brand emojis
  {
    id: 'oscar',
    label: 'OSCAR',
    svg: (
      <svg viewBox="0 0 80 48" className="w-full h-full">
        <defs>
          <linearGradient id="oscar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd700"/>
            <stop offset="50%" stopColor="#ffec8b"/>
            <stop offset="100%" stopColor="#ffd700"/>
          </linearGradient>
        </defs>
        <text 
          x="40" 
          y="32" 
          textAnchor="middle" 
          fill="url(#oscar-grad)" 
          fontSize="18" 
          fontWeight="900" 
          fontFamily="Arial Black, sans-serif"
          style={{ textShadow: '0 0 10px #ffd700, 0 0 20px #ffd700, 0 0 30px #ffd700' }}
        >
          OSCAR
        </text>
      </svg>
    ),
    glowColor: 'rgba(255, 215, 0, 0.8)'
  },
  {
    id: 'apollo',
    label: 'APOLLO',
    svg: (
      <svg viewBox="0 0 120 48" className="w-full h-full">
        <defs>
          <linearGradient id="apollo-text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc"/>
            <stop offset="50%" stopColor="#e879f9"/>
            <stop offset="100%" stopColor="#c084fc"/>
          </linearGradient>
        </defs>
        <text 
          x="60" 
          y="22" 
          textAnchor="middle" 
          fill="url(#apollo-text-grad)" 
          fontSize="12" 
          fontWeight="900" 
          fontFamily="Arial Black, sans-serif"
        >
          APOLLO
        </text>
        <text 
          x="60" 
          y="38" 
          textAnchor="middle" 
          fill="url(#apollo-text-grad)" 
          fontSize="10" 
          fontWeight="700" 
          fontFamily="Arial, sans-serif"
        >
          PRODUCTION
        </text>
      </svg>
    ),
    glowColor: 'rgba(192, 132, 252, 0.8)'
  },
  {
    id: 'onlyfans_text',
    label: 'ONLYFANS',
    svg: (
      <svg viewBox="0 0 100 48" className="w-full h-full">
        <defs>
          <linearGradient id="of-text-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00bfff"/>
            <stop offset="50%" stopColor="#00e5ff"/>
            <stop offset="100%" stopColor="#00bfff"/>
          </linearGradient>
        </defs>
        <text 
          x="50" 
          y="32" 
          textAnchor="middle" 
          fill="url(#of-text-grad)" 
          fontSize="14" 
          fontWeight="900" 
          fontFamily="Arial Black, sans-serif"
        >
          ONLYFANS
        </text>
      </svg>
    ),
    glowColor: 'rgba(0, 191, 255, 0.8)'
  },
];

interface EmojiReaction {
  id: string;
  reactionId: string;
  senderName: string;
  x: number;
  y: number;
  timestamp: number;
}

interface EmojiReactionsProps {
  room: Room | null;
  participantName: string;
}

export function EmojiReactions({ room, participantName }: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Remove reactions after animation completes
  useEffect(() => {
    if (reactions.length === 0) return;
    
    const timer = setTimeout(() => {
      setReactions(prev => prev.filter(r => Date.now() - r.timestamp < 4000));
    }, 4000);

    return () => clearTimeout(timer);
  }, [reactions]);

  // Listen for incoming reactions
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === 'emoji_reaction') {
          const newReaction: EmojiReaction = {
            id: `${Date.now()}-${Math.random()}`,
            reactionId: message.reactionId,
            senderName: message.senderName,
            x: 10 + Math.random() * 80, // Random position 10-90% horizontal
            y: 20 + Math.random() * 25, // Random position 20-45% from bottom
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
  const sendReaction = useCallback(async (reactionId: string) => {
    if (!room) return;

    const reactionData = {
      type: 'emoji_reaction',
      reactionId,
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
        reactionId,
        senderName: participantName,
        x: 10 + Math.random() * 80,
        y: 20 + Math.random() * 25,
        timestamp: Date.now(),
      };

      setReactions(prev => [...prev, localReaction]);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to send reaction:', err);
    }
  }, [room, participantName]);

  // Get reaction config by id
  const getReactionConfig = (reactionId: string) => {
    return CUSTOM_REACTIONS.find(r => r.id === reactionId);
  };

  // Fullscreen emoji overlay rendered via Portal
  const emojiOverlay = reactions.length > 0 && typeof window !== 'undefined' && createPortal(
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 99999 }}
    >
      {reactions.map((reaction) => {
        const config = getReactionConfig(reaction.reactionId);
        if (!config) return null;
        
        // Determine if it's a text-based emoji (wider)
        const isTextEmoji = ['oscar', 'apollo', 'onlyfans_text'].includes(reaction.reactionId);
        
        return (
          <div
            key={reaction.id}
            className="absolute animate-emoji-float-fullscreen"
            style={{ 
              left: `${reaction.x}%`, 
              bottom: `${reaction.y}%`,
            }}
          >
            <div className="flex flex-col items-center">
              <div 
                className={cn(
                  "h-20",
                  isTextEmoji ? "w-40" : "w-24"
                )}
                style={{ 
                  filter: `drop-shadow(0 0 20px ${config.glowColor}) drop-shadow(0 0 40px ${config.glowColor})`,
                }}
              >
                {config.svg}
              </div>
              <span className="text-sm text-white/95 bg-black/50 px-3 py-1 rounded-full backdrop-blur-xl mt-2 font-medium shadow-xl border border-white/10">
                {reaction.senderName}
              </span>
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <>
      {/* Portal emoji overlay - renders on entire viewport */}
      {emojiOverlay}

      {/* Emoji picker button */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full border-white/20 bg-white/10 hover:bg-white/20 transition-all hover:scale-105 [&_svg]:drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] [&_svg]:stroke-[2.5]"
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
          <div className="grid grid-cols-5 gap-2">
            {CUSTOM_REACTIONS.map((reaction) => {
              const isTextEmoji = ['oscar', 'apollo', 'onlyfans_text'].includes(reaction.id);
              return (
                <button
                  key={reaction.id}
                  onClick={() => sendReaction(reaction.id)}
                  className={cn(
                    "p-1.5 rounded-xl transition-all",
                    "hover:bg-white/20 hover:scale-110 active:scale-95",
                    isTextEmoji ? "col-span-2 w-24 h-12" : "w-12 h-12"
                  )}
                  title={reaction.label}
                  style={{
                    filter: `drop-shadow(0 0 4px ${reaction.glowColor})`,
                  }}
                >
                  {reaction.svg}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

export default EmojiReactions;
