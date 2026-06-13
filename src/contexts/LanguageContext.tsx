import * as React from "react";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "ru" | "en" | "es" | "pt" | "de" | "fr" | "uk";

export const SUPPORTED_LANGUAGES: Language[] = ["ru", "en", "es", "pt", "de", "fr", "uk"];
export const DEFAULT_LANGUAGE: Language = "ru";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Map locale codes / region prefixes to one of our supported languages.
 * Used for both Accept-Language detection and URL-prefix routing.
 */
function normalizeLocale(raw: string | null | undefined): Language | null {
  if (!raw) return null;
  const lc = raw.toLowerCase().split(/[-_]/)[0];
  if ((SUPPORTED_LANGUAGES as string[]).includes(lc)) return lc as Language;
  // common fallbacks
  if (lc === "uk") return "uk";
  if (["pt", "br"].includes(lc)) return "pt";
  if (["es", "ca", "gl"].includes(lc)) return "es";
  return null;
}

/** Map country codes (from IP geo) to languages. */
const countryToLanguage: Record<string, Language> = {
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru", TJ: "ru",
  UA: "uk",
  US: "en", GB: "en", CA: "en", AU: "en", NZ: "en", IE: "en", IN: "en", ZA: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", CU: "es", DO: "es", BO: "es", GT: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  DE: "de", AT: "de", CH: "de", LI: "de", LU: "de",
  FR: "fr", BE: "fr", MC: "fr", SN: "fr", CI: "fr", MA: "fr", DZ: "fr", TN: "fr",
};

/**
 * Inspect the URL path for a /<lang>/... prefix.
 * Returns the language code and the remaining path.
 */
export function readLangFromPath(pathname: string): { lang: Language | null; rest: string } {
  const m = pathname.match(/^\/([a-z]{2})(?=\/|$)/i);
  if (!m) return { lang: null, rest: pathname };
  const candidate = m[1].toLowerCase();
  if ((SUPPORTED_LANGUAGES as string[]).includes(candidate)) {
    return { lang: candidate as Language, rest: pathname.slice(m[0].length) || "/" };
  }
  return { lang: null, rest: pathname };
}

/** Best-guess language at first load — URL > localStorage > browser > default. */
function pickInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  // 1. URL prefix
  const fromUrl = readLangFromPath(window.location.pathname).lang;
  if (fromUrl) return fromUrl;
  // 2. saved preference
  const saved = localStorage.getItem("language");
  if (saved && (SUPPORTED_LANGUAGES as string[]).includes(saved)) return saved as Language;
  // 3. navigator.languages
  const navLangs = (navigator.languages || [navigator.language]).filter(Boolean);
  for (const nl of navLangs) {
    const mapped = normalizeLocale(nl);
    if (mapped) return mapped;
  }
  return DEFAULT_LANGUAGE;
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => pickInitialLanguage());

  // Keep <html lang> in sync for accessibility + SEO crawlers.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  // First-visit IP geo fallback (only if user hasn't picked manually).
  useEffect(() => {
    if (localStorage.getItem("language")) return;
    if (readLangFromPath(window.location.pathname).lang) return;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3000);
    fetch("https://ipapi.co/json/", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        clearTimeout(t);
        if (!data) return;
        const cc = data.country_code;
        const mapped = cc ? countryToLanguage[cc] : null;
        if (mapped && mapped !== language) {
          setLanguageState(mapped);
          localStorage.setItem("language", mapped);
        }
      })
      .catch(() => {});
    return () => {
      clearTimeout(t);
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
