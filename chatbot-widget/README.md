# Demski Group Chatbot Widget

**Client:** The Demski Group

## What This Project Is

A standalone, embeddable lead-capture chatbot for The Demski Group website. It runs as "Erin", a virtual assistant that guides visitors through a natural conversation, collects project details and contact information, and emails captured leads directly to the Demski team. The widget is embedded via a single `<script>` tag and works on any HTML page. The backend uses Vercel serverless functions powered by the OpenAI API for conversation and SendGrid for email delivery.

## Tech Stack

- **Frontend:** Vanilla JavaScript (no framework), HTML/CSS
- **Backend:** Vercel serverless functions (Node.js, ES modules)
- **AI:** OpenAI API (GPT-4 class model)
- **Email:** SendGrid (`@sendgrid/mail`)
- **Hosting / Deployment:** Vercel
- **Knowledge Base:** Markdown files in `knowledge/` (RAG-style context injection)

## How to Set Up Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/DEV-ETHIXWEB/demski-group-chatbot.git
   cd demski-group-chatbot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a local environment file:
   ```bash
   cp .env.example .env
   ```
   *(Fill in your API keys — see Environment Variables below.)*

4. Start the local dev server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to test the widget.

## Environment Variables

Create a `.env` file at the project root (never commit this file). Required variables:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for AI conversation (GPT model) |
| `SENDGRID_API_KEY` | SendGrid API key for sending lead notification emails |

## Deployment Notes

- **Platform:** Vercel
- **Serverless functions:** `api/chat.js` (AI conversation) and `api/send-lead.js` (email leads)
- **Auto-deploy:** Pushes to `main` trigger a production deployment on Vercel
- **Embed:** The widget is embedded on any page via `loader.js` — drop a `<script>` tag pointing to the deployed loader URL
- **Branch workflow:** Work on `feat/<clickup-task-name>` branches only — never commit directly to `develop` or `main`
- **Leads go to:** andrew.demski@demskigroupdev.com and aaron.demski@demskigroupdev.com

## Key Contacts

| Role | Name | Contact |
|---|---|---|
| Client | Andrew Demski | andrew.demski@demskigroupdev.com |
| Client | Aaron Demski | aaron.demski@demskigroupdev.com |
| Head of Client Strategy | Amar | Ethixweb |
| Lead Developer | Akash | Ethixweb |
