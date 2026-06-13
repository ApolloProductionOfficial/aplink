# AI Translate (Venice-powered)

Auto-translates `src/locales/translations.ts` from the canonical Russian copy
into EN / ES / PT / DE / FR using the Venice API (qwen3-235b by default).
Results are cached to `cache.json` so unchanged strings cost nothing on re-run.

## Setup

1. Make sure `~/.venice_inference_key` exists (or export `VENICE_INFERENCE_KEY`).
2. (Optional) Override the model: `export VENICE_MODEL=claude-sonnet-4-6`.

## Commands

```bash
# Translate everything missing/changed (use this after editing Russian copy)
node tools/ai-translate/translate.mjs

# Cost preview (no API calls)
node tools/ai-translate/translate.mjs --dry-run

# Force-retranslate (e.g. after a model/prompt change)
node tools/ai-translate/translate.mjs --force

# Translate just one language
node tools/ai-translate/translate.mjs --lang es

# Generate sitemap.xml + robots.txt (run after deploying new langs)
node tools/ai-translate/build-sitemap.mjs
```

## How re-translation triggers

Each Russian string is hashed (sha1, 12 chars). On run:

1. If the hash is already in `cache.json` for the target lang → skip (no API
   call, no cost).
2. If not → batch with up to 25 other missing strings, send to Venice, store
   result.
3. Cache writes after every batch (resumable on Ctrl-C).

So workflow is: edit `translations.ts` RU → run `node tools/ai-translate/translate.mjs`
→ only the changed strings get billed.

## Files this touches

- `src/locales/translations.ts` — overwrites RU + EN + ES + PT + DE + FR
  (preserves UK if present)
- `public/translations/<lang>.json` — flat JSON snapshot for SEO/debug
- `tools/ai-translate/cache.json` — hash → lang → translation cache (commit this!)
