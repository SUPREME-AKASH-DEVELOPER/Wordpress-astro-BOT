import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loaded once per warm serverless container, not per-request — Vercel
// reuses the same Node process across requests until it cools down, so
// this avoids re-reading every knowledge file on every single message.
let cachedEntries = null;

function loadKnowledgeDir() {
  const candidates = [
    join(__dirname, '..', '..', 'knowledge'),
    join(process.cwd(), 'knowledge'),
  ];
  for (const dir of candidates) {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      if (files.length === 0) continue;
      const entries = [];
      for (const file of files) {
        try {
          const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'));
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              entries.push({ ...entry, _source: file });
            }
          }
        } catch (e) {
          console.error('[knowledge] failed to parse', file, e.message);
        }
      }
      return entries;
    } catch (e) {
      // try next candidate directory
    }
  }
  return [];
}

function getEntries() {
  if (cachedEntries === null) {
    cachedEntries = loadKnowledgeDir();
  }
  return cachedEntries;
}

// Common words excluded from title/summary matching so generic phrasing
// ("what is...", "do you have...", "tell me about...") can't accumulate
// score on its own — only keyword hits (hand-curated, so inherently
// meaningful) and substantive shared words should count.
const STOPWORDS = new Set([
  'what', 'who', 'when', 'where', 'why', 'how', 'is', 'are', 'was', 'were',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'about', 'your',
  'you', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will',
  'would', 'should', 'tell', 'me', 'us', 'this', 'that', 'these', 'those',
  'any', 'some', 'all', 'of', 'to', 'in', 'on', 'at', 'be', 'been', 'being',
]);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9$+\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

/* Lightweight relevance scoring — no embeddings/vector DB needed at this
 * content scale (tens to low hundreds of entries). Scores by counting how
 * many of the query's words appear in each entry's keywords/title/summary,
 * weighting keyword hits highest since they're hand-curated for exactly
 * this purpose. Swappable later for a real vector search behind the same
 * getRelevantKnowledge() signature if the knowledge base grows much larger. */
function scoreEntry(entry, queryWords, queryLower) {
  let score = 0;
  const keywords = (entry.keywords || []).map((k) => k.toLowerCase());
  for (const kw of keywords) {
    if (queryLower.includes(kw)) score += 3;
  }
  const titleWords = tokenize(entry.title);
  const summaryWords = tokenize(entry.summary);
  for (const qw of queryWords) {
    if (qw.length < 3) continue; // skip tiny stopword-ish tokens
    if (titleWords.includes(qw)) score += 2;
    if (summaryWords.includes(qw)) score += 1;
  }
  return score;
}

/* Returns the top-N most relevant knowledge entries for a user message,
 * or [] if nothing scores above the relevance floor (callers should treat
 * an empty result as "no extra context needed", not an error). */
// Below this, a match is just incidental word overlap (e.g. "what", "is",
// "today") rather than a genuine topical hit — a single keyword hit (worth
// 3) or two-plus weaker title/summary hits is the floor for "this entry is
// actually relevant", which keeps off-topic queries from injecting noise.
const RELEVANCE_FLOOR = 3;

export function getRelevantKnowledge(query, limit = 4) {
  const entries = getEntries();
  if (entries.length === 0 || !query) return [];

  const queryLower = query.toLowerCase();
  const queryWords = tokenize(query);

  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryWords, queryLower) }))
    .filter((s) => s.score >= RELEVANCE_FLOOR)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.entry);
}

/* Formats matched entries into a compact block for the system prompt.
 * Kept terse on purpose — this is injected on every request that has a
 * match, so verbosity here directly costs tokens/latency. */
export function formatKnowledgeForPrompt(entries) {
  if (!entries || entries.length === 0) return '';
  const lines = entries.map((e) => {
    let line = `- ${e.title}: ${e.summary}`;
    if (e.quote) {
      line += ` Quote${e.quoteAuthor ? ' (' + e.quoteAuthor + ')' : ''}: "${e.quote}"`;
    }
    if (e.results && e.results.length) {
      line += ` Results: ${e.results.join('; ')}`;
    }
    return line;
  });
  return '\n\n## Relevant Knowledge For This Question\n' + lines.join('\n');
}
