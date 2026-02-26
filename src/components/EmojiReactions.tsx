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
  category: 'faces' | 'hands' | 'hearts' | 'objects' | 'brand';
  svg: React.ReactNode;
  glowColor: string;
  animationClass?: string;
  wide?: boolean;
}

/* ───────────────────────────────────────────────
   PROFESSIONALLY DESIGNED SVG REACTIONS
   Organised: Faces → Hands → Hearts → Objects → Brand
   ─────────────────────────────────────────────── */

const CUSTOM_REACTIONS: CustomReaction[] = [
  // ═══════ FACES ═══════
  {
    id: 'laugh', category: 'faces', label: '😂',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="face-g" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#f9a825"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#face-g)"/><path d="M13.5 19c0-1 1.5-3 3.5-1.5" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round" fill="none"/><path d="M34.5 19c0-1-1.5-3-3.5-1.5" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round" fill="none"/><path d="M13 29q11 13 22 0" fill="#5d4037"/><path d="M13 29q11-3 22 0" fill="white"/><circle cx="12" cy="25" r="3.5" fill="#ff8a65" opacity="0.25"/><circle cx="36" cy="25" r="3.5" fill="#ff8a65" opacity="0.25"/></svg>
    ),
    glowColor: 'rgba(255,214,0,0.6)',
  },
  {
    id: 'wink', category: 'faces', label: '😉',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="wink-g" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#f9a825"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#wink-g)"/><circle cx="16" cy="20" r="2.8" fill="#5d4037"/><path d="M29 19.5l5 2" stroke="#5d4037" strokeWidth="2.5" strokeLinecap="round"/><path d="M14 31q10 9 20 0" stroke="#5d4037" strokeWidth="2.2" fill="none" strokeLinecap="round"/></svg>
    ),
    glowColor: 'rgba(255,214,0,0.6)',
  },
  {
    id: 'surprised', category: 'faces', label: '😮',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="surp-g" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#f9a825"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#surp-g)"/><circle cx="16" cy="19" r="3.2" fill="white"/><circle cx="16" cy="19" r="1.8" fill="#5d4037"/><circle cx="32" cy="19" r="3.2" fill="white"/><circle cx="32" cy="19" r="1.8" fill="#5d4037"/><path d="M14 14l3.5 2.5" stroke="#5d4037" strokeWidth="2" strokeLinecap="round"/><path d="M34 14l-3.5 2.5" stroke="#5d4037" strokeWidth="2" strokeLinecap="round"/><ellipse cx="24" cy="35" rx="5" ry="6" fill="#5d4037"/></svg>
    ),
    glowColor: 'rgba(255,214,0,0.6)',
  },
  {
    id: 'tongue', category: 'faces', label: '😛',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><radialGradient id="tng-g" cx="40%" cy="35%"><stop offset="0%" stopColor="#ffe066"/><stop offset="100%" stopColor="#f9a825"/></radialGradient></defs><circle cx="24" cy="24" r="21" fill="url(#tng-g)"/><circle cx="16" cy="20" r="2.8" fill="#5d4037"/><circle cx="32" cy="20" r="2.8" fill="#5d4037"/><path d="M15 31q9 7 18 0" stroke="#5d4037" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M20 33q4 10 8 0" fill="#ef5350"/></svg>
    ),
    glowColor: 'rgba(255,214,0,0.6)',
  },

  // ═══════ HANDS ═══════
  {
    id: 'thumbs_up', category: 'hands', label: '👍',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="thu-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#42a5f5"/><stop offset="100%" stopColor="#1e88e5"/></linearGradient></defs><path d="M14 44V22l8-16s4 0 4 6v8h14c2 0 3.5 2 3 4l-4 18c-.5 2-2 2-3 2H14z" fill="url(#thu-g)" opacity="0.9"/><rect x="4" y="22" width="8" height="22" rx="3" fill="#1565c0" opacity="0.5"/><path d="M14 44V22l8-16s4 0 4 6v8h14c2 0 3.5 2 3 4l-4 18c-.5 2-2 2-3 2H14z" stroke="#90caf9" strokeWidth="1.2" fill="none"/></svg>
    ),
    glowColor: 'rgba(66,165,245,0.7)',
    animationClass: 'emoji-thumbs-up-animate',
  },
  {
    id: 'thumbs_down', category: 'hands', label: '👎',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="thd-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ef5350"/><stop offset="100%" stopColor="#c62828"/></linearGradient></defs><path d="M34 4V26l-8 16s-4 0-4-6v-8H8c-2 0-3.5-2-3-4l4-18c.5-2 2-2 3-2h22z" fill="url(#thd-g)" opacity="0.9"/><rect x="36" y="4" width="8" height="22" rx="3" fill="#b71c1c" opacity="0.5"/><path d="M34 4V26l-8 16s-4 0-4-6v-8H8c-2 0-3.5-2-3-4l4-18c.5-2 2-2 3-2h22z" stroke="#ef9a9a" strokeWidth="1.2" fill="none"/></svg>
    ),
    glowColor: 'rgba(239,83,80,0.7)',
    animationClass: 'emoji-thumbs-down-animate',
  },
  {
    id: 'clap', category: 'hands', label: '👏',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="clp-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffcc80"/><stop offset="100%" stopColor="#e8953a"/></linearGradient></defs><path d="M18 28l-6-10c-1-2 0-4 2-4s3 1 3.5 2l3.5 6" fill="url(#clp-g)" stroke="#d48b35" strokeWidth="0.8"/><path d="M20 22l-4-8c-1-2 0-4 2-4s3 1 3.5 2l3.5 8" fill="url(#clp-g)" stroke="#d48b35" strokeWidth="0.8"/><path d="M24 20l-3-7c-1-2 0-4 2-3.5s2.5 1.5 3 2.5l2.5 5" fill="url(#clp-g)" stroke="#d48b35" strokeWidth="0.8"/><path d="M28 18l-2-5c-.5-2 .5-3.5 2-3.5s2.5 1.5 2.5 2.5l.5 6" fill="url(#clp-g)" stroke="#d48b35" strokeWidth="0.8"/><path d="M18 28c-2 4-1 8 2 11s8 4 11 1 5-6 3-16" fill="url(#clp-g)" stroke="#d48b35" strokeWidth="0.8"/><line x1="10" y1="8" x2="12" y2="12" stroke="#ffd54f" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/><line x1="36" y1="6" x2="34" y2="10" stroke="#ffd54f" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/><line x1="38" y1="15" x2="35" y2="15" stroke="#ffd54f" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/></svg>
    ),
    glowColor: 'rgba(255,183,77,0.7)',
  },
  {
    id: 'wave', category: 'hands', label: '👋',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="wav-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffcc80"/><stop offset="100%" stopColor="#e8a850"/></linearGradient></defs><path d="M30 8c0-2 2-3 3.5-1.5L36 12M26 10c0-2 2-3 3.5-1.5L32 14M22 12c0-2 2-3 3.5-1.5L28 16M18 16c0-2 2-3 3.5-1.5L24 20" fill="url(#wav-g)" stroke="#d4903a" strokeWidth="0.8"/><path d="M14 22c-2-4 0-6 2-6h2s-2 4 0 12c2 8 8 12 14 10s6-10 4-16l-2-10" fill="url(#wav-g)" stroke="#d4903a" strokeWidth="0.8"/><line x1="37" y1="9" x2="40" y2="6" stroke="#80cbc4" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/><line x1="40" y1="14" x2="43" y2="12" stroke="#80cbc4" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/></svg>
    ),
    glowColor: 'rgba(255,204,128,0.7)',
  },

  // ═══════ HEARTS ═══════
  {
    id: 'heart', category: 'hearts', label: '❤️',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="hrt-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff5252"/><stop offset="100%" stopColor="#c62828"/></linearGradient></defs><path d="M24 42C24 42 6 30 6 18 6 12 10 6 16 6c4 0 7 2 8 5 1-3 4-5 8-5 6 0 10 6 10 12 0 12-18 24-18 24z" fill="url(#hrt-g)"/><path d="M15 14c-2 0-4 2.5-4 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.35"/></svg>
    ),
    glowColor: 'rgba(255,82,82,0.7)',
    animationClass: 'emoji-thumbs-up-animate',
  },
  {
    id: 'kiss', category: 'hearts', label: '💋',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="ks-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b8a"/><stop offset="100%" stopColor="#c62828"/></linearGradient></defs><path d="M24 6c-6 0-11 6-11 12 0 4 2 7 5 10l6 8 6-8c3-3 5-6 5-10 0-6-5-12-11-12z" fill="url(#ks-g)"/><path d="M20 22c0-3 4-5 4-2s4 1 4 2" stroke="#ffcdd2" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/></svg>
    ),
    glowColor: 'rgba(255,107,138,0.7)',
  },

  // ═══════ OBJECTS ═══════
  {
    id: 'fire', category: 'objects', label: '🔥',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="fir-g" x1="50%" y1="100%" x2="50%" y2="0%"><stop offset="0%" stopColor="#e65100"/><stop offset="50%" stopColor="#ff9800"/><stop offset="100%" stopColor="#ffeb3b"/></linearGradient></defs><path d="M24 4c-5 8-12 14-12 23 0 9 5 17 12 17s12-8 12-17c0-9-7-15-12-23z" fill="url(#fir-g)"/><path d="M24 18c-2 5-6 8-6 13 0 5 2 9 6 9s6-4 6-9c0-5-4-8-6-13z" fill="#fff9c4" opacity="0.6"/></svg>
    ),
    glowColor: 'rgba(255,152,0,0.7)',
  },
  {
    id: 'party', category: 'objects', label: '🎉',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="pty-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff6b6b"/><stop offset="50%" stopColor="#ffd93d"/><stop offset="100%" stopColor="#6bcb77"/></linearGradient></defs><path d="M8 42l8-28 20 18z" fill="url(#pty-g)" opacity="0.85"/><path d="M8 42l8-28M8 42l20-10" stroke="#d32f2f" strokeWidth="1.5"/><circle cx="22" cy="8" r="2" fill="#ff5252"/><circle cx="38" cy="12" r="1.5" fill="#42a5f5"/><circle cx="40" cy="24" r="2" fill="#ffd54f"/><rect x="28" y="5" width="3" height="3" rx="0.5" fill="#66bb6a" transform="rotate(30 29 6)"/><rect x="34" y="17" width="2.5" height="2.5" rx="0.5" fill="#ce93d8" transform="rotate(15 35 18)"/></svg>
    ),
    glowColor: 'rgba(255,107,107,0.7)',
  },
  {
    id: 'rocket', category: 'objects', label: '🚀',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="rkt-g" x1="50%" y1="0" x2="50%" y2="1"><stop offset="0%" stopColor="#eceff1"/><stop offset="100%" stopColor="#90a4ae"/></linearGradient></defs><path d="M24 4l-6 14-4 4 2 10 6-4h4l6 4 2-10-4-4z" fill="url(#rkt-g)" stroke="#78909c" strokeWidth="0.8"/><circle cx="24" cy="16" r="3" fill="#42a5f5"/><path d="M20 32l4 12 4-12" fill="#ff9800" opacity="0.85"/><path d="M22 32l2 8 2-8" fill="#ffeb3b" opacity="0.7"/></svg>
    ),
    glowColor: 'rgba(144,164,174,0.6)',
  },
  {
    id: 'star', category: 'objects', label: '⭐',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="str-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#f9a825"/></linearGradient></defs><path d="M24 4l5 14h16l-12 10 4 16-13-9-13 9 4-16L3 18h16z" fill="url(#str-g)"/><path d="M24 10l3 8h8l-6 5 2 9-7-5-7 5 2-9-6-5h8z" fill="#fff9c4" opacity="0.35"/></svg>
    ),
    glowColor: 'rgba(255,213,79,0.7)',
  },
  {
    id: 'crown', category: 'objects', label: '👑',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="crn-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="100%" stopColor="#f9a825"/></linearGradient></defs><path d="M8 36l4-22 6 10 6-16 6 16 6-10 4 22z" fill="url(#crn-g)"/><circle cx="24" cy="8" r="2.5" fill="#fff9c4"/><circle cx="12" cy="14" r="2" fill="#fff9c4"/><circle cx="36" cy="14" r="2" fill="#fff9c4"/><rect x="10" y="34" width="28" height="3" rx="1.5" fill="#f9a825"/></svg>
    ),
    glowColor: 'rgba(255,213,79,0.7)',
  },
  {
    id: 'diamond', category: 'objects', label: '💎',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="dmd-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4dd0e1"/><stop offset="50%" stopColor="#00acc1"/><stop offset="100%" stopColor="#00838f"/></linearGradient></defs><path d="M12 16l12-12 12 12-12 30z" fill="url(#dmd-g)"/><path d="M12 16l12 8 12-8" stroke="#b2ebf2" strokeWidth="0.8" fill="none"/><path d="M24 24v22" stroke="#b2ebf2" strokeWidth="0.8"/><polygon points="16,16 24,4 24,24" fill="#b2ebf2" opacity="0.2"/></svg>
    ),
    glowColor: 'rgba(0,172,193,0.6)',
  },
  {
    id: 'lightning', category: 'objects', label: '⚡',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="ltn-g" x1="50%" y1="0" x2="50%" y2="1"><stop offset="0%" stopColor="#ffeb3b"/><stop offset="100%" stopColor="#f9a825"/></linearGradient></defs><path d="M28 4l-14 22h8l-2 18 14-22h-8z" fill="url(#ltn-g)" stroke="#f57f17" strokeWidth="0.8"/></svg>
    ),
    glowColor: 'rgba(255,235,59,0.7)',
  },
  {
    id: 'money', category: 'objects', label: '💰',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><circle cx="24" cy="24" r="18" fill="none" stroke="#66bb6a" strokeWidth="1.5" opacity="0.5"/><text x="24" y="31" textAnchor="middle" fill="#66bb6a" fontSize="22" fontWeight="bold" fontFamily="Arial">$</text></svg>
    ),
    glowColor: 'rgba(102,187,106,0.6)',
  },
  {
    id: 'peach', category: 'objects', label: '🍑',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="pch-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffab91"/><stop offset="100%" stopColor="#ff6e40"/></linearGradient></defs><ellipse cx="24" cy="28" rx="14" ry="16" fill="url(#pch-g)"/><ellipse cx="20" cy="28" rx="10" ry="14" fill="#ff8a65" opacity="0.3"/><path d="M24 12q4-4 2-8" stroke="#66bb6a" strokeWidth="2" fill="none" strokeLinecap="round"/><ellipse cx="25" cy="6" rx="3" ry="2" fill="#66bb6a" opacity="0.65"/></svg>
    ),
    glowColor: 'rgba(255,110,64,0.6)',
    animationClass: 'emoji-peach-animate',
  },
  {
    id: 'eggplant', category: 'objects', label: '🍆',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="egg-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ab47bc"/><stop offset="100%" stopColor="#6a1b9a"/></linearGradient></defs><ellipse cx="24" cy="30" rx="11" ry="15" fill="url(#egg-g)" transform="rotate(-15 24 30)"/><ellipse cx="22" cy="28" rx="5" ry="9" fill="#ce93d8" opacity="0.2" transform="rotate(-15 22 28)"/><path d="M24 15l-3-6m3 6l3-6m-3 6v-8" stroke="#66bb6a" strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="7" r="2.5" fill="#66bb6a"/></svg>
    ),
    glowColor: 'rgba(171,71,188,0.6)',
    animationClass: 'emoji-eggplant-animate',
  },
  {
    id: 'cherry', category: 'objects', label: '🍒',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="chr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ef5350"/><stop offset="100%" stopColor="#b71c1c"/></linearGradient></defs><circle cx="18" cy="32" r="10" fill="url(#chr-g)"/><circle cx="32" cy="34" r="9" fill="url(#chr-g)"/><ellipse cx="15" cy="28" rx="3.5" ry="4.5" fill="#ff8a80" opacity="0.25"/><path d="M18 22q2-12 10-16M32 25q-2-13-4-19" stroke="#66bb6a" strokeWidth="2" fill="none" strokeLinecap="round"/><ellipse cx="28" cy="6" rx="4" ry="2.5" fill="#66bb6a" opacity="0.7"/></svg>
    ),
    glowColor: 'rgba(239,83,80,0.6)',
  },
  {
    id: 'hot_pepper', category: 'objects', label: '🌶️',
    svg: (
      <svg viewBox="0 0 48 48" className="w-full h-full"><defs><linearGradient id="ppr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f44336"/><stop offset="50%" stopColor="#ff5722"/><stop offset="100%" stopColor="#ff9800"/></linearGradient></defs><path d="M24 8c-6 0-12 6-14 14s-2 16 4 20 10 0 12-4c2-4 4-10 6-16s0-14-8-14z" fill="url(#ppr-g)"/><path d="M24 8q2-4 0-6m0 6q-2-4-4-5" stroke="#66bb6a" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M16 20c2-2 4 0 6 4" stroke="#ffcc80" strokeWidth="1.2" fill="none" opacity="0.35"/></svg>
    ),
    glowColor: 'rgba(255,87,34,0.7)',
  },

  // ═══════ BRAND ═══════
  {
    id: 'oscar', category: 'brand', label: 'OSCAR', wide: true,
    svg: (
      <svg viewBox="0 0 80 48" className="w-full h-full"><defs><linearGradient id="osc-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffd54f"/><stop offset="50%" stopColor="#fff9c4"/><stop offset="100%" stopColor="#ffd54f"/></linearGradient></defs><text x="40" y="32" textAnchor="middle" fill="url(#osc-g)" fontSize="18" fontWeight="900" fontFamily="Arial Black,sans-serif">OSCAR</text></svg>
    ),
    glowColor: 'rgba(255,215,0,0.8)',
  },
  {
    id: 'apollo', category: 'brand', label: 'APOLLO', wide: true,
    svg: (
      <svg viewBox="0 0 120 48" className="w-full h-full"><defs><linearGradient id="apo-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ce93d8"/><stop offset="50%" stopColor="#f48fb1"/><stop offset="100%" stopColor="#ce93d8"/></linearGradient></defs><text x="60" y="22" textAnchor="middle" fill="url(#apo-g)" fontSize="12" fontWeight="900" fontFamily="Arial Black,sans-serif">APOLLO</text><text x="60" y="38" textAnchor="middle" fill="url(#apo-g)" fontSize="10" fontWeight="700" fontFamily="Arial,sans-serif">PRODUCTION</text></svg>
    ),
    glowColor: 'rgba(206,147,216,0.8)',
  },
  {
    id: 'onlyfans_text', category: 'brand', label: 'ONLYFANS', wide: true,
    svg: (
      <svg viewBox="0 0 100 48" className="w-full h-full"><defs><linearGradient id="of-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4dd0e1"/><stop offset="50%" stopColor="#80deea"/><stop offset="100%" stopColor="#4dd0e1"/></linearGradient></defs><text x="50" y="32" textAnchor="middle" fill="url(#of-g)" fontSize="14" fontWeight="900" fontFamily="Arial Black,sans-serif">ONLYFANS</text></svg>
    ),
    glowColor: 'rgba(77,208,225,0.8)',
  },
  {
    id: 'boobs', category: 'brand', label: 'Сиськи',
    svg: (<img src="/images/emoji-boobs.svg" alt="Boobs" className="w-full h-full object-contain" />),
    glowColor: 'rgba(255,180,180,0.7)',
    animationClass: 'emoji-peach-animate',
  },
  {
    id: 'toy', category: 'brand', label: 'Игрушка',
    svg: (<img src="/images/emoji-toy.svg?v=2" alt="Toy" className="w-full h-full object-contain" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />),
    glowColor: 'rgba(139,113,187,0.7)',
    animationClass: 'emoji-eggplant-animate',
  },
];

const CATEGORY_ORDER = ['faces', 'hands', 'hearts', 'objects', 'brand'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  faces: '😊 Лица',
  hands: '👋 Жесты',
  hearts: '❤️ Сердца',
  objects: '✨ Объекты',
  brand: '🏷️ Бренд',
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
