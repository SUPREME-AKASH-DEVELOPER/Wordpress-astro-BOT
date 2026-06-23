import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Loaded once per warm serverless container, not per-request — Vercel
// reuses the same Node process across requests until it cools down, so
// this avoids re-reading every knowledge file on every single message.
let cachedEntries = null;

// Walks the knowledge directory recursively so content can be organized
// into subfolders by type (knowledge/case-studies/*.json,
// knowledge/blog-posts/*.json, etc.) — one entry per file, or a flat
// top-level *.json file containing an array, both work. _source is kept
// relative to the knowledge root for readable error/debug output.
function collectJsonFiles(dir, root) {
  let results = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(collectJsonFiles(full, root));
    } else if (name.endsWith('.json')) {
      results.push(full);
    }
  }
  return results;
}

function loadKnowledgeDir() {
  const candidates = [
    join(__dirname, '..', '..', 'knowledge'),
    join(process.cwd(), 'knowledge'),
  ];
  for (const dir of candidates) {
    try {
      const files = collectJsonFiles(dir, dir);
      if (files.length === 0) continue;
      const entries = [];
      for (const file of files) {
        const source = relative(dir, file);
        try {
          const parsed = JSON.parse(readFileSync(file, 'utf8'));
          if (Array.isArray(parsed)) {
            for (const entry of parsed) {
              entries.push({ ...entry, _source: source });
            }
          } else if (parsed && typeof parsed === 'object') {
            entries.push({ ...parsed, _source: source });
          }
        } catch (e) {
          console.error('[knowledge] failed to parse', source, e.message);
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

// Classic edit-distance, used only for short single-word typo tolerance
// ("shopfy" -> "shopify", "andrw" -> "andrew") — not run on full phrases,
// so this stays cheap even with a few hundred knowledge entries.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

// One typo allowed per ~5 letters, capped at 2 — strict enough that short
// unrelated words don't accidentally collide ("app" vs "ago"), loose
// enough to forgive a dropped/swapped letter in a longer word.
function fuzzyMatches(word, target) {
  if (word.length < 4 || target.length < 4) return word === target;
  const maxDist = Math.min(2, Math.floor(Math.max(word.length, target.length) / 5) + 1);
  return levenshtein(word, target) <= maxDist;
}

/* Lightweight relevance scoring — no embeddings/vector DB needed at this
 * content scale (tens to low hundreds of entries). Scores by counting how
 * many of the query's words appear in each entry's keywords/title/summary,
 * weighting keyword hits highest since they're hand-curated for exactly
 * this purpose. Falls back to fuzzy (typo-tolerant) word matching only
 * when no exact hit was found, so well-spelled queries pay zero extra
 * cost. Swappable later for a real vector search behind the same
 * getRelevantKnowledge() signature if the knowledge base grows much larger. */
function scoreEntry(entry, queryWords, queryLower) {
  let score = 0;

  // Exact-title-match bonus: if the query contains the entry's full title
  // as a substring (e.g. "Tell me about FlowerMoxie" contains "FlowerMoxie"),
  // that's an unambiguous, high-confidence signal on its own — a single-word
  // proper-noun query like "FlowerMoxie" or "Biopac" would otherwise only
  // earn 2 points from the per-word title scoring below (one title-word hit),
  // landing just under RELEVANCE_FLOOR (3) and silently returning no match
  // for exactly the kind of direct "tell me about X" question a real visitor
  // is most likely to ask. Scored well above the floor so it always surfaces
  // regardless of word count, without needing every short company name added
  // as its own keyword by hand.
  const titleLower = (entry.title || '').toLowerCase();
  if (titleLower && titleLower.length >= 3 && queryLower.includes(titleLower)) {
    score += 5;
  }

  const keywords = (entry.keywords || []).map((k) => k.toLowerCase());
  for (const kw of keywords) {
    if (queryLower.includes(kw)) {
      score += 3;
      continue;
    }
    // Fuzzy fallback: does any single query word nearly-match a single-word
    // keyword? Weighted the same as an exact keyword hit — a typo on a
    // hand-curated keyword is just as meaningful as spelling it correctly.
    if (kw.indexOf(' ') === -1 && queryWords.some((qw) => fuzzyMatches(qw, kw))) {
      score += 3;
    }
  }
  const titleWords = tokenize(entry.title);
  const summaryWords = tokenize(entry.summary);
  // The first word of a title is almost always the actual brand/company name
  // ("Biopac" in "Biopac Systems", "Jackson" in "Jackson Hewitt") — a visitor
  // asking about just that one word (a shortened/partial company name) is
  // giving as strong a signal as someone who got the full title right, so it
  // earns the same weight as a keyword hit rather than the generic +2 every
  // other title word gets. Avoids needing to hand-add every short company
  // name as its own keyword just to clear the relevance floor.
  const firstTitleWord = titleWords[0];
  for (const qw of queryWords) {
    if (qw.length < 3) continue; // skip tiny stopword-ish tokens
    if (firstTitleWord && qw === firstTitleWord) { score += 3; continue; }
    if (titleWords.includes(qw)) { score += 2; continue; }
    if (summaryWords.includes(qw)) { score += 1; continue; }
    if (titleWords.some((tw) => fuzzyMatches(qw, tw))) score += 1;
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
