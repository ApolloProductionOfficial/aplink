
# APLink Call Interface Improvements - Implementation Plan

## Overview

This plan addresses 9 major improvements to the APLink video call system, ranging from UI enhancements to core functionality fixes for collaborative features and mobile responsiveness.

---

## Task 1: Add Tooltips to Header Buttons + Smoother Animation

### Current State
- Top header buttons (PiP, Timer, etc.) lack tooltips
- Tooltip animations use default Radix UI timing

### Implementation
1. **Wrap header buttons with Tooltip components**
   - In `LiveKitRoom.tsx` and `MeetingRoom.tsx`, wrap PiP button, Timer button, and other header actions with `<Tooltip>` wrappers
   - Add Russian descriptions: "Picture-in-Picture", "Таймер звонка", etc.

2. **Enhance tooltip animations in `tooltip.tsx`**
   - Increase animation duration from default to 300ms
   - Add custom fade-in animation with transform
   - Use `data-[state=delayed-open]` for entrance animation

**Files to modify:**
- `src/components/ui/tooltip.tsx` - Add smoother animation classes
- `src/components/LiveKitRoom.tsx` - Wrap header buttons with tooltips
- `src/pages/MeetingRoom.tsx` - Wrap any header buttons

---

## Task 2: Fix Call Sharing Link Flow

### Current State
- When guests click a `/room/[roomSlug]` link, they go directly to the room
- The `MeetingRoom.tsx` redirects to Index if no name, but users see the room first

### Implementation
1. **Update `MeetingRoom.tsx` redirect logic**
   - Currently: `if (!userName) navigate(\`/?room=\${roomSlug}\`)`
   - This is correct, but happens after component mount

2. **Make redirect happen earlier**
   - Move the redirect check to the top of the component
   - Show a loading state while redirecting to prevent flash
   - Ensure the room parameter is preserved in URL

3. **Improve Index.tsx to auto-scroll to form**
   - When `?room=` param is present, highlight the form
   - Auto-focus the name input field

**Files to modify:**
- `src/pages/MeetingRoom.tsx` - Earlier redirect with loading state
- `src/pages/Index.tsx` - Better handling of `?room=` parameter

---

## Task 3: Default to Gallery View

### Current State
- `layoutMode` defaults to `'focus'` in `LiveKitRoom.tsx` line 440

### Implementation
1. **Change default layout mode**
   - Change: `useState<'focus' | 'gallery' | 'webinar'>('focus')`
   - To: `useState<'focus' | 'gallery' | 'webinar'>('gallery')`

2. **Remove gallery suggestion toast**
   - The toast suggesting gallery mode for 3+ participants becomes redundant
   - Keep the auto-switch logic for screen sharing

**Files to modify:**
- `src/components/LiveKitRoom.tsx` - Change default layout, remove suggestion

---

## Task 4: Make Top Panel Visible to All Participants (Guests)

### Current State
- The IP Panel is admin-only (`{isAdmin && showIPPanel && ...}`)
- Translator and Captions panels are rendered but buttons may be hidden

### Implementation
1. **Verify button visibility in LiveKitRoom.tsx**
   - Check if translator/captions buttons are conditionally hidden
   - Ensure all participants see the same header buttons

2. **Update headerButtons passed from MeetingRoom.tsx**
   - Verify the buttons are created without admin checks
   - Translator and Subtitles should be visible to everyone
   - Only IP Panel should remain admin-only

3. **Check GlobalActiveCall.tsx panel rendering**
   - Currently: Captions and Translator are not admin-restricted
   - IP Panel correctly checks `isAdmin`

**Files to modify:**
- `src/pages/MeetingRoom.tsx` - Ensure headerButtons include translator/subtitles for all
- `src/components/LiveKitRoom.tsx` - Verify control buttons are not admin-gated

---

## Task 5: Make Whiteboard Visible to All Participants

