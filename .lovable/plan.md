

# Plan: Kick Notification + Performance Optimization Analysis

## Overview
Two main tasks: (1) Add Data Channel notification to kicked participants before disconnection, and (2) comprehensive performance optimization analysis with actionable fixes.

---

## 1. Kick Notification via Data Channel

**Current state:** The `onKickParticipant` handler in `LiveKitRoom.tsx` (lines 2230, 2250) calls the edge function directly but does NOT send a Data Channel message to the participant before kicking. No `PARTICIPANT_KICKED` message type exists anywhere in the codebase.

**Solution:**
- Before calling the `kick-participant` edge function, send a `PARTICIPANT_KICKED` data message to the target participant via `room.localParticipant.publishData()`
- Add a handler in the existing `DataReceived` listener (line 2060) that detects `PARTICIPANT_KICKED` messages and shows a toast + disconnects gracefully
- Add a small delay (1-2 seconds) between sending the notification and calling the kick API so the participant sees the message

**Changes:**
- `src/components/LiveKitRoom.tsx`:
  - In both `onKickParticipant` handlers (lines 2230 and 2250): add `publishData()` call with `{ type: 'PARTICIPANT_KICKED', kickedIdentity: identity }` before the edge function invoke
  - In the `DataReceived` handler (line 2060): add check for `PARTICIPANT_KICKED` message, show toast "You have been removed from the call" and trigger `room.disconnect()`

---

## 2. Performance Optimization Analysis

### What causes overheating during calls:

**HIGH IMPACT (fix these first):**

| Component | Problem | CPU Cost |
|-----------|---------|----------|
| `DrawingOverlay.tsx` canvas | Continuous `requestAnimationFrame` loop running even when overlay is closed/idle | Very High |
| `CollaborativeWhiteboard.tsx` canvas | Same issue -- rAF loop always running | High |
| `AnimatedBackground` + `StarField` | Canvas particle animations running on pages behind the call overlay | High |
| Multiple `DataReceived` listeners | 9 separate listeners all parsing every message -- each does `JSON.parse` on every incoming packet | Medium |
| `useRealtimeCaptions` Web Speech API | Continuous speech recognition running even during silence | Medium |
| `EmojiReactions` floating animation | CSS animations with transforms on potentially many elements | Low-Medium |

**RECOMMENDED FIXES:**

### A. Stop canvas animations when not visible
- `DrawingOverlay.tsx`: Cancel the rAF loop when `isOpen === false` (currently the loop may keep running)
- `CollaborativeWhiteboard.tsx`: Same -- only run rAF when whiteboard is visible
- `StarField` and `AnimatedBackground`: Pause/stop when a call is active (they render behind the call UI and waste GPU cycles)

### B. Consolidate Data Channel listeners
- Instead of 9 separate `DataReceived` handlers (each doing `JSON.parse`), create ONE centralized handler that parses once and dispatches to sub-handlers via a `type` field router
- This reduces JSON parsing from 9x per message to 1x

### C. Reduce video encoding load
- Already partially done (VP8 on macOS, simulcast). Additionally:
  - When a participant is not visible on screen (scrolled out of grid), pause their video subscription using `participant.setTrackSubscriptionPermissions()`
  - Reduce remote video quality for non-focused participants to `VideoQuality.LOW`

### D. Lazy-load heavy components
- `PerformanceMonitor` -- currently always mounted in dev mode, running rAF + PerformanceObserver
- `CallDiagnosticsPanel`, `CallQualityWidget` -- mount only when opened

### E. Reduce DOM node count during calls
- The call UI has many hidden/inactive panels (chat, diagnostics, drawing tools) that stay in the DOM
- Use conditional rendering (`{isOpen && <Component />}`) instead of CSS hiding for heavy components

**Files to modify:**
- `src/components/LiveKitRoom.tsx` -- kick notification + consolidated data handler
- `src/components/DrawingOverlay.tsx` -- pause rAF when closed
- `src/components/CollaborativeWhiteboard.tsx` -- pause rAF when hidden
- `src/components/StarField.tsx` -- stop when call is active
- `src/components/AnimatedBackground.tsx` -- stop when call is active
- `src/components/PerformanceMonitor.tsx` -- conditional mounting

---

## Implementation Order

1. Add kick notification (quick, isolated change)
2. Pause canvas animations when not visible (highest CPU savings)
3. Stop background animations during calls
4. Consolidate Data Channel listeners (reduces per-message CPU)
5. Lazy-mount heavy panels

## Technical Notes

- Data Channel message format: `{ type: 'PARTICIPANT_KICKED', kickedIdentity: string, reason?: string }`
- Canvas pausing: check `isOpen` / `isVisible` in the rAF callback and `return` early if hidden
- Background animation pausing: use a global context or prop from `GlobalActiveCall` to signal "call is active"
- Consolidated handler: single `room.on(RoomEvent.DataReceived, masterHandler)` that dispatches via `switch(message.type)`

