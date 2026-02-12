

# Plan: 13 Critical Fixes for APLink Mobile and Desktop Calls

---

## 1. Screen Share Shows Multiple Screens
**Root Cause**: The `FocusVideoLayout` subscribes to all tracks with `Track.Source.ScreenShare` and may render multiple screen share tracks (one per participant). When the layout detects screen share, both the camera track and screen share track of the same participant render.

**Fix** (`src/components/FocusVideoLayout.tsx`):
- Filter screen share tracks to only show ONE active screen share (prioritize remote, then local)
- If multiple participants share screens simultaneously, show only the most recent one
- Deduplicate tracks in `useTracks` result by filtering to unique participants for screen share

---

## 2. Screen Share Not Working on Mobile
**Root Cause**: `getDisplayMedia()` is not supported on most mobile browsers (iOS Safari, some Android browsers). The current code calls `localParticipant.setScreenShareEnabled()` which internally calls `getDisplayMedia()`.

**Fix** (`src/components/LiveKitRoom.tsx`):
- Detect mobile and show a clear message: "Screen sharing is not supported on mobile browsers"
- Hide the screen share button on mobile or replace it with a disabled state + explanation tooltip
- On Android Chrome (which does support it), keep the button active

---

## 3. Menu Hides When Tapping Screen Again on Mobile
**Root Cause**: The `handleTouchStart` and `handleClick` on the container div (line 2153-2154) fire when the user taps anywhere, including on the bottom panel. The auto-hide timer triggers after 4 seconds and immediately hides the panels again. Tapping the panel area re-triggers the timer but the user experiences the menu disappearing.

**Fix** (`src/components/LiveKitRoom.tsx`):
- Add `e.stopPropagation()` on the bottom control bar's `onTouchStart` and `onClick` to prevent the container handler from re-setting the hide timer
- When panels are visible and the user taps on them, reset the timer to a longer duration (8s) instead of restarting the 4s countdown
- Add a "lock panels" state that keeps panels visible while a Popover is open

---

## 4. Notifications Too Frequent and Non-Critical
**Root Cause**: Many `toast.*` calls fire for non-critical events like pin/unpin (line 1075-1081), layout switching (lines 1062, 1112-1124), gallery mode suggestion, etc.

**Fix** (`src/components/LiveKitRoom.tsx`):
- Remove toasts from: `handlePinParticipant`, layout mode changes (focus/gallery/webinar buttons in the More menu), screen share auto-switch layout
- Keep toasts only for: errors, recording start/stop, reconnection, audio blocked, microphone/camera permission errors
- Make remaining toasts more transparent: add `className: 'opacity-80'` style to non-critical toasts

---

## 5. Cannot Download MP4 Recording on Mobile/PC
**Root Cause**: The `saveRecordingAsMp4` function calls a `convert-to-mp4` edge function that may not be configured. The WebM download works but users want MP4.

**Fix** (`src/components/LiveKitRoom.tsx`):
- Make the "Save WebM" button the primary action (it always works)
- For MP4: try to use MediaRecorder with `video/mp4` mimeType if supported (newer Chrome/Edge support it natively without server conversion)
- If `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')`, record directly in MP4
- Fallback: download as WebM with clear label that it plays everywhere

---

## 6. Landscape Mode on Mobile Not Optimized
**Root Cause**: The current UI layout uses fixed sizes and doesn't adapt to landscape orientation.

**Fix** (`src/components/LiveKitRoom.tsx`, `src/index.css`):
- Detect landscape via `window.matchMedia('(orientation: landscape)')`
- In landscape: reduce bottom bar padding, use smaller icons (w-8 h-8 instead of w-10 h-10)
- Position chat as a side panel (right-side, 40% width) instead of bottom overlay
- Reduce header panel height

---

## 7. Subtitles Not Working (Not Transcribing Speech)
**Root Cause**: Looking at the screenshot, the subtitle panel shows "Voice detected..." but no actual text. The Web Speech API (`SpeechRecognition`) may not be receiving results because:
- The mic audio stream isn't being fed to the recognition engine
- Or the recognition language doesn't match the spoken language

**Fix** (`src/hooks/useRealtimeCaptions.ts`):
- Add diagnostic logging when `onresult` fires vs when it doesn't
- Ensure the `SpeechRecognition` instance is started with `continuous: true` and `interimResults: true`
- Add a fallback: if no results after 5 seconds of detected voice, restart the recognition engine
- Display partial/interim results immediately (even before `isFinal`)

---

## 8. Mobile Icons and Panels Too Large
**Root Cause**: Button sizes are `w-10 h-10 sm:w-12 sm:h-12` on mobile. Popover panels take too much screen space.

**Fix** (`src/components/LiveKitRoom.tsx`):
- Reduce mobile button sizes from `w-10 h-10` to `w-8 h-8`
- Reduce icon sizes from `w-5 h-5` to `w-4 h-4` on mobile
- Add `max-h-[50vh]` to all Popover panels on mobile
- Reduce Popover padding from `p-3/p-4` to `p-2` on mobile
- Make the mic popup more compact: smaller toggle buttons (w-10 to w-8), less spacing

