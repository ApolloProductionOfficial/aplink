import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Room, RoomEvent } from "livekit-client";
import { useDataChannelMessage } from '@/hooks/useDataChannel';
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
  animationClass?: string;
}

// Custom neon SVG reactions
const CUSTOM_REACTIONS: CustomReaction[] = [
  {
    id: 'thumbs_up',
    label: '+',
    svg: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <path d="M14 44V22L22 6C22 6 26 6 26 12V20H40C42 20 43.5 22 43 24L39 42C38.5 44 37 44 36 44H14Z" 
              stroke="hsl(var(--primary))" strokeWidth="2" fill="hsl(var(--primary)/0.15)"/>
        <rect x="4" y="22" width="8" height="22" rx="2" fill="hsl(var(--primary)/0.3)" stroke="hsl(var(--primary))" strokeWidth="1.5"/>
      </svg>
    ),
    glowColor: 'hsl(var(--primary) / 0.7)',
    animationClass: 'emoji-thumbs-up-animate',
  },
  {
    id: 'thumbs_down',
    label: '−',
    svg: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <path d="M34 4V26L26 42C26 42 22 42 22 36V28H8C6 28 4.5 26 5 24L9 6C9.5 4 11 4 12 4H34Z" 
              stroke="#ef4444" strokeWidth="2" fill="rgba(239,68,68,0.15)"/>
        <rect x="36" y="4" width="8" height="22" rx="2" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1.5"/>
      </svg>
    ),
    glowColor: 'rgba(239, 68, 68, 0.7)',
    animationClass: 'emoji-thumbs-down-animate',
  },
  {
    id: 'money',
    label: 'Деньги',
    svg: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <circle cx="24" cy="24" r="18" stroke="#00ff88" strokeWidth="1.5" fill="none" opacity="0.5"/>
        <text x="24" y="31" textAnchor="middle" fill="#00ff88" fontSize="22" fontWeight="bold" fontFamily="Arial">$</text>
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
            <stop offset="60%" stopColor="#ff8800"/>
            <stop offset="100%" stopColor="#ffcc00"/>
          </linearGradient>
        </defs>
        <path d="M24 6 C19 14 12 20 12 29 C12 38 17 44 24 44 C31 44 36 38 36 29 C36 20 29 14 24 6" 
              fill="url(#fire-grad-main)" stroke="none"/>
        <path d="M24 20 C22 25 18 28 18 33 C18 38 20 42 24 42 C28 42 30 38 30 33 C30 28 26 25 24 20" 
              fill="#ffe066" opacity="0.7"/>
      </svg>
    ),
    glowColor: 'rgba(255, 136, 0, 0.7)'
  },
  {
    id: 'peach',
    label: 'Персик',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full emoji-peach-animate">
        <defs>
          <linearGradient id="peach-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb6c1"/>
            <stop offset="100%" stopColor="#ff6b8a"/>
          </linearGradient>
        </defs>
        <ellipse cx="24" cy="28" rx="14" ry="16" fill="url(#peach-grad)"/>
        <ellipse cx="20" cy="28" rx="10" ry="14" fill="#ff8fa3" opacity="0.4"/>
        <path d="M24 12 Q28 8 26 4" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <ellipse cx="25" cy="6" rx="3" ry="2" fill="#4ade80" opacity="0.7"/>
      </svg>
    ),
    glowColor: 'rgba(255, 107, 138, 0.6)',
    animationClass: 'emoji-peach-animate',
  },
  {
    id: 'eggplant',
    label: 'Баклажан',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full emoji-eggplant-animate">
        <defs>
          <linearGradient id="eggplant-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7"/>
            <stop offset="100%" stopColor="#6b21a8"/>
          </linearGradient>
        </defs>
        <ellipse cx="24" cy="30" rx="11" ry="15" fill="url(#eggplant-grad)" transform="rotate(-15 24 30)"/>
        <ellipse cx="22" cy="28" rx="5" ry="9" fill="#c084fc" opacity="0.25" transform="rotate(-15 22 28)"/>
        <path d="M24 15 L21 9 M24 15 L27 9 M24 15 L24 7" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="7" r="2.5" fill="#4ade80"/>
      </svg>
    ),
    glowColor: 'rgba(168, 85, 247, 0.6)',
    animationClass: 'emoji-eggplant-animate',
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
        </defs>
        <path d="M24 4 L18 18 L14 22 L16 32 L22 28 L26 28 L32 32 L34 22 L30 18 Z" 
              fill="url(#rocket-grad)" stroke="#818cf8" strokeWidth="1"/>
        <circle cx="24" cy="16" r="3" fill="#818cf8"/>
        <path d="M20 32 L24 44 L28 32" fill="#ff8800" opacity="0.8"/>
      </svg>
    ),
    glowColor: 'rgba(129, 140, 248, 0.6)'
  },
  {
    id: 'cherry',
    label: 'Вишенка',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="cherry-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff1744"/>
            <stop offset="100%" stopColor="#c51162"/>
          </linearGradient>
        </defs>
        <circle cx="18" cy="32" r="10" fill="url(#cherry-grad)"/>
        <circle cx="32" cy="34" r="9" fill="url(#cherry-grad)"/>
        <ellipse cx="15" cy="28" rx="4" ry="5" fill="#ff5252" opacity="0.3"/>
        <path d="M18 22 Q20 10 28 6 M32 25 Q30 12 28 6" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <ellipse cx="28" cy="6" rx="4" ry="2.5" fill="#4ade80" opacity="0.8"/>
      </svg>
    ),
    glowColor: 'rgba(255, 23, 68, 0.6)',
  },
  {
    id: 'hot_pepper',
    label: 'Перчик',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id="pepper-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff1744"/>
            <stop offset="50%" stopColor="#ff5722"/>
            <stop offset="100%" stopColor="#ff9100"/>
          </linearGradient>
        </defs>
        <path d="M24 8 C18 8 12 14 10 22 C8 30 10 38 16 42 C20 44 24 42 26 38 C28 34 30 28 32 22 C34 16 30 8 24 8" 
              fill="url(#pepper-grad)"/>
        <path d="M24 8 Q26 4 24 2 M24 8 Q22 4 20 3" stroke="#4ade80" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M16 20 C18 18 20 20 22 24" stroke="#ffcc00" strokeWidth="1.5" fill="none" opacity="0.4"/>
      </svg>
    ),
    glowColor: 'rgba(255, 87, 34, 0.7)',
  },
  {
    id: 'wink',
    label: 'Подмигивание',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <circle cx="24" cy="24" r="20" fill="#ffd600" stroke="#ffab00" strokeWidth="1"/>
        <circle cx="16" cy="20" r="3" fill="#5d4037"/>
        <path d="M30 18 L34 22" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M16 32 Q24 40 32 32" stroke="#5d4037" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    glowColor: 'rgba(255, 214, 0, 0.6)',
  },
  {
    id: 'tongue',
    label: 'Язычок',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <circle cx="24" cy="24" r="20" fill="#ffd600" stroke="#ffab00" strokeWidth="1"/>
        <circle cx="16" cy="20" r="3" fill="#5d4037"/>
        <circle cx="32" cy="20" r="3" fill="#5d4037"/>
        <path d="M16 32 Q24 38 32 32" stroke="#5d4037" strokeWidth="2" fill="none"/>
        <path d="M20 34 Q24 44 28 34" fill="#ff5252"/>
      </svg>
    ),
    glowColor: 'rgba(255, 82, 82, 0.6)',
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
        <path d="M8 36 L12 14 L18 24 L24 8 L30 24 L36 14 L40 36 Z" 
              fill="url(#crown-grad)" stroke="#ffd700" strokeWidth="1"/>
        <circle cx="24" cy="8" r="2.5" fill="#fff5cc"/>
        <circle cx="12" cy="14" r="2" fill="#fff5cc"/>
        <circle cx="36" cy="14" r="2" fill="#fff5cc"/>
        <rect x="10" y="34" width="28" height="3" rx="1" fill="#ffcc00"/>
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
        <path d="M12 16 L24 24 L36 16" stroke="#a5f3fc" strokeWidth="1" fill="none"/>
        <path d="M24 24 L24 46" stroke="#a5f3fc" strokeWidth="1"/>
        <polygon points="16,16 24,4 24,24" fill="#a5f3fc" opacity="0.25"/>
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
      </svg>
    ),
    glowColor: 'rgba(255, 23, 68, 0.6)'
  },
  {
    id: 'star',
    label: 'Звезда',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <path d="M24 4 L28 18 L44 18 L32 28 L36 44 L24 34 L12 44 L16 28 L4 18 L20 18 Z" 
              fill="#facc15" stroke="#fde047" strokeWidth="1"/>
        <path d="M24 10 L26 18 L34 18 L28 24 L30 32 L24 28 L18 32 L20 24 L14 18 L22 18 Z" 
              fill="#fef9c3" opacity="0.4"/>
      </svg>
    ),
    glowColor: 'rgba(250, 204, 21, 0.6)'
  },
  {
    id: 'lightning',
    label: 'Молния',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <path d="M28 4 L14 26 L22 26 L20 44 L34 22 L26 22 Z" 
              fill="#f59e0b" stroke="#fde047" strokeWidth="1"/>
      </svg>
    ),
    glowColor: 'rgba(245, 158, 11, 0.6)'
  },
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
        <text x="40" y="32" textAnchor="middle" fill="url(#oscar-grad)" fontSize="18" fontWeight="900" fontFamily="Arial Black, sans-serif">OSCAR</text>
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
        <text x="60" y="22" textAnchor="middle" fill="url(#apollo-text-grad)" fontSize="12" fontWeight="900" fontFamily="Arial Black, sans-serif">APOLLO</text>
        <text x="60" y="38" textAnchor="middle" fill="url(#apollo-text-grad)" fontSize="10" fontWeight="700" fontFamily="Arial, sans-serif">PRODUCTION</text>
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
        <text x="50" y="32" textAnchor="middle" fill="url(#of-text-grad)" fontSize="14" fontWeight="900" fontFamily="Arial Black, sans-serif">ONLYFANS</text>
      </svg>
    ),
    glowColor: 'rgba(0, 191, 255, 0.8)'
  },
  {
    id: 'boobs',
    label: 'Сиськи',
    svg: (
      <img src="/images/emoji-boobs.svg" alt="Boobs" className="w-full h-full object-contain" />
    ),
    glowColor: 'rgba(255, 180, 180, 0.7)',
    animationClass: 'emoji-peach-animate',
  },
  {
    id: 'toy',
    label: 'Игрушка',
    svg: (
      <img src="/images/emoji-toy.svg?v=2" alt="Toy" className="w-full h-full object-contain" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
    ),
    glowColor: 'rgba(139, 113, 187, 0.7)',
    animationClass: 'emoji-eggplant-animate',
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

  // Listen for incoming reactions via centralized data channel
  useDataChannelMessage(room, 'emoji_reaction', useCallback((message: any) => {
    const newReaction: EmojiReaction = {
      id: `${Date.now()}-${Math.random()}`,
      reactionId: message.reactionId,
      senderName: message.senderName,
      x: Math.random() > 0.5 ? (5 + Math.random() * 25) : (70 + Math.random() * 25),
      y: 20 + Math.random() * 25,
      timestamp: Date.now(),
    };

    setReactions(prev => [...prev, newReaction]);
  }, []));

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

      // Also show locally - avoid center area
      const localReaction: EmojiReaction = {
        id: `${Date.now()}-local`,
        reactionId,
        senderName: participantName,
        x: Math.random() > 0.5 ? (5 + Math.random() * 25) : (70 + Math.random() * 25),
        y: 15 + Math.random() * 30,
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
            className={cn(
              "absolute animate-emoji-float-fullscreen",
              config.animationClass
            )}
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
                  filter: `drop-shadow(0 0 15px ${config.glowColor}) drop-shadow(0 0 30px ${config.glowColor})`,
                }}
              >
                {config.svg}
              </div>
              <span className="text-xs text-white/90 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-xl mt-1.5 font-medium border border-white/10">
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
