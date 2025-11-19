import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import TrafficSources from "./pages/TrafficSources";
import CryptoUnlock from "./pages/CryptoUnlock";
import ModelVerification from "./pages/ModelVerification";
import PartnershipProgram from "./pages/PartnershipProgram";
import DubaiResidency from "./pages/DubaiResidency";
import WebcamServices from "./pages/WebcamServices";
import InstagramAutomation from "./pages/InstagramAutomation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/traffic-sources" element={<TrafficSources />} />
            <Route path="/crypto-unlock" element={<CryptoUnlock />} />
            <Route path="/model-verification" element={<ModelVerification />} />
            <Route path="/partnership" element={<PartnershipProgram />} />
            <Route path="/dubai-residency" element={<DubaiResidency />} />
            <Route path="/webcam-services" element={<WebcamServices />} />
            <Route path="/instagram-automation" element={<InstagramAutomation />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
