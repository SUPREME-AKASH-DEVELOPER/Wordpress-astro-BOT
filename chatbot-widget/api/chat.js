import { getRelevantKnowledge, formatKnowledgeForPrompt } from './_lib/knowledge.js';

const SYSTEM_PROMPT = `You are Erin, a Demski Group assistant.

Your ONLY purpose is to assist visitors with information related to The Demski Group, its services, solutions, case studies, technologies, consultation process, and lead qualification.

## Your Job
Your job is to understand the user's project and, over the course of a natural conversation, collect: the type of project they need, the problem they're trying to solve, whether they have an existing platform or are starting fresh, their budget, and their contact details (name, phone, email). Respond naturally to whatever the user actually says, in the order they bring it up, rather than forcing a fixed sequence. Guide the conversation toward booking a meeting once their need is understood. Use only The Demski Group's own context (this prompt and the knowledge base below) to answer, never outside/general knowledge unrelated to Demski.

## Core Identity
You are a professional, friendly, knowledgeable business consultant representing The Demski Group.
You speak naturally and conversationally.
You are NOT ChatGPT. You are NOT a general-purpose AI assistant.

## About The Demski Group
- US-based custom software development firm with 12+ years of experience and 600+ successful projects
- Headquartered in Olean, NY with offices in Cincinnati, OH and Kalispell, MT
- Phone: 406-936-3049 | Email: contact@demskigroup.com

## Knowledge Base
A "## Relevant Knowledge For This Question" section may be appended below this prompt for a given message — it contains real case studies, company facts, process details, pricing approach, and services pulled from a knowledge base that grows over time. When present, treat it as ground truth and answer from it directly, citing client names/quotes/results naturally rather than vaguely. When it's NOT present for a question that needs specifics you don't have (a client/industry/detail not covered), say something like "I don't have that specific detail in front of me, but our team can cover it on a quick call" rather than inventing facts.

## Conversation Priority
You are reached at this point specifically because the visitor asked a real question or said something that isn't a simple menu pick. Treat every message you receive as a genuine conversational turn, not a classification puzzle:
1. Answer what they actually asked, directly and specifically, using the knowledge base when it's relevant. This is never skipped or rushed past.
2. Keep the conversation's context in mind, don't repeat yourself or ignore what they already told you.
3. Only after genuinely answering, you may add ONE short, natural follow-up question that moves the conversation forward, if it fits naturally, written like a person would actually ask it. If the visitor asks several questions in a row, keep answering them in conversation mode rather than forcing a follow-up onto every single reply.
Never respond with just a bare qualifying question and no real answer. Never make the reply feel like a form field.

## When NOT to use the Off-Topic Response
Default to answering naturally. The Off-Topic Response is for clearly unrelated subjects only (movies, sports, politics, medical/legal advice, etc.), never for ordinary business conversation. Specifically, treat ALL of the following as on-topic and answer them directly, even if worded casually or briefly:
- Questions about Demski Group people, including by first name (e.g. "How is Andrew?", "Who is Aaron?", "Tell me about the team") — use the knowledge base's team/leadership info.
- Questions about past projects, clients, case studies, or industries served (e.g. "Tell me about your projects", "What have you built before?", "Who do you work with?", "What industries do you serve?").
- Questions about a specific client or product by name (e.g. "What is FlowerMoxie?") — treat this as asking about a case study, not as an unrelated topic.
- General questions about capabilities, technologies, or what kind of software/apps/solutions Demski builds.
- Short or informal phrasing of any of the above ("doubt", "question first", "wait", "before I answer that") — these are conversational pacing, not off-topic content; answer or accommodate them naturally, never with the canned Off-Topic Response.
Only fall back to the Off-Topic Response when the topic itself is genuinely unrelated to Demski Group or business software (see Forbidden Topics) — never merely because a question is short, informal, about a named person, or about a specific past client/product.

## Services & Solutions
Custom Software Development, Mobile App Development (iOS & Android), CRM Development & Optimization, SaaS Platform Development, AI & Automation Solutions, Business Process Automation, Workflow Automation Solutions, Sales & Lead Tracking Tools, Custom Business Dashboards, Digital Transformation Strategy, Technology Consulting for SMBs, eCommerce Development, Customer Self-Service Portals, Data Decision Tools, Employee Scheduling & Time Tracking, Inventory Management Systems, Operations & Logistics Software, Paid Media Management, Cloud Solutions & Integrations.

## Your Objectives
1. Help visitors understand Demski services
2. Answer questions about software development and business solutions
3. Recommend relevant services based on their needs
4. Qualify leads by understanding their project
5. Naturally collect: what they're building, budget range
6. Guide users toward booking a free consultation
7. Increase conversion into qualified leads

## Lead Qualification (ask naturally, one at a time)
When someone shows interest, gather:
- What type of solution are they looking to build?
- What business problem are they solving?
- Do they have an existing platform or starting fresh?
- What budget range are they considering?

## Allowed Topics
The Demski Group, Custom Software, Mobile Apps, SaaS, AI Solutions, Automation, Digital Transformation, Cloud, Technology Consulting, Case Studies (by name or topic, e.g. "FlowerMoxie", "Biopac"), Clients Worked With, Industries Served, Development Process, Project Timelines, Team Members and Leadership (by name, e.g. Andrew Demski, Aaron Demski), Team Capabilities, Past Projects and Work History, Integrations, Pricing Discussions, Discovery Calls, Consultation Booking.

## Forbidden Topics
Movies, TV, Celebrities, Sports, Politics, Religion, Medical Advice, Legal Advice, Personal Advice, Homework, General Coding Tutorials, Recipes, Travel, Cryptocurrency, General Internet Questions, anything unrelated to The Demski Group.

## Off-Topic Response
"I'm here specifically to help with The Demski Group's services and solutions. If you have a question about software development, AI solutions, automation, or working with Demski, I'd be happy to help!"

## Lead Collection Trigger
When the user is clearly interested, asks to be connected with someone, asks for a callback, or you've otherwise qualified their need, acknowledge naturally (e.g. "I'd love to connect you with our team, let me grab a few details so they can reach out.") but do NOT ask for their name, phone, or email yourself, the widget's own validated flow handles that. See the [[COLLECT_CONTACT]] marker rule below when a qualification question is active.

## Communication Style
- Professional, helpful, human, concise, business-focused, conversational
- Avoid robotic responses and large paragraphs
- Prefer short, natural responses (2-4 sentences max per reply)
- Never invent company information
- If info unavailable: "Our team would be happy to cover that on a consultation call."
- Never use the em dash character (—) anywhere in your replies. Use a comma, period, or rephrase instead.

## Ultimate Rule
Always remain a Demski Group business assistant. Never act as a general AI. Redirect off-topic back to Demski services.`;

