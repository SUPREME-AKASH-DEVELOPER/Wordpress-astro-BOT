# Chatbot Knowledge Base

This folder is the chatbot's content source. The retrieval layer (`api/_lib/knowledge.js`) walks every subfolder recursively and loads every `*.json` file it finds, then searches across all of them for each user message — no code changes are needed to add content, only new files.

## Folder structure

```
knowledge/
  company/          one file per company fact (id.json) — about/team page content
  services/         one file per service offering (id.json)
  case-studies/     one file per client case study (id.json) — mirrors /our-clients/
  results/          one file per /results/ entry (id.json)
  blog-posts/       one file per blog post (id.json) — mirrors /blog/
  faq/              one file per FAQ answer (id.json) — pricing, timeline, etc.
  process/          one file per process/methodology fact (id.json)
```

Each subfolder maps to a content type; within it, each file is one knowledge entry named after its `id`. This mirrors the site's own sections (`/our-clients/`, `/blog/`, `/results/`, etc.) so it's obvious where new content belongs. `faq/` is for short, direct-answer questions ("how much does it cost", "how long does it take"); `process/` is for the actual delivery methodology (agile, design process, DevOps) — a pricing or timeline question is FAQ content even though it's adjacent to process.

## Adding a new entry

Create a new file inside the matching subfolder (e.g. `knowledge/case-studies/new-client.json`). Each entry is a single JSON object:

```json
{
  "id": "unique-slug",
  "title": "Short Title",
  "keywords": ["word", "phrase", "synonym"],
  "summary": "1-3 sentences of the actual content the AI should know and be able to say.",
  "quote": "Optional client quote, leave \"\" if none.",
  "quoteAuthor": "Optional, e.g. 'Jane Doe, CEO'",
  "results": ["Optional array of outcome bullet points."]
}
```

Only `id`, `title`, `keywords`, and `summary` are required — the rest are optional extras used mainly for case studies/results.

**Keywords matter most for retrieval.** Include the words a real visitor would actually type — product names, industries, technologies, pain points — not just the formal title. The more specific and varied the keywords, the more reliably this entry surfaces for relevant questions.

## Adding a whole new content type

Create a new subfolder (e.g. `knowledge/faq/`) and drop entry files into it the same way. It's picked up automatically — no changes to `knowledge.js` or `chat.js` are required, since the loader recurses into every directory under `knowledge/`.

A flat top-level file containing a JSON array (the old format) still works too, if you ever prefer one file over many for a given content type — the loader accepts both shapes.

## How retrieval works

For every user message, `api/_lib/knowledge.js` scores every entry across every file by counting keyword/title/summary matches against the message text, then returns the top few highest-scoring entries. Those are formatted into a short "Relevant Knowledge" block and injected into the system prompt for that one request — so token usage stays proportional to relevance, not to the total size of the knowledge base, and you can add hundreds of entries without bloating every request.

## Keeping content current

This is a versioned snapshot, not a live feed from WordPress (the chatbot has no WordPress/CMS credentials and the architecture intentionally avoids requiring any). When a new case study, service, blog post, or result goes live on the website, add a matching entry file here and redeploy `chatbot-widget` — that's the only step required to make the chatbot aware of it.
