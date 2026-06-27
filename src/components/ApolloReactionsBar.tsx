import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Room } from "livekit-client";
import { useDataChannelMessage } from "@/hooks/useDataChannel";
import { cn } from "@/lib/utils";

/* ───────────────────────────────────────────────
   APLink — Apollo reaction bar (full-color emoji set)
   12 hand-crafted glossy SVG reactions, true alpha,
   each its own proper color (red heart, orange fire,
   yellow faces, purple party, gold star …) + a matching
   neon glow. Click → broadcast over the LiveKit
   data-channel to ALL participants; each reaction flies
   up with drift+fade (CSS keyframes), labelled by sender.
   ─────────────────────────────────────────────── */

interface ReactionDef {
  key: string;
  label: string;
  /** public path to the SVG asset */
  src: string;
  /** matching neon glow tint for the flying overlay */
  glow: string;
}

// Files live in /public/reactions/*.svg. Note: "100" → hundred.svg.
const REACTIONS: ReactionDef[] = [
  { key: "like", label: "Класс", src: "/reactions/like.svg", glow: "rgba(40,150,255,0.75)" },
  { key: "heart", label: "Нравится", src: "/reactions/heart.svg", glow: "rgba(255,77,109,0.8)" },
  { key: "love", label: "Влюблён", src: "/reactions/love.svg", glow: "rgba(255,140,170,0.75)" },
  { key: "laugh", label: "Смех", src: "/reactions/laugh.svg", glow: "rgba(255,176,32,0.78)" },
  { key: "wow", label: "Вау", src: "/reactions/wow.svg", glow: "rgba(255,176,32,0.78)" },
  { key: "fire", label: "Огонь", src: "/reactions/fire.svg", glow: "rgba(255,138,0,0.85)" },
  { key: "clap", label: "Браво", src: "/reactions/clap.svg", glow: "rgba(240,162,60,0.78)" },
  { key: "party", label: "Праздник", src: "/reactions/party.svg", glow: "rgba(168,85,247,0.8)" },
  { key: "star", label: "Звезда", src: "/reactions/star.svg", glow: "rgba(255,200,40,0.82)" },
  { key: "100", label: "100", src: "/reactions/hundred.svg", glow: "rgba(255,77,109,0.78)" },
  { key: "rocket", label: "Ракета", src: "/reactions/rocket.svg", glow: "rgba(120,170,255,0.8)" },
  { key: "sad", label: "Грусть", src: "/reactions/sad.svg", glow: "rgba(61,214,232,0.72)" },
];

const REACTION_MAP = new Map(REACTIONS.map((r) => [r.key, r]));

// How long a flying reaction lives on screen (matches CSS animation duration).
const REACTION_TTL_MS = 4200;

interface FlyingReaction {
  id: string;
  reactionKey: string;
  senderName: string;
  /** horizontal anchor in % */
  x: number;
  /** sideways drift target in px (negative = left) */
  drift: number;
  /** small rotation for organic feel */
  rotate: number;
  timestamp: number;
}

interface ApolloReactionsBarProps {
  room: Room | null;
  participantName: string;
}

/** Message type broadcast on the LiveKit data-channel. */
const REACTION_MSG_TYPE = "reaction";

