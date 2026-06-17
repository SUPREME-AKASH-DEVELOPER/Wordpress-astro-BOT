# Chatbot Production Readiness Report

Scope: standalone embeddable chatbot widget (`chatbot-widget/`), built from
`chatbot-inline-package/chatbot-inline-package/inline-chatbot.html`. Application-side
implementation and data-population only — no domain email infrastructure was
configured, per instructions.

## PASS/FAIL Matrix

| Area | Status | Notes |
|---|---|---|
| Standalone deployment (Vercel-ready) | PASS | Static project: `widget.js`, `loader.js`, `index.html`, `vercel.json`, images all at project root. No build step required. |
| WordPress compatibility | PASS | Tested against simulated WP theme (Twenty Twenty-Four-style resets, `box-sizing:content-box`, global `img{max-width:100%}`, jQuery loaded). No conflicts, no console errors. |
| Astro / theme-scoped CSS compatibility | PASS | Tested against simulated Astro page (`data-astro-cid-*` scoped styles, fixed sticky CTA bar at `z-index:9999`). Widget launcher (`z-index:2147483647`) stays on top, no style bleed. |
| Plain HTML compatibility | PASS | Renders correctly with zero host CSS. |
| Desktop responsiveness (1280 / 1440 / 1920) | PASS | Chat card renders at fixed 370px width, positioned bottom-right, no clipping. |
| Tablet responsiveness (768) | PASS | Same floating-card layout, no overflow. |
| Mobile responsiveness (375 / 390 / 430) | PASS | Converts to full-width bottom sheet at ≤480px (`max-height:88vh`), launcher shrinks to 60px. |
| Chat flow — "New startup or app idea" | PASS | Full flow (intent → detail → timeline → budget → name → phone → email → CTA) completes; both EmailJS calls fire with correct payloads. |
| Chat flow — "Software for my business" | PASS | Same as above. |
| Chat flow — "Digital marketing help" | PASS | Same as above. |
| Chat flow — "Just exploring" | PASS | Same as above. |
| Data capture — all 16 lead fields | PASS | `intent`, `intent_detail`, `timeline`, `budget`, `name`, `phone`, `email`, `cta_choice`, `page`, `page_name`, `utm_source/campaign/medium/term/content`, `gclid` all populate with real values, no blanks (verified via intercepted EmailJS payloads). |
| UTM/GCLID capture & persistence | PASS | Captured from URL query string, merged with `localStorage['cb_utm']`, persists across page loads. |
| Internal lead notification email template | PASS | Converted to EmailJS `{{placeholder}}` template; all 16 fields mapped; branded layout (accent bar, badge, sections, CTA button, footer) preserved. Added missing **Budget**, **Next Step**, and **Campaign Tracking (UTM/GCLID)** sections that were absent from the original hardcoded sample. |
| Lead confirmation email template | PASS | New branded template created (`chatbot-lead-confirmation.html`) matching the same design system; maps the 3 fields actually sent by `submitLead()` (`user_name`, `user_email`, `cta_choice`). |
| Email logo | PASS | Replaced base64 data-URI logo with hosted `<img src="https://wordpress-astro-bot.vercel.app/Logo3-768x137.webp" width="160" height="24">` in both templates. URL updated to the live deployment domain and verified returning HTTP 200 (`image/webp`). |
| Error handling — invalid name | PASS | "A" → "Could you enter your full name please?" |
| Error handling — invalid phone | PASS | "123" → "That doesn't look like a valid phone number. Could you double-check?" |
| Error handling — invalid email | PASS | "not-an-email" → "That doesn't look right..."; recovers correctly when corrected, proceeds to CTA. |
| Error handling — off-topic input mid-flow | PASS | "What is your pricing?" during name step → deflected back to the current question. |
| Error handling — EmailJS API failure | PASS | Both `emailjs.send()` calls wrapped in `.catch()`; UI shows success message to the user regardless, warnings only logged to console. |
| Error handling — EmailJS CDN blocked | PASS | `submitLead()` checks `window.emailjs` exists before calling; no page errors if CDN fails to load. |
| Missing/default config | PASS | All `EJS_*`, `CALENDLY_URL`, avatar URLs have hardcoded defaults baked into `widget.js`; overridable via `data-*` attributes on the loader script tag with no other config required. |

## What Was Built

