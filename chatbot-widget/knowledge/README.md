# Chatbot Knowledge Base

This folder is the chatbot's content source. The retrieval layer (`api/_lib/knowledge.js`) loads every `*.json` file in this directory at startup and searches across all of them for each user message — no code changes are needed to add content, only new entries (or new files) here.

## Adding a new case study, service, or fact

Open the relevant file (`case-studies.json`, `services.json`, `company.json`, `process.json`) and append a new object to the array. Each entry needs:

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

Only `id`, `title`, `keywords`, and `summary` are required — the rest are optional extras used for case studies specifically.

**Keywords matter most for retrieval.** Include the words a real visitor would actually type — product names, industries, technologies, pain points — not just the formal title. The more specific and varied the keywords, the more reliably this entry surfaces for relevant questions.

## Adding a whole new content type (e.g. blog posts)

Create a new file, e.g. `blog-posts.json`, following the same array-of-objects shape above. It will be picked up automatically — no changes to `knowledge.js` or `chat.js` are required, since the loader reads every `.json` file in this directory.

## How retrieval works

For every user message, `api/_lib/knowledge.js` scores every entry across every file by counting keyword/title/summary matches against the message text, then returns the top few highest-scoring entries. Those are formatted into a short "Relevant Knowledge" block and injected into the system prompt for that one request — so token usage stays proportional to relevance, not to the total size of the knowledge base, and you can add hundreds of entries without bloating every request.

## Keeping content current

This is a versioned snapshot, not a live feed from WordPress (the chatbot has no WordPress/CMS credentials and the architecture intentionally avoids requiring any). When a new case study, service, or blog post goes live on the website, add a matching entry here and redeploy `chatbot-widget` — that's the only step required to make the chatbot aware of it.
