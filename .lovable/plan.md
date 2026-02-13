
# Plan: 7 Critical Fixes for Call Experience

## 1. Signal Level Indicator Next to Each Participant's Microphone

**Problem:** No way to see if a participant's connection/audio is healthy.

**Solution:**
- Add a small signal strength icon (1-4 bars) next to each participant's mic icon in `GalleryVideoLayout.tsx` and `FocusVideoLayout.tsx`
- Use LiveKit's built-in `connectionQuality` property from each participant (`ConnectionQuality.Excellent/Good/Poor/Lost`)
- Show as a tooltip on hover with details: "Good connection", "Poor connection", etc.
- Color-code: green (excellent/good), yellow (poor), red (lost)

**Files:** `GalleryVideoLayout.tsx`, `FocusVideoLayout.tsx`

---

## 2. Fix Speaking Participant Highlighting (CRITICAL BUG)

**Problem:** Speaking participant is NEVER highlighted because `speakingParticipant` is hardcoded to `undefined` on line 903 of `LiveKitRoom.tsx`. The actual state `speakingParticipantState` exists on line 1118 but is never passed to layouts.

**Solution:**
- Replace the hardcoded `const speakingParticipant = useMemo(() => undefined ...)` with a reference to `speakingParticipantState`
- This single-line fix will make ALL speaking indicators work: gallery glow, focus mode aura, PiP speaking border

**File:** `LiveKitRoom.tsx` (line 903)

---

## 3. Organizer Can Kick Participants

**Problem:** No ability for the room creator to remove participants.

**Solution:**
- Create a new edge function `kick-participant` that uses the LiveKit Server API (`POST /twirp/livekit.RoomService/RemoveParticipant`) with admin credentials to force-disconnect a participant
- Add a "Kick" option to the context menu on participant tiles in `GalleryVideoLayout.tsx` and `FocusVideoLayout.tsx` (only visible if current user is admin/organizer)
- Pass `isAdmin` prop from `LiveKitRoom` to layout components
- When kicked, the participant receives a `PARTICIPANT_KICKED` data message before disconnection, showing a toast

**Files:**
- `supabase/functions/kick-participant/index.ts` (new)
- `GalleryVideoLayout.tsx` -- add kick menu item
- `FocusVideoLayout.tsx` -- add kick menu item  
- `LiveKitRoom.tsx` -- pass isAdmin, add kick handler

---

## 4. Fix Drawing Overlay Erasure

**Problem:** Drawings disappear when using the drawing overlay.

**Root cause:** The laser tool's animation loop (`drawLaserPoints`) restores `baseImageDataRef` which may be stale, overwriting new drawings. When switching tools, the double-rAF barrier sometimes doesn't fully prevent a race condition.

**Solution:**
- In `DrawingOverlay.tsx`, after every stroke/shape completes, update `baseImageDataRef` with the current canvas state so the laser loop never restores an old state
- Add `saveToHistory()` calls after each stroke end and shape end
- Ensure `baseImageDataRef` is always refreshed after clearing or undoing

**File:** `DrawingOverlay.tsx`

---

## 5. Fix Mobile Microphone Enable Issues

**Problem:** Some mobile users can't enable their microphone.

**Root cause:** iOS/Safari requires a user gesture to call `getUserMedia`. The current implementation captures mic on first touch but the `mute()`/`unmute()` pattern may fail if the initial track was never published.

**Solution:**
- In `LiveKitRoom.tsx`, when a mobile user taps the mic button and no microphone track exists, explicitly call `room.localParticipant.setMicrophoneEnabled(true)` instead of just `unmute()`
- Add a fallback: if `unmute()` fails, try full `setMicrophoneEnabled(true)` with a user-gesture-wrapped `getUserMedia` call
- Add console logging for mic toggle failures to aid debugging

**File:** `LiveKitRoom.tsx` (mic toggle handler)

---

## 6. Whiteboard as Participant-Like Window + Undo Button

**Problem:** Whiteboard opens as a separate overlay rather than appearing as a participant tile. No undo button.

**Solution:**
- Add an Undo button (`RotateCcw` icon) to the whiteboard toolbar in both window mode and mobile mode, using a `historyRef` similar to `DrawingOverlay`
- For desktop: whiteboard already has a window mode. Adjust it to appear in the video grid area alongside participants (like a speaker view) rather than as a floating overlay
- For mobile: keep the existing tile-based approach (tap to expand)
- Add `historyRef` tracking to `CollaborativeWhiteboard.tsx` with `saveToHistory()` after each stroke/shape and an undo function

**File:** `CollaborativeWhiteboard.tsx`

---

## 7. Touchpad Drawing Support on Whiteboard

**Problem:** Touchpad gestures (two-finger scroll, pinch) interfere with drawing instead of being treated as drawing input.

**Solution:**
- In `CollaborativeWhiteboard.tsx`, add `wheel` event listener on the canvas to convert scroll-to-draw
- Add `gesturestart`/`gesturechange` listeners for pinch-to-zoom on the canvas
- Set `touch-action: none` on the canvas (already present) and add `overscroll-behavior: none` to prevent page scrolling
- Add pointer events support (already using mouse events) -- convert to `onPointerDown`/`onPointerMove`/`onPointerUp` for unified touch+mouse+pen+touchpad handling

**File:** `CollaborativeWhiteboard.tsx`

---

## 8. OnlyFans-Themed Emoji Reactions

**Problem:** Need themed reactions fitting the OnlyFans brand.

**Solution:**
- Add new custom SVG reactions to `EmojiReactions.tsx`:
  - Lips/Kiss (already exists as "kiss")
  - Hot pepper (spicy)
  - Wink face
  - Cherry emoji
  - Tongue emoji
- Each with neon glow effects matching the existing style
- Add animation classes for the new emojis

**File:** `EmojiReactions.tsx`, `src/index.css`

---

## Implementation Order

1. Fix #2 first (speaking highlight) -- single line fix, high impact
2. Fix #4 (drawing erasure)
3. Fix #5 (mobile mic)
4. Fix #1 (signal indicators)
5. Fix #3 (kick participants) -- requires new edge function
6. Fix #6 (whiteboard undo)
7. Fix #7 (touchpad)
8. Fix #8 (themed emojis)

## Technical Details

- **Speaking fix:** Change line 903 in LiveKitRoom.tsx from `useMemo(() => undefined)` to use `speakingParticipantState` 
- **Kick API:** Uses LiveKit's Twirp RPC protocol at `https://call.aplink.live/twirp/livekit.RoomService/RemoveParticipant`
- **Signal quality:** Uses `participant.connectionQuality` enum from livekit-client
- **Undo on whiteboard:** `historyRef` stores up to 20 `ImageData` snapshots, pop on undo
- **Touchpad:** `PointerEvent` API unifies mouse, touch, and stylus/touchpad input
