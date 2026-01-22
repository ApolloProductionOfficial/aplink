import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

// Some WebKit environments (Safari + embedded WebViews like Telegram Desktop on macOS)
// can crash with Radix Tooltip context/provider. We prefer stability over tooltips.
const isProblematicWebKitEnv = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;

  // Real WebKit (Safari / WKWebView). iOS Chrome/Firefox/Edge also contain AppleWebKit,
  // but include their own markers; we exclude those to keep behavior consistent.
  const isWebKit = /AppleWebKit/i.test(ua);
  const isChromiumLike = /(Chrome|Chromium|Edg|CriOS|EdgiOS)/i.test(ua);
  const isOtherIOSBrowser = /(FxiOS|OPiOS|YaBrowser)/i.test(ua);
  return isWebKit && !isChromiumLike && !isOtherIOSBrowser;
};

// Our own scope marker to prevent accidentally nesting providers.
// Radix TooltipProvider doesn't expose a safe public "is-in-provider" hook,
// and some WebKit environments (e.g. Telegram Desktop on macOS) can crash on deep nesting.
const TooltipProviderScopeContext = React.createContext(false);

const SafeTooltipProvider = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => {
  // Disable provider entirely in problematic WebKit environments.
  if (isProblematicWebKitEnv()) return <>{children}</>;

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

// Safe Tooltip that handles WebKit context issues
const Tooltip = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  // Disable tooltips entirely in problematic WebKit environments.
  if (isProblematicWebKitEnv()) {
    // Return only the trigger child, skip tooltip entirely
    return <>{children}</>;
  }

  try {
    return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
  } catch {
    return <>{children}</>;
  }
};

// Helper to detect problematic WebKit environment
const useIsTelegramDesktopWebKit = () => {
  return React.useMemo(() => {
    return isProblematicWebKitEnv();
  }, []);
};

// Safe TooltipTrigger - renders children directly in problematic WebKit
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ children, asChild, ...props }, ref) => {
  const isTelegramDesktopWebKit = useIsTelegramDesktopWebKit();
  
  if (isTelegramDesktopWebKit) {
    // Return the child directly without tooltip trigger wrapper
    return <>{children}</>;
  }

  try {
    return (
      <TooltipPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
        {children}
      </TooltipPrimitive.Trigger>
    );
  } catch {
    return <>{children}</>;
  }
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const isTelegramDesktopWebKit = useIsTelegramDesktopWebKit();
  
  // Don't render content at all in problematic WebKit
  if (isTelegramDesktopWebKit) return null;
  
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

// Legacy alias - now Tooltip is already safe
const SafeTooltip = Tooltip;

export { Tooltip, SafeTooltip, TooltipTrigger, TooltipContent, TooltipProvider, SafeTooltipProvider };