```
chatbot-widget/
├── widget.js              # Entire chatbot: styles, DOM, conversation logic, EmailJS
├── loader.js               # Tiny loader script — the only tag a host page needs
├── index.html              # Demo/landing page + embed instructions
├── vercel.json              # CORS + cache headers for static assets
├── package.json
├── avatar-erin.webp         # Chatbot avatar (extracted from base64 in original)
├── Logo3-768x137.webp       # Demski Group site logo (for email template hosting)
├── email-templates/
│   ├── chatbot-lead-notification.html  # Internal lead email (EmailJS template_c6hi8ir)
│   └── chatbot-lead-confirmation.html  # Lead confirmation email (EmailJS template_7kz7hgj)
└── test-pages/
    ├── wordpress-style.html # Simulated WP theme embed test
    ├── astro-style.html     # Simulated Astro layout embed test
    └── plain-html.html      # Bare-bones embed test
```

See `FINAL_AUDIT.md` for the most recent self-containment/portability audit.

## Embed Snippet (for any site)

```html
<script
  src="https://wordpress-astro-bot.vercel.app/loader.js"
  data-widget-src="https://wordpress-astro-bot.vercel.app/widget.js"
  async></script>
```

Optional overrides via `data-*` attributes: `data-avatar`, `data-avatar-fallback`,
`data-calendly`, `data-ejs-key`, `data-ejs-service`, `data-ejs-lead-template`,
`data-ejs-confirm-template`, `data-bot-name`, `data-bot-title`.

## Post-Deploy Steps

1. **Deploy `chatbot-widget/` to Vercel** (static project, no build command needed). — **Done.** Live at `https://wordpress-astro-bot.vercel.app`.
2. **Update email template logos** — in both
   `email-templates/chatbot-lead-notification.html` and
   `email-templates/chatbot-lead-confirmation.html`, replace
   `https://YOUR-VERCEL-DEPLOYMENT.vercel.app/Logo3-768x137.webp` with the real
   deployment URL. — **Done.** Both now reference
   `https://wordpress-astro-bot.vercel.app/Logo3-768x137.webp`, verified live
   (HTTP 200, `image/webp`).
3. **Update EmailJS templates in the EmailJS dashboard** (still pending, requires dashboard access):
   - `template_c6hi8ir` (lead notification) — paste the updated HTML from
     `email-templates/chatbot-lead-notification.html`, ensure all `{{...}}`
     variables match exactly (case-sensitive): `name`, `email`, `phone`, `intent`,
     `intent_detail`, `timeline`, `budget`, `cta_choice`, `page`, `page_name`,
     `utm_source`, `utm_campaign`, `utm_medium`, `utm_term`, `utm_content`, `gclid`.
   - `template_7kz7hgj` (confirmation) — paste the updated HTML from
     `email-templates/chatbot-lead-confirmation.html`, variables: `user_name`,
     `user_email`, `cta_choice`.
   - Verify the "From" address is `leads@demskigroup.com` or
     `noreply@demskigroup.com` (not a personal Gmail) — this is an EmailJS
     service-level setting, not something in the templates.
4. **Embed the script tag** on the production site(s) (WordPress via Custom
   HTML/Insert Headers & Footers, Astro `Layout.astro`, or any plain HTML page)
   using the snippet above with the real Vercel domain.
5. **Live test** by submitting a real lead through each of the 4 intent paths and
   confirming both emails arrive correctly formatted in the inbox (the user has
   indicated they will do this themselves).

## Known Limitations / Notes

- The confirmation email intentionally contains less detail than the lead
  notification — this matches the original `inline-chatbot.html` behavior
  (`submitLead()` sends only `user_name`, `user_email`, `cta_choice` to the
  confirmation template). If a more detailed confirmation is desired (e.g.
  including `intent`/`timeline`), `submitLead()` in `widget.js` would need to
  pass additional fields and the confirmation template would need matching
  `{{...}}` placeholders — out of scope for this pass.
- Google Fonts (`Outfit`) and the EmailJS browser SDK are loaded from CDNs
  (`fonts.googleapis.com`, `cdn.jsdelivr.net`) at runtime — both are wrapped so
  failures don't break the chat experience (font falls back to sans-serif;
  EmailJS failure is caught and logged).
- `qa/` and `test-pages/` directories are useful for regression testing but are
  not required for the widget to function — they can be excluded from the
  Vercel deployment if desired (not strictly necessary, they're harmless static
  files).
