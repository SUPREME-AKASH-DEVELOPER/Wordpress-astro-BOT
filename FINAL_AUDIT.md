# Final Pre-Deployment Audit — chatbot-widget

Date: 2026-06-15
Scope: confirm `chatbot-widget/` is fully self-contained, portable, and ready
for direct Vercel deployment with zero external dependencies.

---

## 1. Files Moved

| File | From | To |
|---|---|---|
| `chatbot-lead-notification.html` | `../email-templates/` (sibling folder) | `chatbot-widget/email-templates/` |
| `chatbot-lead-confirmation.html` | `../email-templates/` (sibling folder) | `chatbot-widget/email-templates/` |

The sibling `email-templates/` folder (including its `assets/` subfolder of
unused leftover logo files — `logo-email.b64`, `logo-email.png`, `logo.png`,
and a duplicate `Logo3-768x137.webp`) has been removed. Only the two HTML
templates were carried over; the duplicate/unused logo assets were dead
weight since both templates reference the single `Logo3-768x137.webp` already
present at `chatbot-widget/Logo3-768x137.webp`.

**Removed entirely (dev artifacts, not part of the deployable widget):**

| Removed | Reason |
|---|---|
| `chatbot-widget/qa/` (4 Playwright scripts) | Referenced an absolute path to the parent project's `node_modules` (`a:/wordpress-astro (2)/wordpress-astro/node_modules/playwright`) — would break if the folder is moved. Not required for the widget to run. |
| `chatbot-widget/qa-screenshots/` (6.9 MB, 30 files) | QA test artifacts already summarized in `PRODUCTION_READINESS_REPORT.md`. Not needed for deployment. |

---

## 2. References Fixed

None required beyond the file moves above. `widget.js`, `loader.js`, and
`index.html` already contained zero relative imports, zero references to the
parent Astro project, and zero `localhost`/absolute filesystem paths.

`test-pages/*.html` use relative paths (`../loader.js`, `../widget.js`)
relative to `chatbot-widget/` itself — these remain correct after the move
and work regardless of where the folder is placed.

---

## 3. Folder Isolation Audit

| Requirement | Status |
|---|---|
| widget.js | Present at root |
| loader.js | Present at root |
| index.html | Present at root |
| vercel.json | Present at root |
| Assets (avatar, logo) | Present at root (`avatar-erin.webp`, `Logo3-768x137.webp`) |
| Email templates | Present (`email-templates/`) — moved in during this audit |
| Configuration files | `package.json`, `vercel.json` present; all runtime config is inline defaults in `widget.js`, overridable via `data-*` attributes — no `.env` needed |
| Documentation | `PRODUCTION_READINESS_REPORT.md`, this file |
| Relative imports outside folder | None found |
| Shared assets outside folder | None — both images are local copies |
| Astro components | None referenced |
| CSS files outside folder | None — all CSS is injected inline by `widget.js` |
| Environment files | None exist, none required |
| Utility files outside folder | None |
| Images outside folder | None |
| Fonts | Loaded from Google Fonts CDN (`fonts.googleapis.com`) — third-party CDN, not project-local, by design (same as original) |

**Result: PASS.** The folder contains zero references to
`wordpress-astro/`, `chatbot-inline-package/`, or any path outside itself.

---

## 4. Asset Audit

| Asset | Location | Source dependency? |
|---|---|---|
| Avatar (`avatar-erin.webp`) | `chatbot-widget/avatar-erin.webp` | None — local copy, extracted from original base64 |
| Site logo (`Logo3-768x137.webp`) | `chatbot-widget/Logo3-768x137.webp` | None — local copy, used by both email templates |
| Icons | None used (inline SVG only, embedded directly in `widget.js`) | N/A |
| Fonts | Google Fonts CDN (`Outfit`) | Third-party CDN (intentional, not parent-project-specific) |
| Email assets | Both templates reference `Logo3-768x137.webp` at deployment root | Resolves to this folder's own asset once deployed |

**Result: PASS.** No asset depends on the parent Astro project (`wordpress-astro/public/`, `src/`, etc.).

---

## 5. Email Template Audit & Variable Mapping

### `chatbot-lead-notification.html` (EmailJS `template_c6hi8ir`)

Payload sent by `widget.js` → `submitLead()`:

