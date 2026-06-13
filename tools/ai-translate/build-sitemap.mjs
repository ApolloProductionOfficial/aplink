#!/usr/bin/env node
/**
 * Build a multilingual sitemap.xml + robots.txt for aplink.live.
 *
 *   node tools/ai-translate/build-sitemap.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const PUBLIC_DIR = resolve(ROOT, "public");

const ORIGIN = "https://aplink.live";
const LANGS = ["ru", "en", "es", "pt", "de", "fr"];
const DEFAULT_LANG = "ru";

// Only public/marketing routes — call rooms / dashboards are private.
const PUBLIC_ROUTES = ["/"];

function urlFor(lang, route) {
  if (lang === DEFAULT_LANG) return `${ORIGIN}${route}`;
  if (route === "/") return `${ORIGIN}/${lang}`;
  return `${ORIGIN}/${lang}${route}`;
}

function urlEntries() {
  const out = [];
  for (const route of PUBLIC_ROUTES) {
    for (const lang of LANGS) {
      const loc = urlFor(lang, route);
      const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, route)}" />`).join("\n");
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(DEFAULT_LANG, route)}" />`;
      out.push(`  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === "/" ? "1.0" : "0.7"}</priority>
${alts}
${xDefault}
  </url>`);
    }
  }
  return out.join("\n");
}

function build() {
  if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries()}
</urlset>
`;
  writeFileSync(join(PUBLIC_DIR, "sitemap.xml"), xml);

  const robots = `User-agent: *
Allow: /
Disallow: /room/
Disallow: /shared/
Disallow: /dashboard
Disallow: /admin
Disallow: /profile
Disallow: /history

Sitemap: ${ORIGIN}/sitemap.xml
`;
  writeFileSync(join(PUBLIC_DIR, "robots.txt"), robots);
  console.log(`Wrote ${join(PUBLIC_DIR, "sitemap.xml")} (${PUBLIC_ROUTES.length} routes × ${LANGS.length} langs = ${PUBLIC_ROUTES.length * LANGS.length} URLs)`);
  console.log(`Wrote ${join(PUBLIC_DIR, "robots.txt")}`);
}

build();
