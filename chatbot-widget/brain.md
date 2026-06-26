# chatbot-widget — Brain Doc (Senior-Level Reference)

Self-contained, embeddable lead-qualification chatbot for The Demski Group.
Static front-end (`widget.js` + `loader.js`) + two Vercel serverless functions
(`api/chat.js`, `api/send-lead.js`). No build step. Deployed at
`https://wordpress-astro-bot.vercel.app`.

## 1. File map

```
chatbot-widget/
├── loader.js                 tiny embed shim — only tag a host page needs
├── widget.js                 ENTIRE widget: CSS + DOM + state machine + API calls (~1950 lines)
├── index.html                demo/landing page with embed snippet
├── vercel.json                CORS + cache headers, declares email-templates as included files
├── package.json               only dep: @sendgrid/mail
├── api/
│   ├── chat.js                 OpenAI proxy + qualification-step signal protocol
│   ├── send-lead.js            SendGrid: notification + confirmation emails
│   └── _lib/knowledge.js       keyword/fuzzy relevance scorer over knowledge/
├── knowledge/                  JSON knowledge base, recursively loaded (see §5)
├── email-templates/            HTML emails filled via {{placeholder}} substitution
├── test-pages/                 WP/Astro/plain-HTML embed simulations
├── avatar-alex.png, Logo3*.webp/png
└── FINAL_AUDIT.md, PRODUCTION_READINESS_REPORT.md   STALE — see §9
```

## 2. Embed mechanics

Host page adds one script tag:
```html
<script src="https://HOST/loader.js" data-widget-src="https://HOST/widget.js" async></script>
```
`loader.js` forwards every `data-*` attribute (except `data-widget-src`) onto a
dynamically created `<script>` tag pointing at `widget.js`. `widget.js` is a
single self-invoking function, idempotent via `window.__demskiChatbotLoaded`,
that injects its own `<style>`, builds its own DOM (`#bot-launcher`, `#lead-bot`),
and derives its API endpoints from its own script `src` (`API_URL` = same-origin
`/api/chat`, `LEAD_URL` = same-origin `/api/send-lead`) — so it works regardless
of which host site it's embedded on.

Config overrides (all optional `data-*` on the loader tag): `data-avatar`,
`data-avatar-fallback`, `data-calendly`, `data-bot-name` (default "Erin"),
`data-bot-title` (default "The Demski Group").

## 3. Front-end architecture (widget.js)

Single IIFE, four phases:
1. **Config/state** — reads script attrs, OS-sniffs real platform (`cb-is-mac`
   class for Mac-only sizing, never screen-width-based), seeds `lead` object
   from UTM/gclid query params merged with `localStorage['cb_utm']`.
2. **CSS** — one giant inline string (`var CSS`), injected via `<style>`.
   Watch for: `.cb-card` Mac-only desktop sizing override, `@media (max-width:768px)`
   full-screen mobile mode, `z-index:2147483647` launcher (always-on-top).
3. **DOM build** — `buildDOM()` creates `#lead-bot` (the chat card) with a
   compact header + an "expanded" header that swaps in once qualification starts.
4. **`init()`** — the actual brain: session persistence, AI calls, the
   step state machine, idle/teaser timers, all DOM event wiring.

### Conversation state machine (`step` variable, 0–7)

| step | meaning | advanced by |
|---|---|---|
| 0 | Intent (4 buttons: startup idea / business software / marketing / exploring) | `step1Handler` |
| 1 | Intent detail (sub-options per intent, from `INTENT_OPTIONS`) | click or AI match → `showBudgetStep` |
| 2 | Budget (5 buttons) | click or AI match → `showNotesStep` |
| 3 | Optional free-text notes (Skip button available) | any text or Skip → `goToContactStep` |
| 4 | Name | `isValidName` + `looksLikeNameAttempt` gate |
| 5 | Phone | `looksLikePhoneAttempt` gate, digit-length check |
| 6 | Email | `looksLikeEmailAttempt` gate, regex check |
| 7 | Final CTA shown ("Book a Google Meet" / "Send info by email") + post-lead correction flow | `handleCTA` → `submitLead()` |

