import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Web (Vercel) is served from the domain root with client-side routing, so
  // assets MUST be referenced with an absolute base ("/") — otherwise deep
  // links like /room/:id resolve "./assets/*" to "/room/assets/*", get the SPA
  // fallback (index.html, text/html) and the app fails to boot with a MIME
  // error. Electron loads via file:// and needs the relative "./" base, so it
  // opts in explicitly via ELECTRON_BUILD=1.
  base: process.env.ELECTRON_BUILD === "1" ? "./" : "/",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          reactVendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          livekitVendor: ["livekit-client", "@livekit/components-react", "@livekit/track-processors"],
          uiVendor: ["framer-motion", "lucide-react", "sonner", "recharts"],
          backendVendor: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