### Current State
- `CollaborativeWhiteboard.tsx` and `DrawingOverlay.tsx` broadcast strokes via LiveKit Data Channel
- Each participant only sees their own local canvas plus received remote strokes
- The canvas itself is not synchronized when opened

### Implementation

#### 5a. Collaborative Whiteboard Sync
1. **Broadcast whiteboard open/close state**
   - When any participant opens whiteboard, broadcast: `{ type: 'WHITEBOARD_OPEN' }`
   - Other participants auto-open whiteboard in response
   
2. **Sync canvas state on open**
   - When whiteboard opens, request current state from other participants
   - Broadcast full canvas ImageData as base64 for initial sync
   - OR broadcast drawing history array

3. **Add visual indicator when whiteboard is active**
   - Show badge/icon when another participant has whiteboard open

#### 5b. DrawingOverlay Sync (Drawing on Screen)
1. **Broadcast drawing overlay open/close**
   - Similar to whiteboard - sync the open state
   - Other participants see drawing overlay appear

2. **Sync strokes in real-time**
   - Current implementation already broadcasts strokes
   - Need to sync the initial canvas state when overlay opens

**Files to modify:**
- `src/components/CollaborativeWhiteboard.tsx` - Add open/close sync, canvas state sync
- `src/components/DrawingOverlay.tsx` - Add open/close sync, improve initial state sync
- `src/components/LiveKitRoom.tsx` - Add listeners for whiteboard/overlay open events

---

## Task 6: Fix Chat Message Persistence + Notifications

### Current State
- Messages are stored in component state: `useState<ChatMessage[]>([])`
- When component unmounts/remounts, messages are lost
- The `buttonOnly` mode and panel visibility cause remounting

### Implementation

#### 6a. Persist Messages
1. **Move message state to a ref or context**
   - Create a `messagesRef` that survives remounts
   - OR store messages in `sessionStorage` with room ID as key
   - Load messages on mount, save on every new message

2. **Use stable component mounting**
   - Ensure `InCallChat` stays mounted even when closed
   - Use CSS visibility instead of conditional rendering

#### 6b. New Message Notification
1. **Add glow effect to chat button when new message arrives**
   - Already has `unreadCount` with red badge
   - Add pulsing glow animation when `unreadCount > 0`
   - Use CSS `box-shadow` with animation

2. **Optional: Sound notification**
   - Already calls `playMessageSound()` when chat is closed

**Files to modify:**
- `src/components/InCallChat.tsx` - Persist messages, add glow animation
- `src/components/LiveKitRoom.tsx` - Ensure chat stays mounted

---

## Task 7: Real-Time Translation Audio Broadcast to Other Participants

### Current State
- `RealtimeTranslator.tsx` translates speech and plays audio locally
- `useLiveKitTranslationBroadcast.ts` has `sendTranslationToParticipants` method
- `GlobalActiveCall.tsx` listens for incoming translations and plays them

### Implementation

#### 7a. Fix Outgoing Translation Broadcast
1. **Connect translator output to broadcast**
   - In `RealtimeTranslator.tsx`, after generating TTS audio:
   - Call `onSendTranslation(audioBase64, translatedText, originalText, sourceLang)`
   - This should already be connected via `GlobalActiveCall`

2. **Verify data channel payload format**
   - Ensure the payload includes: `{ type: 'translation_audio', audioBase64, text, originalText, sourceLang, senderName }`

#### 7b. Fix Incoming Translation Playback
1. **Update GlobalActiveCall handler**
   - Currently listens for `translation_audio` messages
   - Plays via `playTranslatedAudio`
   - Verify this is working correctly

2. **Add bidirectional support**
   - Each participant needs their own translator instance
   - When Partner A speaks Russian → translated to English → broadcast to Partner B
   - Partner B hears English translation
   - Vice versa for Partner B speaking English

3. **Handle translation direction**
   - Add `direction` field to indicate incoming vs outgoing
   - Don't play your own translations back to yourself

