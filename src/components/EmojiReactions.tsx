import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Room } from "livekit-client";
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
  category: 'reactions' | 'gestures' | 'celebrate' | 'brand';
  svg: React.ReactNode;
  glowColor: string;
  animationClass?: string;
  wide?: boolean;
}

/* ───────────────────────────────────────────────
   APLink REACTION SET — clean, cohesive, on-brand
   Cyan-glass aesthetic, Telegram-style live reactions.
   Each icon: soft gradient fill, subtle inner highlight,
   thin glass rim, brand-cyan glow. No cartoon clutter,
   no crude objects — only tasteful, presentable icons.
   Groups: Реакции → Жесты → Празднование → Бренд
   ─────────────────────────────────────────────── */

// Shared glass rim helper colors
const RIM = 'rgba(255,255,255,0.55)';

const CUSTOM_REACTIONS: CustomReaction[] = [
  // ═══════ РЕАКЦИИ (core, like Telegram) ═══════
  {
    id: 'heart', category: 'reactions', label: 'Нравится',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-hrt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b81"/><stop offset="100%" stopColor="#e63956"/></linearGradient></defs><path d="M24 41C24 41 7 30 7 18.5 7 12.7 11.3 8 17 8c3.6 0 6.3 1.9 7 4.6C24.7 9.9 27.4 8 31 8c5.7 0 10 4.7 10 10.5C41 30 24 41 24 41z" fill="url(#r-hrt)"/><path d="M16 13.5c-2.4.4-4.2 2.6-4.4 5.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.45"/></svg>
    ),
    glowColor: 'rgba(230,57,86,0.65)',
    animationClass: 'emoji-thumbs-up-animate',
  },
  {
    id: 'thumbs_up', category: 'reactions', label: 'Класс',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-up" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3dd6e8"/><stop offset="100%" stopColor="#0aa3c2"/></linearGradient></defs><path d="M15 43V21l7.5-15c.3-.6 1-1 1.7-.8 2.2.5 3.6 2.6 3.3 4.9L26.5 18H39c2.2 0 3.8 2 3.3 4.1l-3.6 16c-.3 1.6-1.8 2.9-3.5 2.9H15z" fill="url(#r-up)"/><rect x="5" y="21" width="8" height="22" rx="3" fill="#0aa3c2" opacity="0.6"/><path d="M15 43V21l7.5-15" stroke="#cffafe" strokeWidth="1.1" fill="none" opacity="0.5"/></svg>
    ),
    glowColor: 'rgba(13,202,240,0.7)',
    animationClass: 'emoji-thumbs-up-animate',
  },
  {
    id: 'laugh', category: 'reactions', label: 'Смех',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="r-laugh" cx="42%" cy="34%"><stop offset="0%" stopColor="#ffe9a3"/><stop offset="100%" stopColor="#ffb22e"/></radialGradient></defs><circle cx="24" cy="24" r="20.5" fill="url(#r-laugh)"/><path d="M13.5 19.5q3.5-4 7 0" stroke="#7a4a12" strokeWidth="2.4" strokeLinecap="round" fill="none"/><path d="M27.5 19.5q3.5-4 7 0" stroke="#7a4a12" strokeWidth="2.4" strokeLinecap="round" fill="none"/><path d="M13 28.5q11 11 22 0z" fill="#7a4a12"/><path d="M14 28.5q10-2.5 20 0" fill="#fff"/><circle cx="24" cy="24" r="20.5" fill="none" stroke={RIM} strokeWidth="0.8" opacity="0.5"/></svg>
    ),
    glowColor: 'rgba(255,178,46,0.6)',
  },
  {
    id: 'wow', category: 'reactions', label: 'Вау',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="r-wow" cx="42%" cy="34%"><stop offset="0%" stopColor="#ffe9a3"/><stop offset="100%" stopColor="#ffb22e"/></radialGradient></defs><circle cx="24" cy="24" r="20.5" fill="url(#r-wow)"/><circle cx="16.5" cy="20" r="3" fill="#fff"/><circle cx="16.5" cy="20" r="1.7" fill="#5a3a10"/><circle cx="31.5" cy="20" r="3" fill="#fff"/><circle cx="31.5" cy="20" r="1.7" fill="#5a3a10"/><ellipse cx="24" cy="33" rx="4.5" ry="5.5" fill="#7a4a12"/><circle cx="24" cy="24" r="20.5" fill="none" stroke={RIM} strokeWidth="0.8" opacity="0.5"/></svg>
    ),
    glowColor: 'rgba(255,178,46,0.6)',
  },
  {
    id: 'hundred', category: 'reactions', label: '100',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-100" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b81"/><stop offset="100%" stopColor="#e63956"/></linearGradient></defs><text x="24" y="31" textAnchor="middle" fill="url(#r-100)" fontSize="19" fontWeight="900" fontFamily="Inter,Arial,sans-serif" letterSpacing="-1">100</text><rect x="9" y="35" width="30" height="2.4" rx="1.2" fill="url(#r-100)"/></svg>
    ),
    glowColor: 'rgba(230,57,86,0.6)',
  },

  // ═══════ ЖЕСТЫ ═══════
  {
    id: 'clap', category: 'gestures', label: 'Аплодисменты',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-clap" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd27a"/><stop offset="100%" stopColor="#e89a3c"/></linearGradient></defs><path d="M18 29l-6-10c-.9-1.6 0-3.4 1.8-3.6 1.1-.1 2.2.5 2.7 1.5l3.5 6" fill="url(#r-clap)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M20 23l-4-8c-.8-1.6 0-3.4 1.8-3.6 1.1-.1 2.2.5 2.7 1.5l3.5 8" fill="url(#r-clap)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M24 21l-3-7c-.7-1.6.2-3.3 1.9-3.2 1 .1 1.9.8 2.3 1.7l2.4 5" fill="url(#r-clap)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M28 19l-2-5c-.5-1.6.4-3 1.9-3 1 0 1.9.7 2.1 1.7l.6 5.6" fill="url(#r-clap)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M18 29c-2 4-1 8 2 10.8 2.9 2.8 7.6 3.4 10.9.8 3.3-2.6 4.6-6.4 2.8-15.6" fill="url(#r-clap)" stroke="#cf8a32" strokeWidth="0.7"/><line x1="11" y1="9" x2="13" y2="12.5" stroke="#3dd6e8" strokeWidth="1.4" strokeLinecap="round" opacity="0.65"/><line x1="36" y1="7" x2="34" y2="10.5" stroke="#3dd6e8" strokeWidth="1.4" strokeLinecap="round" opacity="0.65"/></svg>
    ),
    glowColor: 'rgba(232,154,60,0.65)',
  },
  {
    id: 'wave', category: 'gestures', label: 'Привет',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-wave" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd27a"/><stop offset="100%" stopColor="#e8a64c"/></linearGradient></defs><path d="M30 8.5c-.2-1.7 1.6-2.7 3-1.4L36 11M26 9.8c-.2-1.7 1.6-2.7 3-1.4L32 13M22 11.8c-.2-1.7 1.6-2.7 3-1.4L28 15M18.5 15.6c-.2-1.7 1.6-2.7 3-1.4L24 18.5" fill="url(#r-wave)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M14.5 22c-1.8-3.6 0-5.6 1.9-5.6h1.8s-1.8 3.6 0 11.2c1.8 7.4 7.2 11.2 12.8 9.4 5-1.6 5.4-9.2 3.4-14.6l-1.8-9.2" fill="url(#r-wave)" stroke="#cf8a32" strokeWidth="0.7"/><line x1="37" y1="9.5" x2="40" y2="6.5" stroke="#3dd6e8" strokeWidth="1.4" strokeLinecap="round" opacity="0.55"/></svg>
    ),
    glowColor: 'rgba(232,166,76,0.6)',
  },
  {
    id: 'raise_hand', category: 'gestures', label: 'Поднять руку',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-raise" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd27a"/><stop offset="100%" stopColor="#e8a64c"/></linearGradient></defs><path d="M18 26V9c0-1.7 1.3-3 3-3s3 1.3 3 3v15" fill="url(#r-raise)"/><path d="M24 24V7c0-1.7 1.3-3 3-3s3 1.3 3 3v17" fill="url(#r-raise)"/><path d="M30 26v-4c0-1.7 1.3-3 3-3s3 1.3 3 3v8c0 7-5 13-12 13s-11-5-13-11l-2-7c-.5-1.8.6-3.2 2.2-3.4 1.3-.1 2.4.7 2.9 2L19 30" fill="url(#r-raise)" stroke="#cf8a32" strokeWidth="0.7"/><path d="M18 26V9c0-1.7 1.3-3 3-3" stroke="#fff4dd" strokeWidth="1" fill="none" opacity="0.5"/></svg>
    ),
    glowColor: 'rgba(232,166,76,0.6)',
  },

  // ═══════ ПРАЗДНОВАНИЕ ═══════
  {
    id: 'fire', category: 'celebrate', label: 'Огонь',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-fire" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" stopColor="#ff5722"/><stop offset="55%" stopColor="#ff9800"/><stop offset="100%" stopColor="#ffd740"/></linearGradient></defs><path d="M24 4c-4.5 7.5-11.5 13-11.5 22 0 8.6 5 16.5 11.5 16.5S35.5 34.6 35.5 26C35.5 17 28.5 11.5 24 4z" fill="url(#r-fire)"/><path d="M24 19c-2 4.5-5.5 7.5-5.5 12 0 4.7 2 8.5 5.5 8.5s5.5-3.8 5.5-8.5c0-4.5-3.5-7.5-5.5-12z" fill="#fff3c4" opacity="0.7"/></svg>
    ),
    glowColor: 'rgba(255,152,0,0.7)',
  },
  {
    id: 'party', category: 'celebrate', label: 'Праздник',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-party" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#0aa3c2"/><stop offset="100%" stopColor="#3dd6e8"/></linearGradient></defs><path d="M7 42l8.5-27 19.5 17.5z" fill="url(#r-party)"/><path d="M7 42l8.5-27M7 42l19.5-9.5" stroke="#067a92" strokeWidth="1.3" opacity="0.8"/><circle cx="23" cy="8" r="2" fill="#ff6b81"/><circle cx="38" cy="13" r="1.6" fill="#ffd740"/><circle cx="40" cy="25" r="1.9" fill="#3dd6e8"/><rect x="29" y="5" width="3" height="3" rx="0.6" fill="#7ee787" transform="rotate(30 30.5 6.5)"/><rect x="35" y="18" width="2.5" height="2.5" rx="0.6" fill="#ff9800" transform="rotate(15 36 19)"/></svg>
    ),
    glowColor: 'rgba(13,202,240,0.6)',
  },
  {
    id: 'star', category: 'celebrate', label: 'Звезда',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-star" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffe082"/><stop offset="100%" stopColor="#ffb300"/></linearGradient></defs><path d="M24 4.5l5.6 13.4 14.5 1.1-11 9.4 3.4 14.1L24 38.4 11.5 42.5l3.4-14.1-11-9.4 14.5-1.1z" fill="url(#r-star)"/><path d="M24 11l3.2 7.7 8.3.6-6.3 5.4 1.9 8.1L24 28.7" fill="#fff6d6" opacity="0.35"/></svg>
    ),
    glowColor: 'rgba(255,179,0,0.65)',
  },
  {
    id: 'diamond', category: 'celebrate', label: 'Премиум',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="r-dmd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5ee7f5"/><stop offset="50%" stopColor="#0aa3c2"/><stop offset="100%" stopColor="#067a92"/></linearGradient></defs><path d="M11 17l13-12 13 12-13 27z" fill="url(#r-dmd)"/><path d="M11 17l13 8.5 13-8.5" stroke="#bdf3fa" strokeWidth="0.9" fill="none"/><path d="M24 25.5V44" stroke="#bdf3fa" strokeWidth="0.9"/><polygon points="15.5,17 24,5 24,25.5" fill="#bdf3fa" opacity="0.22"/></svg>
    ),
    glowColor: 'rgba(13,202,240,0.6)',
  },

  // ═══════ БРЕНД ═══════
  {
    id: 'apollo', category: 'brand', label: 'APOLLO', wide: true,
    svg: (
      <svg viewBox="0 0 120 48" className="w-full h-full"><defs><linearGradient id="r-apo" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#3dd6e8"/><stop offset="50%" stopColor="#9be8f2"/><stop offset="100%" stopColor="#3dd6e8"/></linearGradient></defs><text x="60" y="22" textAnchor="middle" fill="url(#r-apo)" fontSize="13" fontWeight="900" fontFamily="Inter,Arial,sans-serif" letterSpacing="1">APOLLO</text><text x="60" y="37" textAnchor="middle" fill="url(#r-apo)" fontSize="9" fontWeight="700" fontFamily="Inter,Arial,sans-serif" letterSpacing="3" opacity="0.85">PRODUCTION</text></svg>
    ),
    glowColor: 'rgba(61,214,232,0.75)',
  },
];

