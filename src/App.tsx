import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import MeetingRoom from "./pages/MeetingRoom";
import MeetingHistory from "./pages/MeetingHistory";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/room/:roomId" element={<MeetingRoom />} />
                <Route path="/history" element={<MeetingHistory />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ErrorBoundary>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