**Files to modify:**
- `src/components/RealtimeTranslator.tsx` - Ensure broadcast is called after TTS
- `src/components/GlobalActiveCall.tsx` - Verify incoming handler, add self-filter
- `src/hooks/useLiveKitTranslationBroadcast.ts` - Verify broadcast format

---

## Task 8: Fix Mobile Responsiveness for Calls

### Current State
- Call interface designed for desktop
- Buttons and panels may overflow or be too small on mobile

### Implementation

#### 8a. Responsive Control Bar
1. **Mobile control layout**
   - Use flex-wrap for buttons
   - Reduce button sizes on mobile (use `md:` breakpoints)
   - Consider bottom sheet for additional controls

2. **Touch-friendly interactions**
   - Increase tap targets to minimum 44x44px
   - Add haptic feedback where supported

#### 8b. Responsive Video Layout
1. **Focus mode on mobile**
   - Remote video fills most of screen
   - Local video as small PiP in corner
   
2. **Gallery mode on mobile**
   - 2-column grid instead of 4
   - Larger touch targets for pinning

#### 8c. Panel Responsiveness
1. **Chat panel**
   - Full-screen slide-up on mobile
   - Bottom sheet style

2. **Translator panel**
   - Collapsible on mobile
   - Simplified controls

3. **Header controls**
   - Collapse into hamburger menu on very small screens
   - Priority: mic, camera, end call always visible

**Files to modify:**
- `src/components/LiveKitRoom.tsx` - Add responsive classes throughout
- `src/components/InCallChat.tsx` - Mobile-optimized layout
- `src/components/RealtimeTranslator.tsx` - Mobile layout
- `src/components/FocusVideoLayout.tsx` - Mobile video sizing
- `src/components/GalleryVideoLayout.tsx` - Mobile grid

---

## Technical Considerations

### Data Channel Usage
- LiveKit data channel has size limits (~16KB per message)
- For whiteboard sync, may need to chunk large canvas data
- Translation audio as base64 can be large; consider compression

### State Management
- Panel visibility is already in `ActiveCallContext` (good)
- Chat messages should move to a more persistent store
- Whiteboard state sync may need a dedicated broadcast channel

### Performance
- Mobile devices have limited CPU/memory
- Reduce video resolution on mobile if needed
- Lazy-load translator/whiteboard components

---

## Implementation Order (Recommended)

1. **Task 3** - Default to gallery (simple change)
2. **Task 1** - Tooltips (low risk, UI improvement)
3. **Task 2** - Call sharing link flow (UX improvement)
4. **Task 4** - Panel visibility for guests (permission fix)
5. **Task 6** - Chat persistence + notifications (medium complexity)
6. **Task 8** - Mobile responsiveness (extensive but safe)
7. **Task 5** - Whiteboard sync (complex, requires testing)
8. **Task 7** - Translation broadcast (complex, audio handling)

---

## Estimated Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/tooltip.tsx` | Smoother animation |
| `src/components/LiveKitRoom.tsx` | Tooltips, default layout, responsive classes |
| `src/pages/MeetingRoom.tsx` | Earlier redirect, header buttons |
| `src/pages/Index.tsx` | Better room param handling |
| `src/components/InCallChat.tsx` | Message persistence, glow notification, mobile layout |
| `src/components/CollaborativeWhiteboard.tsx` | Sync open state, canvas state |
| `src/components/DrawingOverlay.tsx` | Sync open state |
| `src/components/RealtimeTranslator.tsx` | Broadcast connection, mobile layout |
| `src/components/GlobalActiveCall.tsx` | Translation handler fixes |
| `src/hooks/useLiveKitTranslationBroadcast.ts` | Verify broadcast format |
| `src/components/FocusVideoLayout.tsx` | Mobile responsive |
| `src/components/GalleryVideoLayout.tsx` | Mobile responsive |
