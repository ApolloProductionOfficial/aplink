import React, { Component, ErrorInfo, ReactNode } from "react";
import { sendErrorNotification } from "@/utils/errorNotification";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    
    // Send notification
    sendErrorNotification({
      errorType: "REACT_ERROR",
      errorMessage: error.message,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
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