| Template placeholder | Sent by widget.js (`lead.*`) | Present in template? | Notes |
|---|---|---|---|
| `{{name}}` | `lead.name` | Yes | |
| `{{email}}` | `lead.email` | Yes | Used in `mailto:` link + reply CTA |
| `{{phone}}` | `lead.phone` | Yes | Used in `tel:` link |
| `{{intent}}` | `lead.intent` | Yes | |
| `{{intent_detail}}` | `lead.intent_detail` | Yes | |
| `{{timeline}}` | `lead.timeline` | Yes | |
| `{{budget}}` | `lead.budget` | Yes | |
| `{{cta_choice}}` | `lead.cta_choice` | Yes | Shown as "Next Step" |
| `{{page}}` | `lead.page` | Yes | Used in source-page link + footer |
| `{{page_name}}` | `lead.page_name` | Yes | |
| `{{utm_source}}` | `lead.utm_source` | Yes | |
| `{{utm_campaign}}` | `lead.utm_campaign` | Yes | |
| `{{utm_medium}}` | `lead.utm_medium` | Yes | |
| `{{utm_term}}` | `lead.utm_term` | Yes | |
| `{{utm_content}}` | `lead.utm_content` | Yes | |
| `{{gclid}}` | `lead.gclid` | Yes | |

**16/16 fields mapped. No missing fields, no extra/unused placeholders.**

### `chatbot-lead-confirmation.html` (EmailJS `template_7kz7hgj`)

Payload sent by `widget.js` → `submitLead()`:

| Template placeholder | Sent by widget.js | Present in template? | Notes |
|---|---|---|---|
| `{{user_name}}` | `lead.name` | Yes | Greeting + summary table |
| `{{user_email}}` | `lead.email` | Yes | Summary table |
| `{{cta_choice}}` | `lead.cta_choice` | Yes | "Next Step" badge |

**3/3 fields mapped. No missing fields, no extra/unused placeholders.**

### Image / logo check

Both templates reference:
```html
<img src="https://wordpress-astro-bot.vercel.app/Logo3-768x137.webp" width="160" height="24" ...>
```

- Not a `data:` base64 URI (Gmail-safe).
- Not a `cid:` attachment.
- Updated to the live deployment domain and verified returning `200 (image/webp)`. See "Remaining Blockers" below.

---

## 6. Configuration Audit

| Item | Status |
|---|---|
| EmailJS public key, service ID, lead/confirm template IDs | Hardcoded as defaults in `widget.js` (lines ~35-38), each overridable via `data-ejs-key`, `data-ejs-service`, `data-ejs-lead-template`, `data-ejs-confirm-template` on the `<script>` tag |
| Environment variables | None used, none required |
| Widget settings (avatar, Calendly URL, bot name/title) | Hardcoded defaults, overridable via `data-avatar`, `data-avatar-fallback`, `data-calendly`, `data-bot-name`, `data-bot-title` |
| Script loading | `widget.js` self-loads EmailJS SDK from `cdn.jsdelivr.net` and Google Fonts from `fonts.googleapis.com` at runtime; both wrapped so failures degrade gracefully |
| Hardcoded `localhost` / `127.0.0.1` URLs | **None found** (only appeared transiently in dev QA scripts, which have been removed) |
| Project-specific dependencies (Astro, WordPress, etc.) | **None** — `package.json` has zero dependencies; `npx serve` is a dev-only convenience command, not a build requirement |

**Result: PASS.**

---

## 7. Embed Audit

Minimal embed (uses widget.js default location alongside loader.js):

```html
<script src="https://CHATBOT_URL/loader.js" data-widget-src="https://CHATBOT_URL/widget.js" async></script>
```

`loader.js` also supports resolving `widget.js` automatically relative to its
own URL if `data-widget-src` is omitted (see `loader.js` lines 20-27), so:

```html
<script src="https://CHATBOT_URL/loader.js" async></script>
```

...is sufficient on its own once deployed, **as long as `widget.js` is hosted
alongside `loader.js` at the same root** (which it is in this folder
structure). No additional `<link>`, `<style>`, font, or config tags are
required — `widget.js` injects everything (CSS, fonts, EmailJS SDK, DOM) at
runtime.

**Result: PASS.**

---

## 8. Production Cleanup

| Check | Result |
|---|---|
| `console.log` / `console.debug` / `debugger` statements | None found |
| `TODO` / `FIXME` / `XXX` markers | None found |
| Temporary files | None |
| Unused assets | Removed (duplicate `Logo3-768x137.webp` and unused base64/PNG logo variants from old `email-templates/assets/`) |
| Dead code | None identified — every function in `widget.js` is reachable from the conversation state machine or DOM event wiring |
| Console errors/warnings during smoke test | None (`console.warn` only fires intentionally on EmailJS send failure — appropriate production behavior, not debug noise) |
| Unused dependencies | `package.json` has zero `dependencies`; `devDependencies` not present (none needed) |

Smoke test re-run after restructuring (local static server): widget loads,
launcher appears, chat opens — zero console errors.

---

## 9. Final Folder Tree

