import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Public Supabase anon creds (project otpqvjrdhaitghygkdnc). Safe in the bundle
// (RLS-gated). Used as a build-time fallback so the app NEVER ships with empty
// VITE_SUPABASE_* values — empty values make createClient() throw at module load
// and blank the whole SPA (the cause of the aplink.live black screen, where the
// Vercel env vars were defined but empty).
const FALLBACK_SUPABASE_URL = "https://otpqvjrdhaitghygkdnc.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90cHF2anJkaGFpdGdoeWdrZG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjMyMzUsImV4cCI6MjA5MTMzOTIzNX0.kD1r2-Rsd1FBG-k3PUuXhCGe_Ji-BthteniWn6w6Zdw";
const FALLBACK_SUPABASE_PROJECT_ID = "otpqvjrdhaitghygkdnc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const SUPABASE_URL = env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  const SUPABASE_PROJECT_ID =
    env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID;

  return {
  // Statically replace import.meta.env.VITE_SUPABASE_* across the whole app so
  // every reference (client init + ~20 fetch call-sites) gets a real value even
  // when the host injects empty env vars.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(SUPABASE_PUBLISHABLE_KEY),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(SUPABASE_PROJECT_ID),
  },
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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  };
});