---

## 9. Whiteboard Sync to Mobile Participants
**Root Cause**: The whiteboard data channel broadcasts drawing data but mobile participants may not see updates if their whiteboard isn't open or if data messages are dropped during state transitions.

**Fix** (`src/components/CollaborativeWhiteboard.tsx`, `src/components/LiveKitRoom.tsx`):
- Cache incoming whiteboard data even when the whiteboard panel is closed
- When a mobile user opens the whiteboard tile, replay all cached strokes
- Ensure the `WHITEBOARD_OPEN` signal is sent with reliable delivery
- Add a "sync request" message that new viewers can send to get the full canvas state from the host

---

## 10. Drawing Overlay Disappears + Laser Pointer Not Visible
**Root Cause**: The laser animation loop overwrites the canvas state. When switching from laser back to pen, the `requestAnimationFrame` barrier may not be working consistently. The laser cursor is only rendered on the canvas (8px glow dot), but there's no CSS cursor change.

**Fix** (`src/components/DrawingOverlay.tsx`):
- When tool is 'laser', set CSS cursor to `crosshair` on the canvas element
- After switching from laser to pen, wait TWO frames (double `requestAnimationFrame`) before enabling drawing to ensure the animation loop has fully stopped
- Save canvas state to history BEFORE starting laser mode, and restore it reliably when exiting
- Add a visible cursor ring that follows mouse position when laser is active (rendered in DOM, not canvas)

---

## 11. Mobile Recording Indicator Too Large
**Root Cause**: The recording indicator (line 2288-2294) shows full text "REC" + duration counter on mobile, taking up header space.

**Fix** (`src/components/LiveKitRoom.tsx`):
- On mobile (`isMobile`): show only a small red dot (w-3 h-3) in the top-left corner, no text
- On desktop: keep the current full indicator with "REC" label and timer

---

## 12. High CPU/Heat During Transcription + Recording
**Root Cause**: The `SpeechRecognition` engine running continuously + MediaRecorder + canvas compositing all consume significant resources. The 15fps throttle helped recording, but transcription still runs Web Speech API constantly.

**Fix** (`src/hooks/useRealtimeCaptions.ts`, `src/components/LiveKitRoom.tsx`):
- Add VAD (Voice Activity Detection) gating: only run SpeechRecognition when audio level exceeds threshold
- When the user is silent for 3+ seconds, pause SpeechRecognition and restart on next voice detection
- Reduce canvas compositing to 10fps on mobile (keep 15fps on desktop)
- Add `will-change: transform` to video elements to offload to GPU

---

## 13. Translator Not Working Bidirectionally (PC to Phone)
**Root Cause**: The translator receives data via `RoomEvent.DataReceived` in `GlobalActiveCall.tsx`, but mobile audio playback may fail due to autoplay restrictions. The `speakWithBrowserTTS` fallback may not work if `speechSynthesis` is blocked on mobile.

**Fix** (`src/components/GlobalActiveCall.tsx`):
- When receiving translation on mobile, require a user gesture first (similar to audio prompt)
- Auto-open the translator panel on the receiving side when a translation is received (currently only shows toast)
- Queue translations and play them after the user taps "enable audio" if autoplay is blocked
- Make the TranslationHistoryPanel also show a "play" button next to each entry for manual replay
- Reduce timer icon/panel sizes on mobile (as mentioned in the user's last note)

---

## Technical Summary

| File | Changes |
|------|---------|
| `src/components/LiveKitRoom.tsx` | Issues 1-6, 8, 11, 12: Screen share dedup, mobile screen share disable, panel auto-hide fix, reduce toasts, MP4 recording, landscape, smaller icons, mobile REC dot, GPU hints |
| `src/components/FocusVideoLayout.tsx` | Issue 1: Filter to single screen share track |
| `src/components/DrawingOverlay.tsx` | Issue 10: CSS cursor for laser, double-rAF barrier, DOM cursor ring |
| `src/hooks/useRealtimeCaptions.ts` | Issues 7, 12: Fix speech recognition restart, VAD gating |
| `src/components/GlobalActiveCall.tsx` | Issue 13: Mobile audio playback queue, auto-open translator |
| `src/components/TranslationHistoryPanel.tsx` | Issue 13: Add play button per entry |
| `src/components/CollaborativeWhiteboard.tsx` | Issue 9: Cache strokes, sync request protocol |
| `src/index.css` | Issue 6: Landscape media queries |
| `src/components/CallTimer.tsx` | Issue 13 (last note): Smaller timer on mobile |

## Implementation Order
1. Issues 4, 8, 11 (UI cleanup: reduce toasts, smaller icons, mobile REC dot) -- quick wins
2. Issue 3 (panel auto-hide fix) -- improves mobile UX immediately
3. Issues 1, 2 (screen share fixes)
4. Issue 5 (MP4 download)
5. Issue 6 (landscape mode)
6. Issues 7, 12 (subtitles + CPU optimization)
7. Issue 10 (drawing overlay fixes)
8. Issue 9 (whiteboard sync)
9. Issue 13 (translator bidirectional)

