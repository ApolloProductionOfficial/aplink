import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
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