Every MCQ step follows the same **local-match-first, AI-fallback** pattern:
`localExactOptionMatch()` tries an instant deterministic match against the
step's own option list before ever calling the AI — only ambiguous typed text
hits `askAI()` with a `stepContext` describing the open question.

### LLM-first detour handling

Steps 0–3 are LLM-first: any typed text goes to `askAI()` with `stepContext`;
the model answers the user's real question, then appends one of 4 markers
(see §4) telling the widget whether the question was answered, still open, the
model itself asked something new (`redirected`), or the user wants to be
connected to a human (`collectContact` → `enterContactFlow()`).

Steps 4–6 (name/phone/email) are **shape-gated, not LLM-first**: a
`looksLike*Attempt()` heuristic decides locally whether the typed text even
looks like an attempt at that field. If not, it's treated as a conversational
detour, answered via `askAI()` (silent, no stepContext), and the answer is
**always** appended to the *same* bot bubble via `appendResumeLineToLastBotMsg()`
rather than opening a new one — avoids the "form bolted onto a chatbot" feel.
`appendResumeLineToLastBotMsg` has no bail-out condition: an earlier version
skipped appending (and fell back to a second, separate `botReply()` bubble)
whenever the AI's own reply already ended in `?` — that fallback was itself
the "two questions back to back" bug reported in QA, fixed by always merging
instead. Genuine attempts are validated locally (`isValidName`, digit-count
phone check, email regex) with zero AI calls.