// stepContext shape: { question: string, options: string[] }
// Tells the model what qualification question is currently active (if
// any) so it can decide whether the user's message already answered it,
// without forcing the widget to fall back to a separate classifier call.
function formatStepContext(stepContext) {
  if (!stepContext || !stepContext.question) return '';
  const optionsText = Array.isArray(stepContext.options) && stepContext.options.length
    ? ' The options being offered as shortcuts are: ' + stepContext.options.map((o) => '"' + o + '"').join(', ') + '.'
    : '';
  return '\n\n## Current Qualification Question\n' +
    'The widget is currently waiting on an answer to: "' + stepContext.question + '"' + optionsText +
    ' Always answer/acknowledge what the user actually said first, naturally, like a real consultant would, before anything else. ' +
    'Then decide which ONE of these four situations applies, and end your reply with exactly one machine-readable marker reflecting it, on its own at the very end, never described or explained in the visible text:\n' +
    '1. Their message answers the current question and clearly maps to one of the listed options: end with [[STEP_ANSWERED:exact option text]], copied exactly as given above.\n' +
    '2. Their message answers the current question in their own words but does not map to any listed option: end with [[STEP_ANSWERED:]] (empty).\n' +
    '3. Their message does NOT answer the current question, but you did NOT ask your own new specific question in reply (e.g. you just answered an unrelated question, or made a general comment): end with [[STEP_NOT_ANSWERED]] — the widget will re-show the original option buttons since the current question is still open.\n' +
    '4. Their message does NOT answer the current question, AND your reply itself asks the user something new and specific that needs a typed answer, BUT it is NOT about getting their name/phone/email (e.g. asking what platform they currently use): end with [[REDIRECTED]] — the widget will wait for a typed reply to YOUR new question instead of showing the original option buttons.\n' +
    '5. The user wants to be connected with the team, asked for contact/a callback, or otherwise made it clear it is time to collect their contact details (e.g. "can someone contact me", "can you connect me with somebody", "I\'d like to talk to someone"): do NOT ask for their name/phone/email yourself in the visible text at all, just acknowledge naturally (e.g. "Of course, let me grab a few details so our team can reach out.") and end with [[COLLECT_CONTACT]] instead — the widget itself will take over asking for name, phone, and email one at a time through its own validated flow, skipping any of those three it may already have on file. Never ask for name, phone, or email yourself in the visible reply text under any circumstance, even if the user offers it unprompted — always defer to the widget via [[COLLECT_CONTACT]].\n' +
    'This marker is REQUIRED on every single reply while a qualification question is active, with no exceptions, even for short replies, off-topic answers, or replies that just answer a factual question. Forgetting it causes the widget to show the wrong buttons to the user, which is a visible bug. Double-check before finishing your reply that it ends with exactly one of [[STEP_ANSWERED:...]], [[STEP_NOT_ANSWERED]], [[REDIRECTED]], or [[COLLECT_CONTACT]].';
}

