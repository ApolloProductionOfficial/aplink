
# APLink Mobile & UX Improvements Plan

## Overview

This plan addresses multiple improvements:
1. Make chat fullscreen on mobile (bottom sheet style)
2. Add tooltips to header buttons (Timer, PiP) with smoother animations
3. Complete mobile-first redesign for call controls
4. Touch-to-show panels on mobile
5. Remove or minimize tooltips on mobile to prevent overflow
6. Fix whiteboard on mobile with landscape orientation hint
7. Fix DrawingOverlay mobile controls (remove escape panel, fit all buttons)
8. Fix Apollo background requiring two clicks

---

## Task 1: Fix Apollo Virtual Background (Two-Click Issue)

### Problem
The Apollo background requires two clicks because `handleStaticImageSelect` toggles selection - first click selects, but background processing is async and may not complete before UI state updates.

### Solution
In `VirtualBackgroundSelector.tsx`:
1. Track loading state specifically for static images
2. Don't toggle off if we're still processing the image
3. Apply background immediately on first click

### Files to Modify
- `src/components/VirtualBackgroundSelector.tsx`

---

## Task 2: Add Tooltips to Header Buttons + Smoother Animations

### Current State
- Header panel has PiP button and Timer without tooltips
- Tooltip animation is default Radix timing

### Implementation
1. **Wrap PiP button in header with Tooltip** (already has `title` attr, upgrade to proper Tooltip)
2. **Wrap Timer button with Tooltip**
3. **Disable tooltips on mobile** - use `useIsMobile` hook to conditionally render tooltips only on desktop

### Files to Modify
- `src/components/LiveKitRoom.tsx` - Wrap header PiP button
- `src/components/CallTimer.tsx` - Wrap timer trigger button

---

## Task 3: Mobile-First Chat Panel (Fullscreen Bottom Sheet)

### Current State
- Chat panel is fixed at 320px wide, positioned with drag
- Not optimized for mobile

### Implementation
1. **Detect mobile using `useIsMobile` hook**
2. **Mobile layout**:
   - Full width (`inset-x-0`)
   - Height: `h-[70vh]` or similar
   - Position: bottom of screen
   - Slide-up animation
   - Remove drag functionality on mobile
   - Larger touch targets for buttons
3. **Desktop layout**: Keep current draggable panel

### Files to Modify
- `src/components/InCallChat.tsx`

---

## Task 4: Touch-to-Show Panels on Mobile

### Current State
- Panels auto-hide based on mouse movement
- No tap-to-show for touch devices

### Implementation
1. **Add touch handler to video container**:
   - On tap, toggle panel visibility
   - Auto-hide after 4 seconds of no interaction
2. **Update `handleMouseMove` logic**:
   - On mobile, use touch events instead of mouse
   - Detect tap vs swipe

### Files to Modify
- `src/components/LiveKitRoom.tsx`

---

## Task 5: Remove/Minimize Tooltips on Mobile

### Problem
- TooltipContent overflows on small screens
- Buttons with tooltips go out of view when descriptions appear

### Solution
1. **Create mobile-aware Tooltip wrapper**:
   - On mobile: render only children (no tooltip)
   - On desktop: full tooltip with content
2. **Apply to all control buttons**

### Implementation
Create a `MobileTooltip` component that conditionally renders:
```tsx
const MobileTooltip = ({ children, content }) => {
  const isMobile = useIsMobile();
  if (isMobile) return children;
  return <Tooltip>{/* ... */}</Tooltip>;
};
```

### Files to Modify
- `src/components/LiveKitRoom.tsx` - Replace all bottom panel Tooltips with MobileTooltip

---

## Task 6: Fix Whiteboard on Mobile (Landscape Hint)

### Current State
- Whiteboard tools in header overflow on mobile
- Canvas aspect ratio doesn't work well in portrait

### Implementation
1. **Add orientation detection**:
   - Detect if phone is in portrait mode
   - Show overlay hint: "Поверните телефон для лучшей работы с доской"
2. **Mobile-optimized toolbar**:
   - Collapse tools into a hamburger/expandable menu
   - Show only essential tools (pen, eraser, clear, close)
   - Color picker in a popover
   - Slider in a separate popover
3. **Larger touch targets** (minimum 44px)
4. **Close button always visible** in corner