const CATEGORY_ORDER = ['reactions', 'gestures', 'celebrate', 'brand'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  reactions: 'Реакции',
  gestures: 'Жесты',
  celebrate: 'Празднование',
  brand: 'Бренд',
};

// Recently used storage
const RECENT_KEY = 'aplink_recent_reactions';
const MAX_RECENT = 8;

function getRecentReactions(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function addRecentReaction(id: string) {
  const recent = getRecentReactions().filter(r => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

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
  const [recentIds, setRecentIds] = useState(getRecentReactions);

  const reactionMap = useMemo(() => new Map(CUSTOM_REACTIONS.map(r => [r.id, r])), []);

  useEffect(() => {
    if (reactions.length === 0) return;
    const timer = setTimeout(() => {
      setReactions(prev => prev.filter(r => Date.now() - r.timestamp < 4000));
    }, 4000);
    return () => clearTimeout(timer);
  }, [reactions]);

  useDataChannelMessage(room, 'emoji_reaction', useCallback((message: any) => {
    setReactions(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      reactionId: message.reactionId,
      senderName: message.senderName,
      x: Math.random() > 0.5 ? (5 + Math.random() * 25) : (70 + Math.random() * 25),
      y: 20 + Math.random() * 25,
      timestamp: Date.now(),
    }]);
  }, []));

  const sendReaction = useCallback(async (reactionId: string) => {
    if (!room) return;
    try {
      const data = new TextEncoder().encode(JSON.stringify({
        type: 'emoji_reaction', reactionId, senderName: participantName, timestamp: Date.now(),
      }));
      await room.localParticipant.publishData(data, { reliable: true });
      setReactions(prev => [...prev, {
        id: `${Date.now()}-local`, reactionId, senderName: participantName,
        x: Math.random() > 0.5 ? (5 + Math.random() * 25) : (70 + Math.random() * 25),
        y: 15 + Math.random() * 30, timestamp: Date.now(),
      }]);
      addRecentReaction(reactionId);
      setRecentIds(getRecentReactions());
      setIsOpen(false);
    } catch (err) { console.error('Failed to send reaction:', err); }
  }, [room, participantName]);

  // Group reactions by category
  const grouped = useMemo(() => {
    const map = new Map<string, CustomReaction[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of CUSTOM_REACTIONS) map.get(r.category)?.push(r);
    return map;
  }, []);

  // Recent reactions
  const recentReactions = useMemo(() =>
    recentIds.map(id => reactionMap.get(id)).filter(Boolean) as CustomReaction[],
  [recentIds, reactionMap]);

  // Floating emoji overlay
  const emojiOverlay = reactions.length > 0 && typeof window !== 'undefined' && createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 99999 }}>
      {reactions.map((reaction) => {
        const config = reactionMap.get(reaction.reactionId);
        if (!config) return null;
        return (
          <div
            key={reaction.id}
            className={cn("absolute animate-emoji-float-fullscreen", config.animationClass)}
            style={{ left: `${reaction.x}%`, bottom: `${reaction.y}%` }}
          >
            <div className="flex flex-col items-center">
              <div className={cn("h-20", config.wide ? "w-40" : "w-24")}
                style={{ filter: `drop-shadow(0 0 15px ${config.glowColor}) drop-shadow(0 0 30px ${config.glowColor})` }}>
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

  const renderReactionBtn = (reaction: CustomReaction) => (
    <button
      key={reaction.id}
      onClick={() => sendReaction(reaction.id)}
      className={cn(
        "p-1.5 rounded-xl transition-all hover:bg-white/20 hover:scale-110 active:scale-95",
        reaction.wide ? "col-span-2 w-24 h-12" : "w-11 h-11"
      )}
      title={reaction.label}
      style={{ filter: `drop-shadow(0 0 4px ${reaction.glowColor})` }}
    >
      {reaction.svg}
    </button>
  );

  return (
    <>
      {emojiOverlay}

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
          className="w-auto max-w-[320px] max-h-[400px] overflow-y-auto p-3 glass-dark border-white/10 rounded-2xl scrollbar-thin scrollbar-thumb-white/10"
          side="top"
          align="center"
          sideOffset={12}
        >
          <div className="space-y-3">
            {/* Recently Used */}
            {recentReactions.length > 0 && (
              <div>
                <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1.5 px-0.5">Недавние</p>
                <div className="grid grid-cols-6 gap-1">
                  {recentReactions.map(renderReactionBtn)}
                </div>
              </div>
            )}

            {/* Categories */}
            {CATEGORY_ORDER.map(cat => {
              const items = grouped.get(cat);
              if (!items || items.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mb-1.5 px-0.5">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {items.map(renderReactionBtn)}
                  </div>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

export default EmojiReactions;