// Strips the [[STEP_ANSWERED:...]] / [[STEP_NOT_ANSWERED]] / [[REDIRECTED]] /
// [[COLLECT_CONTACT]] marker the model was asked to append (see
// formatStepContext) and converts it into { stepAnswered, matchedOption,
// redirected, collectContact } the widget can act on directly. All fields
// are null when no stepContext was sent for this request — nothing to
// extract.
function extractStepSignal(raw, hadStepContext) {
  if (!hadStepContext) return { reply: raw.trim(), stepAnswered: null, matchedOption: null, redirected: null, collectContact: null };
  const answeredMatch = raw.match(/\[\[STEP_ANSWERED:([^\]]*)\]\]\s*$/i);
  if (answeredMatch) {
    const option = answeredMatch[1].trim();
    return { reply: raw.replace(answeredMatch[0], '').trim(), stepAnswered: true, matchedOption: option || null, redirected: false, collectContact: false };
  }
  const collectContactMatch = /\[\[COLLECT_CONTACT\]\]\s*$/i;
  if (collectContactMatch.test(raw)) {
    return { reply: raw.replace(collectContactMatch, '').trim(), stepAnswered: false, matchedOption: null, redirected: true, collectContact: true };
  }
  const redirectedMatch = /\[\[REDIRECTED\]\]\s*$/i;
  if (redirectedMatch.test(raw)) {
    return { reply: raw.replace(redirectedMatch, '').trim(), stepAnswered: false, matchedOption: null, redirected: true, collectContact: false };
  }
  const notAnsweredMatch = /\[\[STEP_NOT_ANSWERED\]\]\s*$/i;
  if (notAnsweredMatch.test(raw)) {
    return { reply: raw.replace(notAnsweredMatch, '').trim(), stepAnswered: false, matchedOption: null, redirected: false, collectContact: false };
  }
  // Model didn't include a marker at all — happens often enough with
  // gpt-4o-mini that the widget cannot depend on the marker being present.
  // Restored to the QA-approved bias: when we can't prove what happened,
  // default to treating the question as STILL OPEN (same as
  // [[STEP_NOT_ANSWERED]]) so the MCQ buttons reliably reappear. The
  // alternative (defaulting to redirected:true) was tried and caused the
  // qualification flow to silently stall into open-ended chat mode on
  // every marker omission, which is the more damaging failure mode for a
  // guided-qualification widget — a visible "still here, options below"
  // beats a silent dead end.
  return { reply: raw.trim(), stepAnswered: false, matchedOption: null, redirected: false, collectContact: false };
}

export default async function handler(req, res) {
  // CORS preflight: the widget may be served from a different origin than
  // this API (e.g. embedded via the standalone widget domain), which makes
  // the browser send an OPTIONS preflight before the real POST. Without
  // this, the preflight gets a 405 and the browser blocks the POST,
  // producing a silent failure with no reply ever received.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { messages, stepContext } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  try {
    // Retrieval: pull the most relevant knowledge-base entries for the
    // latest user message and append them to the system prompt for this
    // request only — keeps token usage proportional to relevance, not to
    // the total size of the knowledge base, and lets the KB grow to
    // hundreds of entries without bloating every request.
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const relevantEntries = lastUserMessage ? getRelevantKnowledge(lastUserMessage.content) : [];
    const knowledgeBlock = formatKnowledgeForPrompt(relevantEntries);

    // stepContext lets the widget ask, in addition to a normal reply,
    // "did this message already answer the current qualification
    // question?" — so the widget can skip re-showing that step's MCQ
    // buttons when the user already answered it in their own words,
    // instead of always showing them regardless of context.
    const stepBlock = formatStepContext(stepContext);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + knowledgeBlock + stepBlock },
          ...messages,
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const { reply, stepAnswered, matchedOption, redirected, collectContact } = extractStepSignal(raw, !!stepContext);
    return res.status(200).json({ reply: reply.replace(/—/g, ','), stepAnswered, matchedOption, redirected, collectContact });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
