import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "./utils/globalErrorHandler";

// Clean up auth hash fragments ONLY on meeting room routes.
// Jitsi can misinterpret access tokens in the URL hash, but password recovery/OAuth
// flows rely on that hash to create an auth session.
const cleanupOAuthHash = () => {
  const { hash, pathname, search } = window.location;
  if (!hash) return;

  const isMeetingRoomRoute = pathname.startsWith('/room/');
  if (!isMeetingRoomRoute) return;

  const hashContent = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!hashContent) return;

  const hasAuthTokens =
    hashContent.includes('access_token=') ||
    hashContent.includes('refresh_token=') ||
    hashContent.includes('token_type=');

  if (hasAuthTokens) {
    window.history.replaceState(null, '', pathname + search);
    console.log('Auth hash cleaned up on meeting room route to prevent conflicts');
  }
};

// Run cleanup immediately
cleanupOAuthHash();

// Initialize global error handlers for email notifications
initGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
