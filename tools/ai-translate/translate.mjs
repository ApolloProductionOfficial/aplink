#!/usr/bin/env node
/**
 * AI Translate — Venice-powered translator for Apollo Vite/React sites.
 *
 * Reads canonical Russian copy from src/locales/translations.ts, hashes each
 * string, and fills missing/changed translations for EN/ES/PT/DE/FR using
 * Venice API. Results are written back into translations.ts so runtime stays
 * compile-time-safe (no network calls).
 *
 * Re-run after editing Russian copy. Strings that did not change are pulled
 * from cache (tools/ai-translate/cache.json) — no API call, no cost.
 *
 * Usage:
 *   node tools/ai-translate/translate.mjs            # translate missing strings
 *   node tools/ai-translate/translate.mjs --force    # re-translate everything
 *   node tools/ai-translate/translate.mjs --lang es  # only one target
 *   node tools/ai-translate/translate.mjs --dry-run  # cost preview, no writes
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const TRANSLATIONS_FILE = resolve(ROOT, "src/locales/translations.ts");
const CACHE_FILE = resolve(__dirname, "cache.json");
const PUBLIC_DIR = resolve(ROOT, "public/translations");

const SOURCE_LANG = "ru";
const TARGET_LANGS = ["en", "es", "pt", "de", "fr"];
const LANG_NAMES = {
  en: "English",
  es: "Spanish (Spain)",
  pt: "Portuguese (Brazil)",
  de: "German",
  fr: "French",
};

const VENICE_KEY_PATH = join(homedir(), ".venice_inference_key");
const VENICE_MODEL = process.env.VENICE_MODEL || "qwen3-235b-a22b-instruct-2507";
const VENICE_ENDPOINT = "https://api.venice.ai/api/v1/chat/completions";

// CLI args
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY_RUN = args.includes("--dry-run");
const ONLY_LANG = (() => {
  const i = args.indexOf("--lang");
  return i >= 0 ? args[i + 1] : null;
})();
const TARGETS = ONLY_LANG ? [ONLY_LANG] : TARGET_LANGS;

// ---------- Helpers ----------

const sha1 = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);

function loadVeniceKey() {
  if (process.env.VENICE_INFERENCE_KEY) return process.env.VENICE_INFERENCE_KEY.trim();
  if (existsSync(VENICE_KEY_PATH)) return readFileSync(VENICE_KEY_PATH, "utf8").trim();
  throw new Error(`Venice key not found at ${VENICE_KEY_PATH} or VENICE_INFERENCE_KEY env`);
}

function loadCache() {
  if (!existsSync(CACHE_FILE)) return { _meta: { model: VENICE_MODEL }, strings: {} };
  const data = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
  if (!data.strings) data.strings = {};
  if (!data._meta) data._meta = { model: VENICE_MODEL };
  return data;
}

function saveCache(cache) {
  cache._meta.updatedAt = new Date().toISOString();
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + "\n");
}

/**
 * Parse the translations.ts file with a tolerant recursive-descent reader.
 * The file is a single `export const translations = { ru: {...}, en: {...}, uk: {...} };`
 * declaration. We extract each top-level lang block as a raw JS-object literal,
 * then evaluate it via the Function constructor (safe — content is our own source).
 */
function loadTranslations() {
  const src = readFileSync(TRANSLATIONS_FILE, "utf8");
  // find `export const translations = {` ... `};` — full object
  const open = src.indexOf("export const translations");
  if (open < 0) throw new Error("translations.ts: marker `export const translations` not found");
  const eq = src.indexOf("=", open);
  const objStart = src.indexOf("{", eq);
  if (objStart < 0) throw new Error("translations.ts: opening brace not found");
  // find matching closing brace
  let depth = 0;
  let i = objStart;
  let inStr = null;
  let escape = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (c === "\\") {
        escape = true;
      } else if (c === inStr) {
        inStr = null;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const objLiteral = src.slice(objStart, i);
  // Evaluate via Function — translations.ts contains pure-data object only.
  // eslint-disable-next-line no-new-func
  const obj = Function(`"use strict"; return (${objLiteral});`)();
  return { obj, src, objStart, objEnd: i };
}

/** Walk nested object → emit list of {path, value} for every string leaf. */
function* walkStrings(obj, path = []) {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    const p = [...path, key];
    if (typeof v === "string") {
      yield { path: p, value: v };
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const av = v[i];
        if (typeof av === "string") yield { path: [...p, i], value: av };
        else if (av && typeof av === "object") yield* walkStrings(av, [...p, i]);
      }
    } else if (v && typeof v === "object") {
      yield* walkStrings(v, p);
    }
  }
}

