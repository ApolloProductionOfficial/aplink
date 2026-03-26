

# Fix: Native PiP errors + Screen share in group calls

## Problem 1: PiP NotAllowedError (repeating every few minutes)

The `useNativePiP` hook tries to call `requestPictureInPicture()` automatically when the tab becomes hidden (visibilitychange event). Browsers require a direct **user gesture** for this API — programmatic calls from visibilitychange are always blocked.

Since you already have **Document PiP** (the custom HTML window with buttons), the native PiP auto-trigger on tab switch is redundant and just generates errors.

**Fix**: Remove the auto-PiP-on-tab-switch logic from `useNativePiP`. Keep native PiP only for manual button clicks (which have user gesture). The Document PiP handles the tab-switch scenario.

**File**: `src/hooks/useNativePiP.ts`
- Remove the `visibilitychange` event listener (lines 190-219)
- Keep `requestPiP`, `exitPiP`, `togglePiP` for manual use only
- Silence the error log to `console.warn` level for any remaining edge cases

---

## Problem 2: Screen share fails with 3+ participants

When multiple participants are in the room, SDP negotiation gets congested. `setScreenShareEnabled(true)` bundles both `getDisplayMedia` and publishing into one call — if publishing fails, the captured stream is lost.

**Fix**: Decouple capture from publishing in `toggleScreenShare`:

**File**: `src/components/LiveKitRoom.tsx`

1. Call `navigator.mediaDevices.getDisplayMedia()` **first** (preserves user gesture)
2. Then publish tracks manually using `LocalVideoTrack` / `LocalAudioTrack` with retry logic
3. If publishing fails after retries, stop the captured stream to release the browser indicator
4. Add `onended` listener on the video track to sync state when user clicks native "Stop sharing"

```text
Step 1: getDisplayMedia()        ← immediate, in gesture chain
Step 2: new LocalVideoTrack()    ← wrap captured track
Step 3: publishTrack() with      ← retry up to 3x with backoff
        source: ScreenShare
Step 4: on error → stream.stop() ← cleanup
```

This approach is resilient to negotiation failures because the stream is already captured — retries only re-attempt the publish step.

---

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useNativePiP.ts` | Remove auto-PiP on visibilitychange, keep manual-only |
| `src/components/LiveKitRoom.tsx` | Rewrite `toggleScreenShare` to capture first, publish with retries |

