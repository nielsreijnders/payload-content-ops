# payload-content-ops

> Formerly published as `payload-sync-ai-translations` — see [Migrating from payload-sync-ai-translations](#-migrating-from-payload-sync-ai-translations).

## Overview

**payload-content-ops** is a content-operations plugin for Payload CMS: bulk, reviewable operations on your content — AI-powered translation sync, grammar checks, SEO auditing, link syncing, translation status and find & replace.

Its flagship workflow is one-click translation: it automatically translates your documents into all available languages, intelligently detects missing context, and allows you to review and edit translations before applying them.

Built using the official [Payload Plugin Template](https://payloadcms.com/docs/plugins/overview), this plugin is reusable, modular, and easy to integrate into any Payload setup.

---

## ✨ Features

- 🔁 **One-click translation:** Instantly translate a document into all available languages.
- 🧠 **AI context detection:** Detects missing or incomplete context rather than stylistic differences.
- 💬 **Interactive review modal:** Review, skip, or edit translations before applying.
- 🚀 **Auto-sync updates:** Apply all confirmed translations across all languages.
- 📝 **Manual override:** Preserve manually edited content automatically.
- ⚙️ **Exclude specific fields:** Easily exclude fields from being translated.
- 🔎 **SEO overview:** Full-scan configured collections, score every document, and edit
  Payload SEO titles/descriptions inline.
- 🔁 **Find & replace:** Search all configured collections and globals for a text (per locale,
  optionally case-sensitive or whole-word), review the matches, and replace them in bulk.
- 🔗 **Link syncing:** Rewrite internal links to their localized equivalents via alternate
  (`hreflang`) tags, with a verified locale-prefix fallback for hardcoded paths like `/blog`.
- 🗂️ **Status-aware saves:** Plugin saves mirror the source document's publish state — published
  documents publish only the saved locale, drafts stay drafts.
- 🔒 **Authenticated endpoints:** All plugin endpoints require a logged-in user.

---

## 📦 Installation

Install via your package manager:

```bash
pnpm install payload-content-ops
# or
npm install payload-content-ops
```

---

## ⚙️ Usage

Add the plugin to your Payload config:

```ts
import { seoPlugin } from '@payloadcms/plugin-seo'
import { buildConfig } from 'payload/config'
import { payloadContentOps } from 'payload-content-ops'

export default buildConfig({
  plugins: [
    seoPlugin({
      collections: ['posts'],
      uploadsCollection: 'media',
    }),
    payloadContentOps({
      collections: {
        posts: {
          excludeFields: ['slug'],
          seo: {
            // Defaults integrate with @payloadcms/plugin-seo:
            // meta.title and meta.description
            contentFields: ['title', 'content', 'layout'],
          },
        },
      },
      globals: {
        header: {
          // Globals take the same options as collections
          customPrompt: (data, locale) => `Keep navigation labels short in ${locale}.`,
        },
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_ENDPOINT, // Optional openai compatible endpoint
      },
    }),
  ],
})
```

---

## 🔧 Plugin Options

```ts
export interface PayloadSyncAiTranslationsOptions {
  /**
   * Configure which collections to include and which fields to exclude
   */
  collections: {
    [collectionSlug: string]: {
      /**
       * Extra instructions appended to every translation request for this
       * collection, resolved per document and target locale.
       */
      customPrompt?: (data: unknown, locale: string) => string | undefined
      excludeFields?: string[]
      /**
       * Locale-aware prompt for grammar checks only (not used when
       * translating). A function, a locale map ({ 'en-us': '…', default: '…' })
       * or a single string.
       */
      grammarCheckPrompt?:
        | ((data: unknown, locale: string) => string | undefined)
        | Record<string, string>
        | string
      seo?:
        | boolean
        | {
            contentFields?: string[]
            descriptionPath?: string // default: meta.description
            labelPath?: string // default: collection admin.useAsTitle
            slugPath?: string // default: slug
            titlePath?: string // default: meta.title
          }
    }
  }

  /**
   * Globals to include. They accept the same options as collections
   * (`customPrompt`, `excludeFields`, `grammarCheckPrompt`); `seo` is
   * collection-only.
   */
  globals?: {
    [globalSlug: string]: {
      customPrompt?: (data: unknown, locale: string) => string | undefined
      excludeFields?: string[]
      grammarCheckPrompt?:
        | ((data: unknown, locale: string) => string | undefined)
        | Record<string, string>
        | string
    }
  }

  /**
   * OpenAI configuration
   */
  openai: {
    apiKey: string
    /**
     * Model choices offered in the AI Settings admin panel. When provided,
     * the per-feature model overrides render as select fields instead of
     * free-text inputs.
     */
    availableModels?: string[]
    /**
     * Optional custom endpoint URL for self-hosted or alternative OpenAI-compatible APIs.
     * Supports Azure OpenAI, local LLMs, custom proxies, and other compatible providers.
     * Example: 'https://your-domain.com/v1' or 'http://localhost:8080/v1'
     */
    baseURL?: string
    /**
     * Maximum number of source characters bundled into a single OpenAI
     * request (default: 6400). Raise this for capable models to reduce the
     * number of requests (and repeats of your custom prompt) per document.
     */
    maxCharsPerRequest?: number
    model?: string
    /**
     * Per-feature model overrides. Any feature left unset falls back to
     * `model`. Values chosen in the AI Settings admin panel take precedence
     * over both.
     */
    models?: {
      proofread?: string // grammar checks & typo corrections
      review?: string // missing-information checks on existing translations
      translate?: string // document translations & review suggestions
    }
  }

  /**
   * Optional base URL for link synchronization when your Payload `serverURL`
   * isn't set or differs from the admin URL. Relative links will be prefixed
   * with this value before fetching alternates.
   */
  serverURL?: string
}
```

The SEO overview is compatible with the official `@payloadcms/plugin-seo` fields by default. Set
`seo: true` for automatic content detection, or provide `contentFields` for a more precise score.
Custom SEO schemas can use `titlePath` and `descriptionPath`.

### Model selection & the AI Settings panel

The plugin registers an **AI Settings** global in the admin panel where editors can override the
model per feature (translate / review / grammar check) without a deploy. Overrides resolve in this
order: admin panel value → `openai.models[feature]` → `openai.model` → `OPENAI_TRANSLATE_MODEL` env
var → built-in default. Pass `openai.availableModels` to turn the free-text inputs into a curated
select. Note: the new global requires a schema migration on databases that use migrations (e.g.
Postgres).

Reasoning models (o-series, gpt-5 family) that reject an explicit `temperature` are handled
automatically: the plugin retries without the parameter and remembers this per model.

### Requests & cost

Translatable fields are bundled by character count — `maxCharsPerRequest` source characters per
API request (default 6400) — so a typical document needs only one or two requests per locale
instead of one per field. Prompts are structured so the static instructions and your
`customPrompt` form a stable prefix, letting OpenAI's automatic prompt caching discount them on
consecutive requests.

---

## 🧩 How It Works

When enabled, the plugin adds a **Translate** button to your Payload admin panel.

1. **Initial Translation**  
   If no translations exist, all translatable fields are automatically translated into all available languages.

2. **AI Context Check**  
   If translations already exist, the plugin uses AI to detect missing or incomplete context.

3. **Modal Review**  
   When context is missing, a modal displays suggested changes per field.  
   You can **edit**, **skip**, or **approve** fields before applying.

4. **Apply Updates**  
   Confirmed translations are synced across all language versions automatically.

### Save integrity

Every locale save the plugin performs carries a context marker, so your own
hooks can recognize plugin writes and their direction:

```ts
// req.context during a plugin save
{
  contentOps: {
    operation: 'translationSync', // or 'apply' for grammar fixes / find & replace
    sourceLocale: 'en',
    targetLocale: 'nl',
  }
}
```

Use it in derive-on-save hooks (labels, slugs, reading time, …) that should
not run — or should behave differently — during a translation sync.

After each save the plugin re-reads the target locale and verifies that the
translated values actually persisted. A save can succeed while the target
locale stays empty: for example, a collection hook that passes `req` into a
nested local operation with a different `locale` makes Payload mutate
`req.locale`, silently rerouting every localized value of the remaining
update into that other locale. When verification fails the sync stops with a
clear error instead of corrupting documents quietly.

> ⚠️ If you call nested local operations (`payload.findByID`, …) inside
> collection hooks with an explicit `locale` **and** pass `req` along, save
> and restore `req.locale` around the call — Payload mutates it.

These guarantees are regression-tested end to end against a real Payload +
Postgres instance (`tests/int/`): first-ever locale translations, shared
block-row survival, draft-status handling, and detection of hooks that
reroute `req.locale`. The suite creates its own disposable database and
self-skips when no server is reachable; point `INT_DATABASE_URI` at a
Postgres maintenance database to enable it (defaults to
`postgres://postgres:postgres@127.0.0.1:5555/postgres`).

### SEO overview

For collections with `seo` enabled, the plugin adds **Plugins → SEO Overview**. A full scan:

- audits every accessible document in the selected locale;
- scores metadata length, content depth, heading structure, and title/content alignment;
- sorts weak documents first and lists actionable issues;
- edits localized SEO titles and descriptions inline, then immediately recalculates the score.

Metadata can also be edited in bulk via CSV:

- **Export CSV** downloads the scan results (`collection`, `id`, `locale`,
  `label`, `slug`, `seo_title`, `seo_description`, `score`, `status`,
  `issues`) — ready for a spreadsheet.
- **Import CSV** reads the same format back (only `collection`, `id`,
  `locale`, and a `seo_title`/`seo_description` column are required), skips
  unchanged and incomplete rows, applies the rest through the regular
  update flow (permissions respected), and rescores each document.

### Find & replace

The plugin adds **Plugins → Find & Replace** for all configured collections and globals:

1. Enter the text to find, an optional replacement, and pick a locale.
2. Toggle **Match case** or **Whole word only** when needed.
3. **Scan for matches** — read-only, lists every field with a before/after preview.
4. Review the matches, then **Replace** to write them in one go.

Replacements run through the same safe override pipeline as the grammar check
(lexical rich text stays intact); replacements that would blank a field entirely
are skipped.

### Translation status

Editors often change default-locale content and forget to sync the
translations. The plugin tracks every successful sync by storing a content
fingerprint per document and locale, and surfaces the drift in two places:

- **Document indicator** — the *Sync translations* button shows a warning dot
  (with the number of changed fields in its tooltip) whenever the document
  changed after its last sync or was never synced at all. The indicator
  refreshes right after every save.
- **Plugins → Translation Status** — the central hub for keeping translations
  in sync, built around one flow: **scan → select → sync**. A scan lists, per
  locale, which documents and globals are `never synced`, `out of sync` (with
  the exact number of changed fields), or `up to date`. Check the targets you
  want to act on (the header checkbox selects everything) and a selection bar
  appears with the available actions:
  - **Translate** — sync the selected documents and globals, with an optional
    overwrite of existing translations;
  - **Sync links** — rewrite internal links in the selected documents and
    globals to their localized equivalents; hardcoded internal paths without
    alternate tags (e.g. `/blog`) fall back to the locale-prefixed path
    (`/nl/blog`) when that URL exists;
  - **Skip fields** — tick translatable field roots (e.g. `slug`, `title`) to
    leave them untouched; the options follow the collections and globals of
    the selected targets, plus a free-form input for deeper paths such as
    `seo.title`.

Tracking is content-based (a hash per translatable field), so edits to other
locales or non-translatable fields never cause false positives.

Status scans also read the saved target-locale fields without language fallback.
A matching source fingerprint is not enough to be up to date: missing or empty
translations are marked as needing sync, with a missing-field count. Published
documents are checked against their published translations; draft sources are
checked against saved drafts. After translating, every translated field is
checked for persistence before the sync is recorded as successful.

For collections and globals with drafts enabled, every plugin save mirrors the
source document's publish state: published documents publish **only** the
locale being saved (draft edits in other locales stay drafts, so nothing is
published as a side effect), and documents that were never published are saved
as drafts instead of being published by the sync.

---

## 💡 Summary

By encapsulating your translation logic in a reusable Payload plugin, you can:

- Reuse translation functionality across multiple projects
- Share your work with the Payload community
- Keep your codebase clean and modular

**payload-content-ops** streamlines multilingual content management with smart, context-aware AI translations — all directly inside the Payload admin interface.

---

## 🔁 Migrating from payload-sync-ai-translations

This package was previously published as `payload-sync-ai-translations`. To migrate:

1. Swap the dependency:

   ```bash
   pnpm remove payload-sync-ai-translations && pnpm add payload-content-ops
   ```

2. Update your imports — the plugin function is now `payloadContentOps` (the old
   `payloadSyncAiTranslations` name is still exported as a deprecated alias):

   ```ts
   import { payloadContentOps } from 'payload-content-ops'
   ```

3. **Regenerate your import map** — the admin components are registered under the new package
   name, so this step is required or your admin panel will fail to resolve them:

   ```bash
   payload generate:importmap
   ```

No option names, field structures, endpoints or database schemas changed as part of the rename.

---

## License

MIT © Niels Reijnders & Codex