**Refusal handling (phone/email):** before the shape-gate detour, steps 5/6
check `looksLikeContactRefusal()` (a generalized version of `isValidName`'s
own refusal-phrase list) so an explicit "I don't want to give my phone
number" skips that field outright and advances to the next one in the
series, rather than detouring to the AI and then re-asking the very thing
just refused. Phone can be silently skipped (it's optional); email cannot
be fully skipped the same way since `api/send-lead.js` requires it to
deliver the lead, so refusing email instead offers a phone-callback
alternative (if a phone is already on file) or direct contact info, then
moves straight to the final CTA. `showFinalCTA`'s "Send me info by email"
button is omitted whenever `lead.email` is empty, and `handleCTA`'s
confirmation-email sentence is conditional on `lead.email` for the same
reason — both render fine with only `lead.name` (and optionally `lead.phone`)
on file.

### Step 7 — post-lead correction flow

After the lead is captured, the input bar stays live. `detectContactCorrection()`
is a keyword denylist (not AI) that detects "wrong email", "update my phone",
etc., and walks the user through naming the field then supplying a new value
(`correctingField` state var: `null` | `'pending-field-name'` | `'name'|'phone'|'email'`).

### Teaser / engagement funnel (pre-conversation)

`launch()` → after 800ms shows `showGreetingCard()` (big card, Yes/No +
free-text input) → 60s no interaction → `showGreetingBubble()` (small floating
bubble) → 40s no interaction → `showLauncherBadge()` (red badge + shake +
chime) → 10s more → `autoOpenWithNudge()` (auto-opens chat with a soft nudge).
`cancelTeaserFlow()` kills all of this the instant the user takes any real
action. `conversationStarted` (separate from `expanded`) is what makes
re-clicking the avatar later resume the chat instead of re-running the teaser.

### Idle reminder (mid-conversation)

Separate from the teaser: `resetIdleTimer()` reschedules a 40s→60s timer on
every interaction; fires `showIdleReminder()` **at most once per session**
(`idleReminderShown` flag), skipped entirely once step ≥ 7 or while the input
is focused.

### Session persistence

`localStorage['cb_session_v1']` snapshots `{step, lead, chatHistory, transcript,
conversationStarted, savedAt}` on every state change. Restored on load
(`restoreSession()`) if younger than 4 hours; replays the visual transcript
without re-triggering AI calls or duplicate bot turns. Cleared on lead
submission (`clearSession()`) since there's nothing left to resume.

### Security note worth remembering

Bot message text is **never** passed through `innerHTML`. `buildBotMsgBubble()`
builds bubbles via `createElement`/`createTextNode`, splitting only on `\n` to
insert real `<br>` — so anything the model echoes back (including a
maliciously-crafted `<script>` in user input that the model quotes) renders as
inert literal text, not parsed markup. No escaping step to forget.

## 4. `api/chat.js` — OpenAI proxy + step-signal protocol

- Model: `gpt-4o-mini`, `max_tokens: 300`, `temperature: 0.7`.
- `SYSTEM_PROMPT` hardcodes Erin's persona, Demski facts, allowed/forbidden
  topics, and the rule that the AI **never** asks for name/phone/email itself —
  it always defers to the widget's own flow via `[[COLLECT_CONTACT]]`.
- When `stepContext` (`{question, options}`) is present, `formatStepContext()`
  appends instructions requiring the model to end its reply with exactly one
  marker: `[[STEP_ANSWERED:option]]`, `[[STEP_ANSWERED:]]`, `[[STEP_NOT_ANSWERED]]`,
  `[[REDIRECTED]]`, or `[[COLLECT_CONTACT]]`. `extractStepSignal()` parses and
  strips it server-side before the reply is sent to the browser.
- **Default-on-missing-marker bias is deliberate**: if the model forgets the
  marker, the server defaults to `STEP_NOT_ANSWERED` (re-show MCQ buttons)
  rather than `REDIRECTED` (silent open-ended drift) — chosen because a
  visible "still here, pick an option" beats a silently stalled qualification
  flow. Don't "fix" this default without re-reading the comment at
  `api/chat.js:118-128`.
- Knowledge retrieval happens here too: `getRelevantKnowledge(lastUserMessage)`
  → `formatKnowledgeForPrompt()` → appended to the system prompt for that one
  request only (proportional cost, not whole-KB cost).
- Em dash (—) is stripped from every reply server-side (`reply.replace(/—/g, ',')`)
  per a style rule in the system prompt, reinforced in code as a backstop.
- CORS: explicit `OPTIONS` preflight handler (widget may be cross-origin from
  the API in some embed scenarios).

## 5. Knowledge base (`knowledge/` + `api/_lib/knowledge.js`)

- Folder-per-content-type (`company/`, `services/`, `case-studies/`, `results/`,
  `blog-posts/`, `faq/`, `process/`), one JSON file per entry, recursively
  walked — adding content is just dropping a new file, zero code changes.
- Entry shape: `{id, title, keywords[], summary, quote?, quoteAuthor?, results?[]}`.
- Scoring (`scoreEntry`): exact-title-substring bonus (+5), keyword hit (+3,
  with one-typo-tolerant fuzzy fallback via Levenshtein), first-title-word hit
  (+3, catches "FlowerMoxie" as a brand-name shortcut), other title word (+2),
  summary word (+1). `RELEVANCE_FLOOR = 3` — below that, treated as no match.
- Top 4 entries returned per query, cached per warm serverless container
  (`cachedEntries`), not reloaded per request.
- This is a hand-tuned keyword/fuzzy matcher, **not** embeddings/vector search —
  intentional at current scale (tens–low hundreds of entries); the README
  explicitly calls out swapping to vector search later behind the same
  `getRelevantKnowledge()` signature if the KB grows much larger.
- It is a **versioned snapshot**, not live WordPress content — the chatbot has
  zero CMS credentials. New case studies/services/posts require a manually
  added JSON file + redeploy.

## 6. `api/send-lead.js` — lead delivery (SendGrid, not EmailJS)

- `sgMail` via `SENDGRID_API_KEY` env var. `FROM_EMAIL = aaron.demski@demskigroupdev.com`.
  Notifies `NOTIFY_TO = [andrew.demski@..., aaron.demski@...]`.
- Two emails sent independently via `Promise.allSettled` (not `Promise.all`) —
  one failing recipient never masks whether the other succeeded; response
  codes are 200 (both ok) / 207 (partial) / 502 (both failed), each with
  SendGrid error detail extracted via `describeSendGridError()`.
- Templates are plain HTML files read from disk (3 candidate path fallbacks
  for path robustness across Vercel's bundling) and filled via a simple
  `{{key}}` regex replace (`fillTemplate`), **not** EmailJS's `{{}}` templating
  service — see §9 discrepancy.
- Required fields: `name`, `email` (400 if missing). `LEAD_FIELDS` is the full
  list of 16 fields widget.js's `submitLead()` sends (intent, intent_detail,
  budget, project_notes, name, phone, email, cta_choice, page, page_name, 5x utm_*, gclid).

## 7. Required environment variables (Vercel project settings, not in repo)

- `OPENAI_API_KEY` — required by `api/chat.js`; 500 if absent.
- `SENDGRID_API_KEY` — required by `api/send-lead.js`; 500 if absent.

No `.env` file is committed (`.gitignore` excludes it) — these must be set in
the Vercel dashboard per environment.

## 8. `vercel.json`

- `functions["api/send-lead.js"].includeFiles: "email-templates/**"` — without
  this, Vercel's serverless bundler wouldn't ship the HTML templates and
  `readFileSync` would 500 in production (this is *why* `send-lead.js` tries
  3 different path candidates — defensive against bundler path differences).
- Global CORS `Access-Control-Allow-Origin: *` on `.js`, `/api/*`, and image
  assets — the widget is designed to be embedded cross-origin from any client site.

## 9. ⚠️ Stale documentation warning

`FINAL_AUDIT.md` and `PRODUCTION_READINESS_REPORT.md` (dated 2026-06-15)
describe an **older architecture that no longer matches the code**:
- They describe **EmailJS** (`emailjs.send()`, `template_c6hi8ir`/`template_7kz7hgj`,
  `data-ejs-*` attributes) as the lead-delivery mechanism, loaded client-side
  from a CDN.
- The actual current code has **no EmailJS anywhere** — `widget.js` POSTs to
  `api/send-lead.js`, a Vercel serverless function using **SendGrid** server-side.
  There is no `data-ejs-key`/`data-ejs-service`/etc. in the current `widget.js`.
- They also predate the **OpenAI-backed AI conversation layer** entirely
  (`api/chat.js`, the knowledge base, the step-signal marker protocol) — the
  audit describes a fully scripted/hardcoded flow with no LLM in the loop.

**Do not trust these two files for current behavior.** They're useful only as
historical record of an earlier iteration (apparently built from
`chatbot-inline-package/chatbot-inline-package/inline-chatbot.html`, a
separate, older sibling implementation). If asked to "follow the audit doc,"
flag this gap first.

## 10. Things to double-check before changing behavior

- The default-marker-missing bias in `extractStepSignal` (§4) was deliberately
  chosen after the alternative caused a worse failure mode — don't flip it
  without re-reading the inline rationale.
- `isValidName` / `looksLikeNameAttempt` / `looksLikePhoneAttempt` /
  `looksLikeEmailAttempt` are all hand-tuned heuristics with documented edge
  cases in their own comments (e.g. why "no name" needs an exact-phrase entry,
  why imperative-first-word checks exist). Read the comment above a function
  before "simplifying" it — most of the complexity is there because a simpler
  version was tried and broke on a specific real input.
- `ctaHandled` and `ctaHandled`/`ctaHandled` guards (`handleCTA`,
  `handleInputInFlight`, `aiRequestInFlight`) exist specifically to stop
  duplicate submissions/AI calls from double-clicks or double-Enter — don't
  remove without understanding the race they close.
