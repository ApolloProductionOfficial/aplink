

# Plan: 9 Critical Fixes for Call Experience

## Overview
Fix runtime error, moderation, screen sharing, captions, session management, and performance issues.

---

## 0. CRITICAL: Fix Runtime Error - `useDataChannelMessage is not defined` in GlobalActiveCall.tsx

**Problem:** The app crashes because `GlobalActiveCall.tsx` imports `useDataChannelMessage` from `@/hooks/useDataChannel` but the import fails at runtime.

**Root cause:** The import exists on line 5, but the function may not be exported correctly or there's a build cache issue. Need to verify the export in `useDataChannel.ts`.

**Fix:** Verify the export is correct. The file `src/hooks/useDataChannel.ts` exports `useDataChannelMessage` as a named export - this should work. The error may be a stale build. Re-saving the file should trigger a rebuild.

---

## 1. Remove Mic/Camera Status Notifications

**Problem:** User doesn't want toast notifications about other participants' mic/camera status changes.

**Analysis:** Searched for mic/camera status toasts - the only relevant toasts are error toasts when the user's OWN mic/camera fails. There are no toasts for OTHER participants' mute state. The "notifications" are likely the voice announcements from `useVoiceNotifications` (via ElevenLabs TTS) that say "X joined" / "X left".

**Fix:** Disable voice notifications by default or add a toggle. Simplest fix: remove the `announceParticipantJoined` and `announceParticipantLeft` calls from the `ParticipantConnected`/`ParticipantDisconnected` handlers in `LiveKitRoom.tsx` (lines 2061, 2077).

**File:** `src/components/LiveKitRoom.tsx`

---

## 2. Fix Kick Participants (Not Working)

**Problem:** The `kick-participant` edge function uses `supabase.auth.getClaims(token)` which does NOT exist in Supabase JS v2. This causes a 401 error every time.

**Fix:** Replace the auth check with `supabase.auth.getUser(token)` which is the correct v2 method. Also, since guest users may not be authenticated, consider making the function work with the anon key and verifying the caller is the room creator via a simpler check (or remove the auth requirement since `verify_jwt` is already false in config.toml).

**File:** `supabase/functions/kick-participant/index.ts`

---

## 3. Clear Chat on New Call

**Problem:** Chat messages from the previous call persist into the next call because `sessionStorage` is keyed by `roomId` and old entries are never cleared.

**Fix:** In `InCallChat.tsx`, clear the sessionStorage entry on component unmount (when the call ends). Also in `ActiveCallContext.tsx`, when `endCall()` is called, clear all `aplink-chat-*` keys from sessionStorage.

**Files:** `src/contexts/ActiveCallContext.tsx`, `src/components/InCallChat.tsx`

---

## 4. Fix Virtual Background

**Problem:** Virtual backgrounds likely fail silently. The `VirtualBackground()` function from `@livekit/track-processors` requires the camera track to be published first and may fail if WebGL is not available or if the image URL is invalid/CORS-blocked.

**Fix:** Add proper error handling with user-visible toast when `setProcessor` fails. Also add a check that the track exists and is published before applying. Log the specific error for debugging.

**Files:** `src/components/LiveKitRoom.tsx` (lines 1636-1681)

---

## 5. Fix Captions on PC

**Problem:** Web Speech API (`SpeechRecognition`) may not work on desktop Chrome if the microphone permission is already consumed by LiveKit. The speech recognition needs its own audio stream.

**Analysis:** The current implementation uses the system-level `SpeechRecognition` API which should use the default mic independently. However, there may be an issue where `recognition.start()` fails silently because the mic is already in use by LiveKit.

**Fix:** 
- Add better error logging in `startWebSpeechCapture` 
- Ensure the `enabled` flag is properly passed through from `CaptionsOverlay` to `useRealtimeCaptions`
- Add a visible status indicator in the captions UI showing whether recognition is active
- If Web Speech fails, automatically try ElevenLabs fallback with explicit user notification

**Files:** `src/hooks/useRealtimeCaptions.ts`, `src/components/CaptionsOverlay.tsx`

---

## 6. Close Old Sessions When All Leave

**Problem:** When everyone leaves a call, the session state may not be properly reset, leaving stale data.

**Fix:** In `LiveKitRoom.tsx`, listen for the `RoomEvent.Disconnected` event and trigger `endCall()` from the `ActiveCallContext`. Also clear sessionStorage chat data and reset all transient state.

**Files:** `src/components/LiveKitRoom.tsx`, `src/components/GlobalActiveCall.tsx`

---

## 7. MacBook Overheating

**Problem:** Despite previous optimizations, the call still causes overheating.

**Additional optimizations:**
- **VAD rAF loop in captions:** The fallback VAD in `useRealtimeCaptions.ts` (line 647) uses `requestAnimationFrame` for voice activity detection - this runs at 60fps continuously. Replace with `setInterval` at 100ms (10 checks/sec is sufficient for VAD).
- **Recording canvas compositing:** The call recording uses a canvas compositing loop that may still run at high FPS. Verify it's capped.
- **Reduce remote video quality:** For non-focused participants in gallery mode, request `VideoQuality.LOW` to reduce decode load.

**Files:** `src/hooks/useRealtimeCaptions.ts`, `src/components/LiveKitRoom.tsx`

---

## 8. Fix Screen Sharing - Recursive Mirror Effect

**Problem:** From the screenshot, when the user shares their screen, the `FocusVideoLayout` shows the local screen share track, creating a recursive "screen within screen within screen" effect. Other participants also can't see the shared screen properly.

**Root cause:** In `FocusVideoLayout.tsx` lines 78-86, screen shares are filtered but the local screen share is still rendered as the main view. When the user sees their own screen share being rendered, it creates an infinite recursion.

**Fix:** 
- In `FocusVideoLayout.tsx`, when the screen share belongs to the local participant, do NOT render it as the main video (the user already sees their own screen). Instead, show a static "You are sharing your screen" placeholder.
- Ensure remote participants correctly receive and display the screen share track.

**File:** `src/components/FocusVideoLayout.tsx`

---

## Implementation Order

1. Fix #0 (runtime error) - most critical, app crashes
2. Fix #2 (kick participants) - broken edge function
3. Fix #8 (screen sharing) - major UX bug
4. Fix #1 (remove notifications) - quick
5. Fix #3 (clear chat) - quick
6. Fix #5 (captions on PC) - debugging needed
7. Fix #6 (session cleanup) - moderate
8. Fix #4 (virtual background) - error handling
9. Fix #7 (overheating) - performance

## Technical Details

- **Kick fix:** Replace `getClaims()` with `getUser()` in edge function, or simply skip auth check since the function already has `verify_jwt = false`
- **Screen share fix:** Check `screenTrack.participant.isLocal` -- if true, show "Вы демонстрируете экран" placeholder instead of rendering the video
- **Chat clearing:** Add `sessionStorage` cleanup in `endCall()` callback
- **VAD optimization:** Replace `requestAnimationFrame` with `setInterval(checkVoiceActivity, 100)` in the fallback VAD loop
- **Captions debugging:** Add `console.log` at each stage of Web Speech API lifecycle and a visual badge showing recognition state