export function ApolloReactionsBar({ room, participantName }: ApolloReactionsBarProps) {
  const [flying, setFlying] = useState<FlyingReaction[]>([]);

  // Spawn a flying reaction (used for both local-optimistic + remote).
  const spawn = useCallback((reactionKey: string, senderName: string) => {
    if (!REACTION_MAP.has(reactionKey)) return;
    // Anchor near the bottom-center, spread across the lower-middle band so
    // multiple reactions don't perfectly overlap.
    const x = 30 + Math.random() * 40; // 30%..70%
    const drift = (Math.random() - 0.5) * 120; // -60px..+60px sideways
    const rotate = (Math.random() - 0.5) * 24; // -12deg..+12deg
    setFlying((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reactionKey,
        senderName,
        x,
        drift,
        rotate,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Garbage-collect expired reactions.
  useEffect(() => {
    if (flying.length === 0) return;
    const timer = setInterval(() => {
      setFlying((prev) => prev.filter((r) => Date.now() - r.timestamp < REACTION_TTL_MS));
    }, 1000);
    return () => clearInterval(timer);
  }, [flying.length]);

  // Receive reactions broadcast by other participants.
  useDataChannelMessage(
    room,
    REACTION_MSG_TYPE,
    useCallback(
      (message: { emoji?: string; reactionKey?: string; senderName?: string }) => {
        const key = message.emoji || message.reactionKey;
        if (!key) return;
        spawn(key, message.senderName || "Гость");
      },
      [spawn],
    ),
  );

  // Send a reaction: broadcast to all + optimistic local render.
  const sendReaction = useCallback(
    async (reactionKey: string) => {
      // Optimistic local display (own reactions show immediately).
      spawn(reactionKey, participantName);
      if (!room) return;
      try {
        const data = new TextEncoder().encode(
          JSON.stringify({
            type: REACTION_MSG_TYPE,
            emoji: reactionKey,
            reactionKey,
            senderName: participantName,
            timestamp: Date.now(),
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });
      } catch (err) {
        console.error("[ApolloReactionsBar] Failed to send reaction:", err);
      }
    },
    [room, participantName, spawn],
  );

  // Fullscreen overlay of flying reactions (portal → body, never clips layout).
  const overlay =
    flying.length > 0 && typeof window !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: 99999 }}
            aria-hidden
          >
            {flying.map((r) => {
              const def = REACTION_MAP.get(r.reactionKey);
              if (!def) return null;
              return (
                <div
                  key={r.id}
                  className="absolute flex flex-col items-center animate-apollo-reaction-float"
                  style={{
                    left: `${r.x}%`,
                    bottom: "12%",
                    // CSS var consumed by the keyframes for sideways drift + rotation.
                    ["--drift" as string]: `${r.drift}px`,
                    ["--rot" as string]: `${r.rotate}deg`,
                  }}
                >
                  <img
                    src={def.src}
                    alt={def.label}
                    draggable={false}
                    className="w-16 h-16 sm:w-20 sm:h-20 select-none"
                    style={{
                      filter: `drop-shadow(0 0 12px ${def.glow}) drop-shadow(0 0 26px ${def.glow})`,
                    }}
                  />
                  <span className="mt-1 text-[10px] sm:text-xs text-white/90 bg-black/55 px-2 py-0.5 rounded-full backdrop-blur-md font-medium border border-white/10 whitespace-nowrap max-w-[120px] truncate">
                    {r.senderName}
                  </span>
                </div>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  const buttons = useMemo(
    () =>
      REACTIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => sendReaction(r.key)}
          title={r.label}
          aria-label={r.label}
          className={cn(
            "shrink-0 grid place-items-center rounded-full transition-all duration-200",
            "w-9 h-9 sm:w-10 sm:h-10",
            "hover:scale-125 active:scale-90 hover:bg-white/10",
          )}
        >
          <img
            src={r.src}
            alt={r.label}
            draggable={false}
            className="w-6 h-6 sm:w-7 sm:h-7 select-none transition-[filter] duration-200"
            style={{ filter: `drop-shadow(0 0 3px ${r.glow})` }}
          />
        </button>
      )),
    [sendReaction],
  );

  return (
    <>
      {overlay}
      <div
        className={cn(
          "flex items-center gap-0.5 sm:gap-1 px-1.5 py-1 rounded-full",
          "bg-white/8 border border-white/15 backdrop-blur-xl",
          "max-w-[88vw] overflow-x-auto scrollbar-none",
          "shadow-[0_0_18px_rgba(13,202,240,0.12)]",
        )}
        // Reactions bar should not trigger the call's panel auto-hide/click logic.
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {buttons}
      </div>
    </>
  );
}

export default ApolloReactionsBar;
