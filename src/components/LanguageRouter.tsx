/**
 * URL-prefix language router.
 *
 * Strategy:
 *   1. Before React mounts, `stripLanguagePrefix()` (called from main.tsx)
 *      reads `/en|/es|...` from the URL, sets `window.__lang_prefix`, and
 *      rewrites `history.replaceState` to the un-prefixed path so existing
 *      <Route path="/foo"> definitions match unchanged.
 *   2. <LanguageRouter> inside the BrowserRouter syncs the prefix into the
 *      LanguageContext on mount.
 *   3. When the user changes language, we mirror it into the address bar via
 *      `history.replaceState` — React Router stays on its current pathname,
 *      which is fine because pages re-render based on context, not URL.
 *
 * Why not nested routes? Both Apollo sites have ~20 existing routes; cloning
 * them under /:lang would double the route table and break every existing
 * <Link to="/foo">. A history-rewrite alias keeps the diff tiny.
 */
import { useEffect, useRef } from "react";
import {
  useLanguage,
  readLangFromPath,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  Language,
} from "@/contexts/LanguageContext";

/** Rewrite /<lang>/foo → /foo synchronously before React Router mounts. */
export function stripLanguagePrefix(): Language | null {
  if (typeof window === "undefined") return null;
  const { lang, rest } = readLangFromPath(window.location.pathname);
  if (lang) {
    const newPath = rest + window.location.search + window.location.hash;
    if (newPath !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState({}, "", newPath);
    }
    return lang;
  }
  return null;
}

export default function LanguageRouter({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();
  const lastLang = useRef<Language>(language);

  // Mirror language to URL prefix.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastLang.current === language) return;
    lastLang.current = language;
    const path = window.location.pathname;
    // path here is the stripped one (no /lang/ prefix) because stripLanguagePrefix already ran
    const target =
      language === DEFAULT_LANGUAGE
        ? path
        : `/${language}${path === "/" ? "" : path}`;
    if (target !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState({}, "", target + window.location.search + window.location.hash);
    }
  }, [language]);

  // Initial sync: if stripLanguagePrefix() detected a lang, push it into context.
  useEffect(() => {
    const initial = (window as unknown as { __apollo_initial_lang?: Language }).__apollo_initial_lang;
    if (initial && initial !== language) {
      setLanguage(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

export { SUPPORTED_LANGUAGES };
export type { Language };
