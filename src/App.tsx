import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SafeTooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import AnalyticsRouteTracker from "@/components/AnalyticsRouteTracker";
import Index from "./pages/Index";
import MeetingRoom from "./pages/MeetingRoom";
import MeetingHistory from "./pages/MeetingHistory";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import SharedMeeting from "./pages/SharedMeeting";
import NotFound from "./pages/NotFound";
import Refresh from "./pages/Refresh";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ErrorBoundary>
          <SafeTooltipProvider delayDuration={300}>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AnalyticsRouteTracker />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/room/:roomId" element={<MeetingRoom />} />
                <Route path="/history" element={<MeetingHistory />} />
                <Route path="/shared/:token" element={<SharedMeeting />} />
                <Route path="/__refresh" element={<Refresh />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SafeTooltipProvider>
        </ErrorBoundary>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
