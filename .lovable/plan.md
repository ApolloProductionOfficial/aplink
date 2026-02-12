
# Plan: Translation Fallback, Whiteboard Fixes, and Stuck Participants Cleanup

## Summary

This plan addresses 4 issues: (1) translation 402 error handling with browser fallback, (2) whiteboard close/expand buttons not working on desktop, (3) drawings disappearing, and (4) stuck participants cleanup (already done).

---

## Completed: Stuck Participants Cleanup

The `cleanup-old-participants` function was already executed successfully. **17 stuck participants** were deleted (cutoff: records older than 30 days).

---

## Issue 1: Translation Error 402 - What It Means and How to Fix

**Explanation:** The real-time translator uses a 3-step pipeline:
1. **ElevenLabs Scribe** - converts your speech to text (uses your ElevenLabs API key)
2. **Lovable AI Gateway** - translates the text (uses workspace AI credits)
3. **ElevenLabs TTS** - converts translated text back to speech

The 402 error occurs at **step 2** because your Lovable workspace AI credits are exhausted. This is not a code bug -- it is a billing limit. To restore full-quality translation, top up credits in **Settings -> Workspace -> Usage**.

**Code Fix:** Currently the edge function throws a generic 500 error. The fix will:

### A. Edge function (`realtime-translate/index.ts`)
- When the AI gateway returns 402, return a **402 status** to the client (not 500) with a clear message
- Include `useBrowserTranslation: true` flag so the client can fall back

### B. Client (`RealtimeTranslator.tsx`)
- When the response is 402, show a toast: "Перевод временно недоступен (лимит кредитов). Используется браузерный перевод."
- Fall back to **free browser-based translation** using the `correct-caption` edge function (which also uses AI but with a different model) or simple text pass-through
- Continue showing translated text in the UI even without audio

### C. Client (`RealtimeTranslator.tsx`) - processAudioChunk
- Instead of `throw new Error(...)` on non-200, parse the response JSON and check for 402
- On 402: use browser TTS + show a one-time warning toast (debounced so it doesn't spam)

---

## Issue 2: Whiteboard Close/Expand Buttons Not Working (Desktop)

**Root Cause:** The close and maximize buttons (lines 700-722 in `CollaborativeWhiteboard.tsx`) are inside the title bar div that has `onPointerDown={handleWindowDragStart}`. The drag handler captures the pointer via `setPointerCapture`, which prevents button clicks from firing.

**Fix:**
- Add `e.stopPropagation()` to both the Maximize and Close button `onClick` handlers
- Add `onPointerDown={(e) => e.stopPropagation()}` to both buttons to prevent the drag handler from intercepting pointer events

---

## Issue 3: Drawings Disappearing

This is related to the known issue documented in memory. The drawing overlay uses a laser animation loop that can clear the canvas. The fix has been previously implemented via `toolRef` isolation, but if issues persist:
- Verify that `savedImageDataRef` is properly saved before shape preview
- Ensure incoming strokes from other participants are not lost during tool switches

---

## Issue 4: Drawing Mode Should Not Open for Others

Currently, the system broadcasts `DRAWING_OVERLAY_OPEN` signals to all participants. The fix:
- The DrawingOverlay open signal should **not** auto-open the overlay for other participants
- Only the Whiteboard (collaborative board) should sync open state across participants
- Drawing overlay is personal and should remain local-only

---

## Technical Details

### Files to modify:

1. **`supabase/functions/realtime-translate/index.ts`** (lines 238-242)
   - Check for 402 specifically and return proper status code with `useBrowserTranslation: true`

2. **`src/components/RealtimeTranslator.tsx`** (line 581)
   - Handle 402 response: parse JSON, show toast, fall back to browser translation
   - Add debounced toast for credit limit warning

3. **`src/components/CollaborativeWhiteboard.tsx`** (lines 700-722)
   - Add `onPointerDown={(e) => e.stopPropagation()}` and `e.stopPropagation()` in onClick to maximize/close buttons in windowed mode title bar

4. **`src/components/LiveKitRoom.tsx`** (or wherever DrawingOverlay open broadcast is handled)
   - Remove auto-open broadcast for DrawingOverlay -- keep it local-only
