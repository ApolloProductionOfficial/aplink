
# Plan: 8 Critical Fixes for APLink Calls

## Issue 1: Auto-PiP Only Works Once
**Problem**: The `userExitedPiPRef` flag is set to `true` when PiP closes while the tab is visible (line 56 in useNativePiP.ts), but it never resets when the user returns to the tab and switches away again. Additionally, the `isPiPActive` state in the effect dependencies causes the auto-PiP effect to re-register with stale closure values.

**Fix (useNativePiP.ts)**:
- Reset `userExitedPiPRef` to `false` when the user returns to the tab (visibility becomes `visible`) and auto-exit PiP completes
- Use refs instead of state for `isPiPActive` check inside the visibility handler to avoid stale closures
- Add PiP control buttons (mute mic, end call) to the PiP window via `MediaSession API` metadata

## Issue 2: Whiteboard Not Visible as Separate Window for Remote Participants
**Problem**: The whiteboard opens in `windowMode` on desktop but syncs only drawing data via LiveKit data channel. Remote participants see the whiteboard content, but the `WHITEBOARD_OPEN` signal correctly triggers auto-open on desktop (line 1171). The real issue is likely that the whiteboard reconnects/disconnects the participant (see Issue 5).

**Fix**: Already working architecturally. The real fix is in Issue 5 (preventing reconnection when toggling whiteboard).

## Issue 3: Participants Get Disconnected Over Time (Tab Switch / Minimize)
**Problem**: When the browser tab is hidden for extended periods, the WebSocket connection can be garbage-collected or the OS can suspend the tab. LiveKit's built-in reconnection sometimes fails silently.

**Fix (GlobalActiveCall.tsx)**:
- Add a `visibilitychange` listener that, when the tab becomes visible again, checks `room.state` and forces a silent token refresh if the connection is degraded
- Increase the reconnection attempt limit from 5 to 8
- Add a heartbeat ping using `room.localParticipant.publishData` every 15 seconds to keep the WebSocket alive

## Issue 4: Screen Share Layout Flickers Between Focus/Gallery
**Problem**: The auto-switch logic (lines 1115-1138 in LiveKitRoom.tsx) has TWO separate `useEffect` hooks monitoring `isScreenShareEnabled`. When screen share starts, both effects fire. The "return to gallery" effect uses `prevScreenShareRef` which updates asynchronously, causing race conditions and multiple layout toggles.

**Fix (LiveKitRoom.tsx)**:
- Merge both effects into a single `useEffect` that compares `prevScreenShareRef.current` with current `isScreenShareEnabled`
- Add a debounce (500ms) before switching layout to prevent rapid toggles
- Only switch to focus mode if screen share has been active for at least 500ms (prevents flicker from brief share attempts)

## Issue 5: Whiteboard Toggle Causes Reconnection for Other Participants
**Problem**: Opening the whiteboard broadcasts `WHITEBOARD_OPEN` via `room.localParticipant.publishData()`. The receiving side's `handleRemoteWhiteboardEvents` handler (line 1164) depends on `showWhiteboard` in its effect dependencies (line 1215). When `showWhiteboard` changes, the effect re-registers, potentially causing the data handler to be removed and re-added. During this gap, other data messages (like keep-alive or media negotiation) may be missed.

**Fix (LiveKitRoom.tsx)**:
- Remove `showWhiteboard` and `showDrawingOverlay` from the effect dependencies of the data handler (line 1215)
- Use refs (`showWhiteboardRef`, `showDrawingOverlayRef`) instead so the handler doesn't re-register on state change
- This prevents the data channel listener from being disrupted during whiteboard toggle

## Issue 6: Drawing Overlay Not Visible to Others + Laser/Erasing Issues
**Problem**: The DrawingOverlay broadcasts strokes via data channel, but the laser animation loop has a known issue where it can overwrite the canvas state. The `isLaserActiveRef` flag (line 76 in DrawingOverlay.tsx) should prevent this, but there may be timing issues.

**Fix (DrawingOverlay.tsx)**:
- Ensure that when switching FROM laser to pen, the canvas state is fully restored from the stroke buffer before any new drawing begins
- Add a `requestAnimationFrame` synchronization barrier when switching tools
- Fix the data broadcast to include a `tool` field so remote participants know whether to render a stroke or ignore laser points
- Ensure remote strokes are rendered immediately upon receipt even if the overlay is closed (cache and replay)

## Issue 7: Extreme CPU Usage (452% on Arc Browser)
**Problem**: The recording animation loop (`drawFrame` at line 1763) runs `requestAnimationFrame` at 60fps, compositing ALL video elements onto a 1920x1080 canvas every frame. Combined with `canvas.captureStream(30)`, this creates massive GPU/CPU load. Additionally, the auto-hide panel timers create frequent re-renders.

**Fix (LiveKitRoom.tsx)**:
- Throttle the recording canvas draw loop to 15fps instead of using `requestAnimationFrame` (use `setTimeout` with 66ms interval)
- Reduce recording canvas resolution from 1920x1080 to 1280x720
- Add `will-change: transform` to video elements to enable GPU compositing
- Use `captureStream(15)` instead of `captureStream(30)` for recording
- Debounce the auto-hide panel timer to prevent excessive re-renders
- When recording is NOT active, do not run any animation loops

## Issue 8: Translator History Not Visible to Other Participants
**Problem**: The translator currently sends audio + text via data channel, but the receiving side only shows a brief toast notification (line 186 in GlobalActiveCall.tsx, duration 3000ms). There is no persistent history/log visible to participants.

**Fix**:
- Add a `translationHistory` state array in `ActiveCallContext` that stores received translations
- When a `translation_audio` message is received in GlobalActiveCall, append it to the history
- Display a small floating panel (like chat) showing recent translations with sender name, original text, and translated text
- Auto-show the translator panel on the receiving side when translations come in (with a "dismiss" option)
- Add a `useBrowserTTS` flag to the broadcast payload to signal fallback

---

## Technical Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useNativePiP.ts` | Fix re-trigger logic, reset flag on tab return, add MediaSession controls |
| `src/components/LiveKitRoom.tsx` | Merge screen share layout effects, throttle recording loop, fix whiteboard data handler deps, reduce canvas resolution |
| `src/components/GlobalActiveCall.tsx` | Add heartbeat, fix visibility reconnect, add translation history state |
| `src/components/DrawingOverlay.tsx` | Fix tool switch synchronization, ensure broadcast includes tool type |
| `src/contexts/ActiveCallContext.tsx` | Add translationHistory array to context |

## Implementation Order
1. Fix CPU usage (Issue 7) - highest impact on user experience
2. Fix PiP re-trigger (Issue 1) - simple fix
3. Fix screen share flicker (Issue 4) - merge effects
4. Fix whiteboard reconnection (Issue 5) - remove deps
5. Fix drawing sync (Issue 6) - tool switch barrier
6. Fix disconnection (Issue 3) - heartbeat + visibility
7. Add translator history (Issue 8) - new feature
