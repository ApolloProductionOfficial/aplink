import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * A tooltip wrapper that disables tooltips on mobile devices
 * to prevent overflow and UI issues on small screens.
 * On desktop, renders a full tooltip. On mobile, just renders children.
 */
export function MobileTooltip({ 
  children, 
  content, 
  side = "top",
  align = "center",
  className 
}: MobileTooltipProps) {
  const isMobile = useIsMobile();

  // On mobile, just render children without tooltip
  if (isMobile) {
    return <>{children}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent 
        side={side} 
        align={align}
        className={className || "bg-black/80 border-white/10"}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export default MobileTooltip;
