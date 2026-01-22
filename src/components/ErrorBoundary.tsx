import React, { Component, ErrorInfo, ReactNode } from "react";
import { sendErrorNotification } from "@/utils/errorNotification";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Track sent errors to avoid duplicates
const sentBoundaryErrors = new Set<string>();

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Safe message extraction
    const errorMessage = error?.message || error?.toString?.() || "Unknown error";
    
    // Skip common non-actionable errors (TooltipProvider crashes in Safari)
    const componentStack = errorInfo?.componentStack || "";
    const isTooltipError = 
      componentStack.includes("TooltipProvider") ||
      componentStack.includes("Tooltip") ||
      errorMessage.includes("TooltipProvider") ||
      errorMessage.includes("Tooltip must be used");
    
    if (isTooltipError || errorMessage === "No message" || !errorMessage || errorMessage === "Unknown error") {
      // Don't log to console to prevent duplicate notifications
      return;
    }
    
    // Deduplicate - only send once per error message
    const errorKey = `${errorMessage}-${componentStack.substring(0, 100)}`;
    if (sentBoundaryErrors.has(errorKey)) return;
    sentBoundaryErrors.add(errorKey);
    
    // Clear after 5 minutes
    setTimeout(() => sentBoundaryErrors.delete(errorKey), 5 * 60 * 1000);

    // Log without triggering console.error notification (use warn instead)
    console.warn("ErrorBoundary sending notification:", errorMessage.substring(0, 100));
    
    sendErrorNotification({
      errorType: "REACT_ERROR",
      errorMessage,
      details: {
        stack: error?.stack || "No stack trace",
        componentStack: componentStack || "No component stack",
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      source: "React ErrorBoundary",
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">Что-то пошло не так</h1>
            <p className="text-muted-foreground">
              Произошла ошибка. Администратор уже уведомлен.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