### Files to Modify
- `src/components/CollaborativeWhiteboard.tsx`

---

## Task 7: Fix DrawingOverlay on Mobile

### Current State
- ESC hint panel shown at bottom (useless on mobile)
- Controls may overflow
- Close button may be hidden

### Implementation
1. **Remove ESC/Ctrl+Z hint panel on mobile**
2. **Simplify mobile toolbar**:
   - Only show: color row, 3-4 essential tools, close button
   - Collapsible advanced options
3. **Fixed close button** in top-right corner (always visible)
4. **Touch-friendly interactions**:
   - Larger color buttons
   - Larger tool buttons

### Files to Modify
- `src/components/DrawingOverlay.tsx`

---

## Task 8: Complete Mobile Control Bar Redesign

### Current State
- Bottom panel has many buttons, some overflow
- Button sizes inconsistent on mobile

### Implementation
1. **Two-row layout on mobile** if too many buttons:
   - Primary row: Camera, Mic, End Call
   - Secondary row (expandable): Other tools
2. **Or: Collapsible "More" button** that opens a sheet with additional controls
3. **Smaller button sizes on mobile**: `w-10 h-10` instead of `w-12 h-12`
4. **Remove text from "Выйти" button on mobile** - icon only
5. **Ensure all buttons fit** in viewport width

### Files to Modify
- `src/components/LiveKitRoom.tsx`

---

## Task 9: Header Panel Mobile Optimization

### Current State
- Header buttons may overflow on narrow screens
- Room name takes space

### Implementation
1. **Hide room name on mobile** (or truncate severely)
2. **Collapse header buttons into menu** on very small screens
3. **Reduce button sizes** in header for mobile

### Files to Modify
- `src/components/LiveKitRoom.tsx`

---

## Technical Implementation Details

### Mobile Detection
Use existing `useIsMobile` hook from `src/hooks/use-mobile.tsx`

### New MobileTooltip Component
Create a wrapper that disables tooltips on mobile to prevent overflow:

```tsx
// In LiveKitRoom.tsx or as separate component
const MobileTooltip = ({ children, content, ...props }) => {
  const isMobile = useIsMobile();
  if (isMobile) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent {...props}>{content}</TooltipContent>
    </Tooltip>
  );
};
```

### Touch Panel Toggle
```tsx
// In LiveKitRoom.tsx
const [panelsVisible, setPanelsVisible] = useState(true);
const lastTouchRef = useRef(Date.now());

const handleTouchStart = () => {
  if (isMobile) {
    setPanelsVisible(true);
    lastTouchRef.current = Date.now();
    // Auto-hide after 4 seconds
    setTimeout(() => {
      if (Date.now() - lastTouchRef.current >= 4000) {
        setPanelsVisible(false);
      }
    }, 4000);
  }
};
```

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/VirtualBackgroundSelector.tsx` | Fix two-click issue for Apollo background |
| `src/components/LiveKitRoom.tsx` | Mobile control bar, touch panels, MobileTooltip, header optimization |
| `src/components/InCallChat.tsx` | Fullscreen bottom sheet on mobile |
| `src/components/CallTimer.tsx` | Add tooltip to trigger button |
| `src/components/CollaborativeWhiteboard.tsx` | Mobile toolbar, landscape hint |
| `src/components/DrawingOverlay.tsx` | Mobile toolbar, remove ESC hint, always-visible close |

---

## Implementation Order

1. **Task 1** - Fix Apollo background (quick fix)
2. **Task 2** - Add tooltips to header (quick)
3. **Task 5** - Create MobileTooltip wrapper (foundation for others)
4. **Task 8** - Mobile control bar redesign
5. **Task 9** - Header mobile optimization
6. **Task 4** - Touch-to-show panels
7. **Task 3** - Mobile chat fullscreen
8. **Task 6** - Whiteboard mobile fix
9. **Task 7** - DrawingOverlay mobile fix

---

## Visual Behavior Summary

### Mobile Call Interface
- Tap anywhere on video to show/hide top and bottom panels
- Panels auto-hide after 4 seconds
- No tooltip descriptions (prevents overflow)
- Smaller button sizes throughout
- Chat opens as fullscreen bottom sheet
- Whiteboard shows landscape orientation hint
- Drawing overlay has simplified, always-visible close button
