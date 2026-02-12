

# Plan: Mobile Whiteboard Window, Captions Touch Drag, Translation Fallback Fixes

## Summary

This plan addresses 5 issues: (1) captions translation 402 error - add graceful fallback without AI, (2) captions not draggable on mobile (touch support), (3) whiteboard displayed as separate "participant window" on mobile, (4) "Ожидание речи" stuck when translation fails, and (5) explaining the AI architecture.

---

## Explanation: How Translation Works and Why 402 Happens

The system uses **3 different AI/API services**:

1. **ElevenLabs Scribe** (speech-to-text) -- uses your ElevenLabs API key, works fine
2. **Lovable AI Gateway** (text translation) -- uses workspace AI credits, **this is where 402 happens**
3. **ElevenLabs TTS** (text-to-speech) -- uses your ElevenLabs API key, works fine

Both `realtime-translate` AND `correct-caption` (used by subtitles) call Lovable AI Gateway for translation. When credits run out, BOTH features break.

**Solution**: Add a **free browser-based translation fallback** that works without any AI credits. When the AI gateway returns 402, the system will simply display the original transcribed text without translation (since free translation APIs don't exist in-browser). The transcription (ElevenLabs) will continue working.

---

## Issue 1: Captions/Subtitles 402 Error - Graceful Fallback

### File: `src/hooks/useRealtimeCaptions.ts` (translateText function, ~line 130)

**Current**: Calls `correct-caption` edge function which uses Lovable AI. When credits exhausted, throws FunctionsHttpError.

**Fix**:
- Wrap the `supabase.functions.invoke('correct-caption')` call in error handling
- On 402 error: show a one-time debounced toast warning
- Return original text as both `corrected` and `translated` (pass-through without translation)
- This means subtitles will still show the original speech text, just not translated
- Add a ref to track if warning was already shown (avoid spam)

### File: `supabase/functions/correct-caption/index.ts`

Already handles 402 correctly (returns 402 status). No changes needed.

---

## Issue 2: Captions Not Draggable on Mobile (Touch Support)

### File: `src/components/CaptionsOverlay.tsx`

**Current**: Drag only uses `onMouseDown` / `mousemove` / `mouseup` events (lines 81-116). These don't fire on touch devices.

**Fix**:
- Add `onTouchStart` handler alongside `onMouseDown` on the drag handle
- Add `touchmove` and `touchend` event listeners alongside `mousemove` and `mouseup`
- Use `e.touches[0].clientX/Y` for touch coordinates
- Prevent default on touch to avoid scroll conflicts

---

## Issue 3: Whiteboard as Separate "Participant Window" on Mobile

When a participant opens the whiteboard on desktop, mobile users should see it as a **separate tile** in the participant grid (like an extra participant called "Доска"). Tapping it opens the whiteboard in a landscape-oriented overlay.

### File: `src/components/LiveKitRoom.tsx`

**Changes**:
- When `showWhiteboard` is true AND device is mobile, render a fake "participant tile" in the video grid with a canvas thumbnail showing the whiteboard content
- Tapping this tile opens the whiteboard in a full-screen landscape overlay
- The overlay has a close button and auto-suggests landscape orientation

### File: `src/components/CollaborativeWhiteboard.tsx`

**Changes**:
- Add a `mobileMode` prop that renders the whiteboard in a full-screen overlay optimized for mobile
- In mobile mode: no windowed drag, just full-screen with close button
- Auto-lock to landscape orientation hint

---

## Issue 4: "Ожидание речи" Stuck

**Root cause**: Web Speech API is working (transcription happens), but when translation fails (402), the UI shows the error state and appears "stuck."

**Fix** (in `useRealtimeCaptions.ts`):
- The `vadActive` state should reflect actual voice detection, not be blocked by translation errors
- Ensure `setIsProcessing(false)` is always called in the `finally` block of translation
- When translation fails, still add the caption with original text so UI doesn't appear frozen

---

## Technical Details: Files to Modify

1. **`src/hooks/useRealtimeCaptions.ts`** (~line 130-153)
   - Add 402 error handling in `translateText` - catch FunctionsHttpError, show debounced toast, return original text
   - Add `creditWarningShownRef` to prevent toast spam
   - Ensure `setIsProcessing(false)` in finally block

2. **`src/components/CaptionsOverlay.tsx`** (~lines 81-116)
   - Add touch event handlers (`onTouchStart`, `touchmove`, `touchend`) for mobile drag support
   - Use unified handler that works with both mouse and touch events

3. **`src/components/LiveKitRoom.tsx`** (~line 1160+)
   - When `showWhiteboard && isMobile`: render a whiteboard participant tile in the video grid
   - Tapping tile opens full-screen whiteboard overlay

4. **`src/components/CollaborativeWhiteboard.tsx`**
   - Add `mobileFullscreen` mode: renders as a full-screen overlay without window drag mechanics
   - Close button always visible, landscape orientation hint

5. **`src/components/RealtimeTranslator.tsx`** (line 581-602)
   - Already handles 402 from `realtime-translate` edge function
   - Minor improvement: also filter the `FunctionsHttpError` in global error handler (already done)

