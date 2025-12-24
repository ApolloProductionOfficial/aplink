import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorHandlers } from "./utils/globalErrorHandler";

// Clean up OAuth hash fragments BEFORE any other scripts load
// This prevents Jitsi external_api.js from trying to parse auth tokens
const cleanupOAuthHash = () => {
  if (window.location.hash) {
    const hash = window.location.hash.substring(1);
    // Check if hash contains OAuth tokens (access_token, token_type, etc.)
    if (hash.includes('access_token=') || hash.includes('token_type=')) {
      // Store the hash params temporarily for Supabase auth to process
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      // If we have auth tokens, let Supabase handle them via its auth state listener
      // Clear the hash immediately to prevent Jitsi from parsing it
      if (accessToken || refreshToken) {
        // Store in sessionStorage for Supabase to pick up (optional, Supabase does this automatically)
        // Clear the hash from URL without triggering a page reload
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        console.log('OAuth hash cleaned up to prevent conflicts');
      }
    }
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
