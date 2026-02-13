
# Plan: 7 Critical Fixes for APLink Call Experience

## Overview
This plan addresses 7 issues (point 8 was empty) covering gallery speaking animations, MacBook overheating optimization, emoji redesign, recording persistence, drawing fixes, emoji animations for peach/eggplant, and translation broadcast fix.

---

## 1. Gallery Speaking Highlight with Center Focus Animation

**Problem:** When someone speaks in gallery mode, they should visually stand out with pulsing animation and be centered/enlarged.

**Solution:**
- Modify `GalleryVideoLayout.tsx` to apply `scale` and `z-index` boost to the speaking participant's tile
- Add a glowing aura animation around the speaking tile (CSS keyframes with `box-shadow` pulse)
- Non-speaking tiles get slightly dimmed (`opacity: 0.85`) and scale down (`scale(0.95)`) for visual contrast
- Use `transition-all duration-500` for smooth CSS transitions between speaking states
- Add a new CSS animation `@keyframes gallery-speaking-pulse` in `call-animations.css`

**Files:**
- `src/components/GalleryVideoLayout.tsx` -- add dynamic classes for speaking/non-speaking
- `src/styles/call-animations.css` -- add `gallery-speaking-pulse` keyframes

---

## 2. MacBook Overheating Optimization

**Problem:** High CPU usage during calls causes MacBook overheating.

**Solution (multi-layer):**
- **Video codec:** In `LiveKitRoom.tsx`, prefer VP8 over VP9 on macOS (VP9 decode is CPU-heavy on Mac without HW acceleration). Add codec preference detection.
- **Simulcast:** Enable simulcast in LiveKit publish options to reduce encoding load. Lower quality layers for non-focused participants.
- **Canvas rendering:** Reduce drawing overlay and whiteboard canvas render frequency from 15fps to 10fps on Mac detection (`navigator.platform`).
- **Audio processing:** In `useRealtimeCaptions.ts`, increase VAD silence interval from current value to reduce Web Speech API polling frequency.
- **Adaptive quality:** Cap video resolution to 720p when battery is discharging (Battery Status API where available).

**Files:**
- `src/components/LiveKitRoom.tsx` -- codec preference, simulcast config
- `src/components/DrawingOverlay.tsx` -- lower fps on macOS
- `src/hooks/useRealtimeCaptions.ts` -- increase VAD interval

---

## 3. Emoji Redesign: Minimalist + Thumbs Up/Down Animations

**Problem:** Current emojis are not stylish enough. Need thumbs up (+) and thumbs down (-) with animations.

**Solution:**
- Redesign emoji SVGs in `EmojiReactions.tsx` to be more minimalist/sleek with thinner strokes and cleaner gradients
- Add two new reactions: `thumbs_up` (animated bounce-in) and `thumbs_down` (animated shake)
- Add new CSS keyframes: `emoji-thumbs-up-bounce` (scale 0 -> 1.2 -> 1 with rotation) and `emoji-thumbs-down-shake` (horizontal shake + fade)
- Update the float animation to include a slight rotation and scaling effect for more dynamism

**Files:**
- `src/components/EmojiReactions.tsx` -- add thumbs up/down SVGs, refine existing SVGs
- `src/index.css` -- add new emoji animation keyframes

---

## 4. Recording Auto-Save to Server (Crash-Proof)

**Problem:** When recording for transcription, if PC shuts down or call ends, the recording is lost.

**Solution:**
- Modify `useAudioRecorder.ts` to periodically upload audio chunks (every 30 seconds) to Lovable Cloud storage bucket `call-recordings`
- On call end or disconnect, the `summarize-meeting` edge function processes whatever chunks are available server-side
- Add a `recording_chunks` concept: each chunk gets uploaded with `roomId` + `timestamp` metadata
- On call end, trigger server-side assembly of chunks and transcription
- If client disconnects unexpectedly, a cleanup function (or next login) checks for orphaned chunks and processes them

**Files:**
- `src/hooks/useAudioRecorder.ts` -- add periodic chunk upload
- `src/pages/MeetingRoom.tsx` -- update save logic to use server-side chunks
- `supabase/functions/summarize-meeting/index.ts` -- handle chunk assembly

---

## 5. Fix Drawing Mode

**Problem:** Drawing mode has issues (likely strokes disappearing or tools not working properly).

**Solution:**
- Review and fix the double-rAF barrier in `DrawingOverlay.tsx` that was added for laser tool switching
- Ensure `contextRef` is always valid by re-acquiring on every tool change, not just on open
- Fix the canvas state restoration after minimize/maximize cycles by saving/restoring from `historyRef` more aggressively
- Add explicit `ctx.save()`/`ctx.restore()` around all draw operations to prevent state leaks

**Files:**
- `src/components/DrawingOverlay.tsx` -- fix context management and state restoration

---

## 6. Peach and Eggplant Emoji Animations

**Problem:** The peach (butt) and eggplant emojis need special animations.

**Solution:**
- Add a wobble/jiggle animation to the peach emoji SVG (`@keyframes peach-wobble` with subtle rotation oscillation)
- Add a bounce/grow animation to the eggplant emoji SVG (`@keyframes eggplant-bounce` with scale pulse)
- Apply these animations both in the picker grid and during the float-up display
- Add CSS classes `.emoji-peach-animate` and `.emoji-eggplant-animate`

**Files:**
- `src/components/EmojiReactions.tsx` -- apply animation classes to peach/eggplant
- `src/index.css` -- add wobble/bounce keyframes

---

## 7. Fix Translation Not Heard by Other Participants

**Problem:** When speaking Russian, the English translation is not heard by the other side.

**Root cause analysis:** The `sendTranslationToParticipants` function in `useLiveKitTranslationBroadcast.ts` checks `isBroadcasting` state, but the broadcast may not be started when the translator opens. Additionally, the `onSendTranslation` callback is passed correctly but the `isBroadcasting` check uses stale state due to closure issues.

**Solution:**
- In `useLiveKitTranslationBroadcast.ts`, use a `ref` for `isBroadcasting` to prevent stale closure issues (same pattern as the captions fix)
- Auto-start broadcast immediately when `sendTranslationToParticipants` is called (lazy initialization)
- In `GlobalActiveCall.tsx`, ensure `startBroadcast()` is called BEFORE the translator renders
- Add error logging when broadcast fails to identify the exact failure point
- Verify the `DataReceived` handler on the receiving side correctly decodes and plays audio

**Files:**
- `src/hooks/useLiveKitTranslationBroadcast.ts` -- use refs for broadcasting state, auto-start
- `src/components/GlobalActiveCall.tsx` -- ensure broadcast starts before translator

---

## Technical Notes

- All CSS animations use `will-change: transform` for GPU acceleration
- MacBook detection via `navigator.platform.includes('Mac')` or `navigator.userAgent`
- Audio chunk uploads use the existing `call-recordings` storage bucket
- Translation broadcast fix follows the same ref-based pattern that fixed the captions sync issue
