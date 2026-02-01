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

// Keys for sessionStorage to prevent reload loops
const HOOK_RELOAD_KEY = 'aplink_hook_reload_attempted';
const TOOLTIP_RELOAD_KEY = 'aplink_tooltip_reload_attempted';

/**
 * Detects if error is a React hooks violation (critical)
 */
function isHookViolationError(errorMessage: string, stack: string = ''): boolean {
  const msg = errorMessage.toLowerCase();
  const stk = stack.toLowerCase();
  
  return (
    // Dev mode messages
    msg.includes('rendered more hooks than during the previous render') ||
    msg.includes('rendered fewer hooks than expected') ||
    msg.includes('hooks can only be called inside') ||
    // Prod mode (minified React error #310)
    msg.includes('minified react error #310') ||
    stk.includes('invariant=310')
  );
}

/**
 * Clears browser caches and Service Workers for a fresh load
 */
async function clearCachesAndSW(): Promise<void> {
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      console.log('[ErrorBoundary] Unregistered', registrations.length, 'service workers');
    }
  } catch (e) {
    console.warn('[ErrorBoundary] Failed to unregister service workers:', e);
  }

  try {
    // Clear Cache Storage API
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      console.log('[ErrorBoundary] Cleared', keys.length, 'cache entries');
    }
  } catch (e) {
    console.warn('[ErrorBoundary] Failed to clear caches:', e);
  }
}

/**
 * Redirects to /__refresh with cache-busting
 */
function redirectToRefresh(): void {
  const currentPath = window.location.pathname + window.location.search;
  const refreshUrl = `/__refresh?to=${encodeURIComponent(currentPath)}&t=${Date.now()}`;
  console.log('[ErrorBoundary] Redirecting to:', refreshUrl);
  window.location.replace(refreshUrl);
}

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

    // --- Check for hook violation errors (highest priority) ---
    const isHookError = isHookViolationError(errorMessage, errorStack);
    
    if (isHookError) {
      console.error('[ErrorBoundary] CRITICAL: React hook violation detected');
      
      // Attempt auto-recovery once per session
      if (!sessionStorage.getItem(HOOK_RELOAD_KEY)) {
        sessionStorage.setItem(HOOK_RELOAD_KEY, 'true');
        console.warn('[ErrorBoundary] Attempting auto-recovery via /__refresh...');
        
        // Clear caches and redirect
        clearCachesAndSW().finally(() => {
          redirectToRefresh();
        });
        return; // Don't show error UI, we're redirecting
      }
      
      // If we already tried auto-recovery, still send notification and show UI
      console.error('[ErrorBoundary] Auto-recovery already attempted, showing error UI');
    }

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

    // For WebKit TooltipProvider crashes: redirect to /__refresh to force cache bypass
    if (isTooltipError && isWebKit) {
      if (!sessionStorage.getItem(TOOLTIP_RELOAD_KEY)) {
        sessionStorage.setItem(TOOLTIP_RELOAD_KEY, 'true');
        console.warn('TooltipProvider crash in WebKit detected, redirecting to /__refresh...');
        redirectToRefresh();
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
        isHookError,
      },
      source: 'React ErrorBoundary',
    });
  }

  private handleRefresh = async () => {
    // Clear the reload attempt flags so user can try again
    sessionStorage.removeItem(HOOK_RELOAD_KEY);
    sessionStorage.removeItem(TOOLTIP_RELOAD_KEY);
    
    // Clear caches and redirect to refresh
    await clearCachesAndSW();
    redirectToRefresh();
  };

  private handleSimpleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-foreground">Что-то пошло не так</h1>
            <p className="text-muted-foreground">Произошла ошибка при загрузке страницы</p>
            
            <div className="flex flex-col gap-2 pt-2">
              {/* Primary action: full refresh with cache clearing */}
              <button
                onClick={this.handleRefresh}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                Обновить свежую версию
              </button>
              
              {/* Secondary action: simple reload */}
              <button
                onClick={this.handleSimpleReload}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors text-sm"
              >
                Простая перезагрузка
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground pt-2">
              Если проблема повторяется, попробуйте очистить кэш браузера
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