function getByPath(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function setByPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    const next = path[i + 1];
    if (cur[k] == null) cur[k] = typeof next === "number" ? [] : {};
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

/** Venice request — translate a batch of strings to one target language. */
async function veniceTranslateBatch(strings, targetLang, key) {
  const langName = LANG_NAMES[targetLang] || targetLang;
  const system = `You are a professional translator for a marketing website of an OnlyFans management agency targeting global creators and fans.
Translate the provided JSON array of strings from Russian to ${langName}.
Rules:
- Output ONLY a valid JSON array of strings, same length and order as input.
- Preserve every emoji, brand name (Apollo, APLink, OnlyFans, Telegram, Instagram, TikTok, Reddit, Twitter, X), URL, hashtag and number unchanged.
- Preserve placeholders like {name}, {{count}}, %s, $1.
- Preserve HTML tags and Markdown formatting exactly.
- Use natural marketing tone, not literal translation.
- Currency stays in USD ($) — do NOT convert.
- Do NOT add commentary, quotes around the array, or extra fields.`;
  const user = JSON.stringify(strings);

  const body = {
    model: VENICE_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 8000,
    venice_parameters: { include_venice_system_prompt: false },
  };

  const res = await fetch(VENICE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Venice ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Venice: empty content");
  const usage = json.usage || {};

  // tolerant JSON-array parse — model occasionally wraps with ```json ... ```
  let cleaned = content;
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch (e) {
    // last-resort: find first [ and last ]
    const a = cleaned.indexOf("[");
    const b = cleaned.lastIndexOf("]");
    if (a >= 0 && b > a) {
      arr = JSON.parse(cleaned.slice(a, b + 1));
    } else {
      throw new Error(`Venice returned non-JSON: ${cleaned.slice(0, 200)}`);
    }
  }
  if (!Array.isArray(arr) || arr.length !== strings.length) {
    throw new Error(`Venice returned ${Array.isArray(arr) ? arr.length : "non-array"}, expected ${strings.length}`);
  }
  return { translations: arr, usage };
}

/** Serialize JS object back to TypeScript-style literal. Conservative: 2-sp indent, double-quoted keys when needed, double-quoted strings with proper escaping. */
function serialize(obj, indent = "  ") {
  const KEY_OK = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  function fmtStr(s) {
    return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
  }
  function fmtKey(k) {
    return KEY_OK.test(k) ? k : fmtStr(k);
  }
  function rec(v, depth) {
    const pad = indent.repeat(depth);
    const padNext = indent.repeat(depth + 1);
    if (v === null) return "null";
    if (typeof v === "string") return fmtStr(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      const allPrimitive = v.every((x) => typeof x !== "object" || x === null);
      if (allPrimitive && v.length <= 6) {
        return "[" + v.map((x) => rec(x, depth + 1)).join(", ") + "]";
      }
      return "[\n" + v.map((x) => padNext + rec(x, depth + 1)).join(",\n") + "\n" + pad + "]";
    }
    if (typeof v === "object") {
      const keys = Object.keys(v);
      if (keys.length === 0) return "{}";
      return "{\n" + keys.map((k) => padNext + fmtKey(k) + ": " + rec(v[k], depth + 1)).join(",\n") + "\n" + pad + "}";
    }
    return "null";
  }
  return rec(obj, 0);
}

// ---------- Main ----------

async function main() {
  const t0 = Date.now();
  const veniceKey = loadVeniceKey();
  const { obj: translations, src, objStart, objEnd } = loadTranslations();

  if (!translations[SOURCE_LANG]) {
    throw new Error(`Source language '${SOURCE_LANG}' missing from translations.ts`);
  }
  const sourceTree = translations[SOURCE_LANG];

  const cache = loadCache();
  if (cache._meta.model && cache._meta.model !== VENICE_MODEL) {
    console.log(`[info] cache built with model=${cache._meta.model}, current=${VENICE_MODEL} (still using cache)`);
  }

  // Build list of source strings + hashes
  const sourceList = [...walkStrings(sourceTree)];
  console.log(`[info] source strings: ${sourceList.length}`);

  // Bootstrap cache from any existing hand-curated translations already in
  // translations.ts (e.g. 'en' or 'uk'). For each source string, if a matching
  // path exists in a target tree AND its hash is not yet cached, seed it.
  let seeded = 0;
  for (const lang of Object.keys(translations)) {
    if (lang === SOURCE_LANG) continue;
    const tree = translations[lang];
    if (!tree || typeof tree !== "object") continue;
    for (const item of sourceList) {
      const hash = sha1(item.value);
      const existing = getByPath(tree, item.path);
      if (typeof existing !== "string") continue;
      if (existing === item.value) continue; // identical = not translated
      if (!cache.strings[hash]) cache.strings[hash] = {};
      if (!cache.strings[hash][lang]) {
        cache.strings[hash][lang] = existing;
        seeded++;
      }
    }
  }
  if (seeded > 0) {
    console.log(`[info] seeded ${seeded} cache entries from existing translations`);
    saveCache(cache);
  }

  // Stats
  let totalApiCalls = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTotalTokens = 0;
  const perLang = {};

  for (const lang of TARGETS) {
    if (!LANG_NAMES[lang]) {
      console.log(`[skip] ${lang} — not in TARGET_LANGS`);
      continue;
    }
    perLang[lang] = { translated: 0, cached: 0, tokens: 0, apiCalls: 0 };

    // Identify which strings need translation
    const missing = []; // { idx, path, value, hash }
    for (let i = 0; i < sourceList.length; i++) {
      const item = sourceList[i];
      const hash = sha1(item.value);
      const cachedTr = cache.strings[hash]?.[lang];
      if (!FORCE && cachedTr) {
        // cache hit
        perLang[lang].cached++;
        continue;
      }
      missing.push({ idx: i, path: item.path, value: item.value, hash });
    }

    console.log(`[lang ${lang}] cached=${perLang[lang].cached}, to-translate=${missing.length}`);
    if (DRY_RUN) continue;
    if (missing.length === 0) continue;

    // Batch — Venice limit ~8K output tokens, group ~25 strings per call
    const BATCH = 25;
    for (let start = 0; start < missing.length; start += BATCH) {
      const batch = missing.slice(start, start + BATCH);
      const inputs = batch.map((b) => b.value);
      const label = `[${lang} batch ${Math.floor(start / BATCH) + 1}/${Math.ceil(missing.length / BATCH)}]`;
      try {
        process.stdout.write(`${label} translating ${inputs.length}... `);
        const { translations: out, usage } = await veniceTranslateBatch(inputs, lang, veniceKey);
        perLang[lang].apiCalls++;
        perLang[lang].tokens += usage.total_tokens || 0;
        totalApiCalls++;
        totalPromptTokens += usage.prompt_tokens || 0;
        totalCompletionTokens += usage.completion_tokens || 0;
        totalTotalTokens += usage.total_tokens || 0;
        // store in cache
        for (let k = 0; k < batch.length; k++) {
          const { hash } = batch[k];
          if (!cache.strings[hash]) cache.strings[hash] = {};
          cache.strings[hash][lang] = out[k];
          perLang[lang].translated++;
        }
        process.stdout.write(`ok (${usage.total_tokens || "?"}tk)\n`);
        // checkpoint after each batch
        saveCache(cache);
      } catch (e) {
        console.error(`${label} FAILED: ${e.message}`);
        // brief backoff then continue
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  if (DRY_RUN) {
    console.log("\n=== DRY RUN ===");
    for (const lang of TARGETS) {
      console.log(`${lang}: cached=${perLang[lang]?.cached || 0}, would-translate=${sourceList.length - (perLang[lang]?.cached || 0)}`);
    }
    return;
  }

  // Now rebuild translations object with cache-driven trees
  for (const lang of TARGETS) {
    if (!LANG_NAMES[lang]) continue;
    const tree = {};
    for (const item of sourceList) {
      const hash = sha1(item.value);
      const tr = cache.strings[hash]?.[lang];
      if (tr != null) setByPath(tree, item.path, tr);
      else setByPath(tree, item.path, item.value); // fall back to source
    }
    translations[lang] = tree;

    // Also emit public/translations/<lang>.json for runtime debug / hreflang preview
    if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
    writeFileSync(join(PUBLIC_DIR, `${lang}.json`), JSON.stringify(tree, null, 2) + "\n");
  }

  // Serialize back into translations.ts — preserve existing 'uk' if present, drop other unknown langs only if untouched
  const langOrder = ["ru", "en", "es", "pt", "de", "fr"];
  if (translations.uk) langOrder.push("uk");
  for (const k of Object.keys(translations)) {
    if (!langOrder.includes(k)) langOrder.push(k);
  }
  const ordered = {};
  for (const k of langOrder) if (translations[k]) ordered[k] = translations[k];

  const newObjLiteral = serialize(ordered, "  ");
  const newSrc = src.slice(0, objStart) + newObjLiteral + src.slice(objEnd);
  writeFileSync(TRANSLATIONS_FILE, newSrc);

  // Final report
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== Summary ===");
  console.log(`time: ${dt}s`);
  console.log(`api calls: ${totalApiCalls}`);
  console.log(`tokens: prompt=${totalPromptTokens}, completion=${totalCompletionTokens}, total=${totalTotalTokens}`);
  // Venice qwen3-235b: per pricing page, ~ $0.65 / 1M tokens (input+output mixed). Use rough $0.0000007/tk.
  const approxCostUsd = (totalTotalTokens * 0.0000007).toFixed(4);
  console.log(`approx cost: $${approxCostUsd} (qwen3-235b @ ~$0.65/1M tokens)`);
  for (const lang of TARGETS) {
    const p = perLang[lang] || {};
    console.log(`  ${lang}: translated=${p.translated || 0}, cached=${p.cached || 0}, tokens=${p.tokens || 0}`);
  }
  console.log(`\nWrote: ${TRANSLATIONS_FILE}`);
  console.log(`Cache: ${CACHE_FILE}`);
  console.log(`JSON: ${PUBLIC_DIR}/<lang>.json`);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