```
chatbot-widget/
├── FINAL_AUDIT.md                          (this report)
├── PRODUCTION_READINESS_REPORT.md
├── Logo3-768x137.webp                      (160x24 logo, used by email templates)
├── avatar-erin.webp                        (chatbot avatar)
├── index.html                              (demo/landing page)
├── loader.js                               (embed entry point)
├── widget.js                               (full widget: CSS + DOM + logic + EmailJS)
├── package.json
├── vercel.json                             (CORS + cache headers)
├── email-templates/
│   ├── chatbot-lead-notification.html      (EmailJS template_c6hi8ir — internal lead email)
│   └── chatbot-lead-confirmation.html      (EmailJS template_7kz7hgj — lead confirmation)
└── test-pages/
    ├── wordpress-style.html                (WP theme embed simulation)
    ├── astro-style.html                    (Astro layout embed simulation)
    └── plain-html.html                     (bare-bones embed test)
```

**Files that will be deployed to Vercel (all 13 files above are static and
served as-is; no build step):**

1. `FINAL_AUDIT.md`
2. `PRODUCTION_READINESS_REPORT.md`
3. `Logo3-768x137.webp`
4. `avatar-erin.webp`
5. `index.html`
6. `loader.js`
7. `widget.js`
8. `package.json`
9. `vercel.json`
10. `email-templates/chatbot-lead-notification.html`
11. `email-templates/chatbot-lead-confirmation.html`
12. `test-pages/wordpress-style.html`
13. `test-pages/astro-style.html`
14. `test-pages/plain-html.html`

(`.md` files, `email-templates/`, and `test-pages/` are harmless if deployed —
they're static files Vercel will serve at predictable paths and don't affect
the widget's function. They can optionally be excluded via `.vercelignore` if
a leaner deployment is preferred, but this is not required.)

---

## 10. Deployment Instructions

1. From `chatbot-widget/`, run `vercel` (or connect the folder as a new
   Vercel project via the dashboard / Git). — **Done.** Deployed to
   `https://wordpress-astro-bot.vercel.app`.
2. No build command, no install command, no output directory override needed
   — it's a static root.
3. Once deployed, note the assigned domain. — **Done:**
   `https://wordpress-astro-bot.vercel.app`.
4. **Post-deploy edit** — replace `YOUR-VERCEL-DEPLOYMENT.vercel.app` in both
   files under `email-templates/` with the real domain from step 3. —
   **Done.** Both templates now reference
   `https://wordpress-astro-bot.vercel.app/Logo3-768x137.webp`, verified live
   (HTTP 200, `image/webp`). **Still pending:** paste the updated HTML into
   the corresponding EmailJS dashboard templates (`template_c6hi8ir` and
   `template_7kz7hgj`) — requires EmailJS dashboard access.
5. Embed on any site:
   ```html
   <script src="https://wordpress-astro-bot.vercel.app/loader.js" data-widget-src="https://wordpress-astro-bot.vercel.app/widget.js" async></script>
   ```

---

## 11. Remaining Blockers

**Deployment is live and verified:**

- `chatbot-widget/` deployed to `https://wordpress-astro-bot.vercel.app`.
  Verified live: `/` → 200, `/loader.js` → 200 (`application/javascript`),
  `/widget.js` → 200 (`application/javascript`),
  `/Logo3-768x137.webp` → 200 (`image/webp`).
- The logo `<img src>` placeholder in both
  `email-templates/chatbot-lead-notification.html` and
  `email-templates/chatbot-lead-confirmation.html` has been updated from
  `https://YOUR-VERCEL-DEPLOYMENT.vercel.app/Logo3-768x137.webp` to
  `https://wordpress-astro-bot.vercel.app/Logo3-768x137.webp` and confirmed
  live. **RESOLVED.**

**One remaining action, outside this codebase:**

- Paste the updated HTML from both templates into the corresponding EmailJS
  dashboard templates (`template_c6hi8ir` for the lead notification,
  `template_7kz7hgj` for the confirmation) and verify `{{...}}` variables
  match exactly. This requires EmailJS dashboard access and is not performed
  here — it lives in a separate system (EmailJS), not in the deployed widget
  runtime.

No other blockers identified.

---

## 12. PASS/FAIL

| Audit area | Result |
|---|---|
| Folder isolation | **PASS** |
| Asset audit | **PASS** |
| Email template audit | **PASS** (16/16 + 3/3 variables mapped) |
| Configuration audit | **PASS** |
| Embed audit | **PASS** |
| Production cleanup | **PASS** |
| Portability (zip & move) | **PASS** |

**Overall: PASS** — `chatbot-widget/` is self-contained, portable, deployed,
and verified live at `https://wordpress-astro-bot.vercel.app`. The only
outstanding item is pasting the updated email template HTML into the EmailJS
dashboard (`template_c6hi8ir`, `template_7kz7hgj`), which requires dashboard
access outside this codebase.
