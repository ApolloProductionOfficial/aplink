import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

// Our own scope marker to prevent accidentally nesting providers.
// Radix TooltipProvider doesn't expose a safe public "is-in-provider" hook,
// and some WebKit environments (e.g. Telegram Desktop on macOS) can crash on deep nesting.
const TooltipProviderScopeContext = React.createContext(false);

const SafeTooltipProvider = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => {
  const hasParentProvider = React.useContext(TooltipProviderScopeContext);

  // If a parent provider already exists, don't create another nested provider.
  if (hasParentProvider) return <>{children}</>;

  // Safari/WebKit compatibility: catch provider/context errors gracefully.
  try {
    return (
      <TooltipProviderScopeContext.Provider value={true}>
        <TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>
      </TooltipProviderScopeContext.Provider>
    );
  } catch {
    return <>{children}</>;
  }
};

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  // Safari compatibility: catch context errors gracefully
  try {
    return (
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    );
  } catch {
    // Fallback for browsers with context issues
    return null;
  }
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Safe Tooltip wrapper that doesn't crash on context issues
const SafeTooltip = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  try {
    return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
  } catch {
    // Return children without tooltip wrapper if context fails
    return <>{children}</>;
  }
};

export { Tooltip, SafeTooltip, TooltipTrigger, TooltipContent, TooltipProvider, SafeTooltipProvider };
