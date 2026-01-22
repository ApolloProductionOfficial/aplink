import { Component, ErrorInfo, ReactNode } from 'react';
import { sendErrorNotification } from '@/utils/errorNotification';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// Dedupe: track errors we've already sent to prevent spam
const sentBoundaryErrors = new Set<string>();

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Extract safe strings
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || '';
    const componentStack = errorInfo?.componentStack || '';

    // Detect WebKit environment (Safari / Telegram Desktop macOS)
    const isWebKit =
      typeof navigator !== 'undefined' &&
      /AppleWebKit/i.test(navigator.userAgent) &&
      !/Chrome|Chromium|Edg/i.test(navigator.userAgent);

    // --- Filter out noise ---
    // 1. TooltipProvider context issues (Safari/Radix)
    const isTooltipError =
      componentStack.includes('TooltipProvider') ||
      componentStack.includes('Tooltip') ||
      errorMessage.includes('TooltipProvider');

    // 2. Empty or useless messages
    const isEmptyError =
      errorMessage === '{}' ||
      errorMessage === 'No message' ||
      errorMessage === 'Unknown error' ||
      errorMessage.trim() === '';

    // For WebKit TooltipProvider crashes: try forced reload once per session
    if (isTooltipError && isWebKit) {
      const reloadKey = 'aplink_tooltip_reload_attempted';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true');
        console.warn('TooltipProvider crash in WebKit detected, forcing reload...');
        // WebKit (Safari / embedded WebViews) can aggressively cache old hashed assets.
        // Add a cache-busting query param to maximize chance of fetching the newest build.
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('__cb', String(Date.now()));
          window.location.replace(url.toString());
        } catch {
          window.location.reload();
        }
        return;
      }
    }

    // Skip notification for known noise (but still log quietly)
    if (isTooltipError || isEmptyError) {
      console.warn('ErrorBoundary filtered noise:', errorMessage);
      return;
    }

    // Dedupe key: message + first 100 chars of component stack
    const errorKey = `${errorMessage}::${componentStack.substring(0, 100)}`;
    if (sentBoundaryErrors.has(errorKey)) {
      return;
    }
    sentBoundaryErrors.add(errorKey);

    // Clear old keys after 5 minutes
    setTimeout(() => sentBoundaryErrors.delete(errorKey), 5 * 60 * 1000);

    // Send notification
    sendErrorNotification({
      errorType: 'REACT_ERROR',
      errorMessage,
      details: {
        stack: errorStack.substring(0, 500),
        componentStack: componentStack.substring(0, 300),
      },
      source: 'React ErrorBoundary',
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-foreground">Что-то пошло не так</h1>
            <p className="text-muted-foreground">Произошла ошибка при загрузке страницы</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
