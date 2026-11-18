# DocMind: Chat with your PDF + Q&A Generator

An AI study assistant built on a real **RAG (Retrieval-Augmented Generation)** pipeline.

1. **Chat mode**: upload a PDF and ask questions. Answers come only from the PDF and cite page numbers.
2. **Q&A mode**: generate **10 / 15 / 20 / 25 / 30** questions with answers (short answer, MCQ, true/false or mixed; easy, medium or hard). If the PDF can't support that many good questions, you get the ones that could be made, plus a message saying how many. Download the set as a **PDF**.

**Stack:** React · Vite · TypeScript · Tailwind CSS · Supabase (Postgres + pgvector + Auth + Edge Functions) · LangChain.js · Groq (LLM) · gte-small (embeddings)

---

## 1. How it works

### Ingestion (once per PDF)
```
Browser                                         Supabase
───────                                         ────────
PDF ─► pdf.js extracts text page by page
    ─► LangChain splitter → ~1000-char chunks (each keeps its page number)
    ─► insert row in `documents`  ──────────────► documents table
    ─► send chunks in batches of 16 ────────────► Edge Function `ingest`
                                                    └─ gte-small embedding (384 numbers per chunk)
                                                    └─ insert into `chunks` (pgvector column)
```
The PDF is parsed **in the browser**, so the server never handles PDF files. Sending chunks in small batches keeps each request fast and drives the progress bar.

### Chat (the "RAG" part)
```
Question ─► Edge Function `chat`
             1. follow-up? rewrite it as a standalone question (small Groq model)
             2. embed the question with gte-small
             3. match_chunks(): pgvector finds the 6 most similar chunks of THIS document
             4. Groq LLM answers using ONLY those chunks and cites (p. N)
             5. streams back: sources first, then tokens  ─► UI renders live
```
**Why retrieval?** The LLM never reads the whole PDF, only the few chunks most relevant to the question. That's why this works on long documents and why answers can cite pages.

### Q&A generation (map-reduce, not RAG)
Questions must cover the **whole** document, not just the chunks similar to one query:
```
PLAN    split the chunks into sections (≈10 chunks each, max 8 sections)
MAP     for each section → Edge Function `generate-qa`
          "Write UP TO k questions using ONLY this text. Return fewer if the text can't support more."
          JSON mode + validation (MCQ answer must be one of the options, etc.)
          already-generated questions are passed in so the model doesn't repeat them
REDUCE  remove near-duplicates (Jaccard similarity) → pick round-robin across sections
        (so the whole PDF is covered) → sort by page → trim to N
RESULT  if fewer than N → "Only X questions could be generated from this PDF"
```
Sections are processed **one at a time** to stay under Groq's free-tier rate limits. If a request is rate-limited (HTTP 429), the app waits and retries automatically, and the UI shows the wait.

### Security
- The **Groq key lives only in Supabase secrets**. The browser never sees it.
- **Row Level Security**: every table has `user_id = auth.uid()` policies, and the Edge Functions run *as the user* (they forward the user's JWT), so nobody can read anyone else's documents.

---

## 2. Project structure

```
docmind/
├── index.html                  # HTML shell, fonts, page title
├── vite.config.ts              # Vite + React + Tailwind plugins
├── .env.example                # copy to .env.local → Supabase URL + anon key
├── vercel.json                 # SPA routing for Vercel  (public/_redirects = Netlify)
├── public/
│   ├── favicon.svg
│   └── demo.mp4                # ← YOUR demo video goes here (see section 6)
│
├── src/                        # ───────── FRONTEND ─────────
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # routes: / , /login , /app , /app/doc/:id
│   ├── index.css               # Tailwind + design tokens (colors, buttons, cards)
│   ├── types.ts                # shared TypeScript types
│   ├── context/AuthContext.tsx # current Supabase session
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── pdf.ts              # pdf.js → text per page
│   │   ├── chunk.ts            # LangChain RecursiveCharacterTextSplitter
│   │   ├── api.ts              # upload pipeline, streaming chat, DB calls, retries
│   │   ├── qa.ts               # Q&A map-reduce: plan sections, call, dedupe, trim
│   │   └── exportPdf.ts        # jsPDF → downloadable Q&A PDF
│   ├── components/
│   │   ├── DemoVideo.tsx       # hero video (falls back to an animated mock)
│   │   ├── UploadDropzone.tsx  # drag & drop + progress bar
│   │   ├── ChatPanel.tsx       # chat UI, streaming, source chips
│   │   ├── QAPanel.tsx         # Q&A settings, progress, results, history
│   │   ├── QAList.tsx          # question cards, MCQ options, reveal answers
│   │   └── AppHeader, Logo, Spinner, ProtectedRoute
│   └── pages/
│       ├── Landing.tsx         # hero + demo video + how it works + features
│       ├── Login.tsx           # email/password + "Continue as guest"
│       ├── Dashboard.tsx       # upload + document list
│       └── DocumentPage.tsx    # tabs: Chat | Generate Q&A
│
└── supabase/                   # ───────── BACKEND ─────────
    ├── config.toml
    ├── migrations/0001_init.sql   # tables, pgvector, HNSW index, RLS, match_chunks()
    └── functions/                 # Deno Edge Functions
        ├── _shared/               # cors, user-scoped client, gte-small embed, Groq LLM
        ├── ingest/index.ts        # embed + store chunks
        ├── chat/index.ts          # RAG chat, streamed as NDJSON
        └── generate-qa/index.ts   # Q&A for one section (the MAP step)
```

---

## 3. Setup, step by step

### Prerequisites
- **Node.js 20+** (`node -v`)
- A free **Supabase** account → https://supabase.com
- A free **Groq** API key → https://console.groq.com/keys

### Step 1: Install the frontend
```bash
cd docmind
npm install
cp .env.example .env.local
```

### Step 2: Create the Supabase project
1. Supabase Dashboard → **New project** (pick a region near you, save the DB password).
2. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key** into `.env.local`.

### Step 3: Create the database
Dashboard → **SQL Editor** → **New query** → paste all of `supabase/migrations/0001_init.sql` → **Run**.
You should see the tables `documents`, `chunks` and `qa_sets` under **Table Editor**.

### Step 4: Turn on auth options
Dashboard → **Authentication → Sign In / Providers**:
- Enable **Allow anonymous sign-ins**. This powers the "Continue as guest" button, which recruiters will love.
- Under **Email**, optionally turn off **Confirm email** while developing.

### Step 5: Deploy the Edge Functions
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF      # the "xxxx" in https://xxxx.supabase.co
npx supabase secrets set GROQ_API_KEY=gsk_your_key_here
npx supabase functions deploy
```
If deploy complains about Docker, run `npx supabase functions deploy --use-api`.

Optional: change models (check https://console.groq.com/docs/models for current names):
```bash
npx supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile GROQ_FAST_MODEL=llama-3.1-8b-instant
```

### Step 6: Run it
```bash
npm run dev
```
Open http://localhost:5173 → **Try it free** → **Continue as guest** → upload a PDF.

---

## 4. Build phases (suggested order)

| Phase | What you build | Files | Done when… |
|---|---|---|---|
| **1. Foundation** | Vite app, Supabase project, DB schema, auth | `src/lib/supabase.ts`, `context/`, `Login.tsx`, `0001_init.sql` | you can sign in as guest |
| **2. Ingestion** | PDF → chunks → embeddings | `pdf.ts`, `chunk.ts`, `api.ts#uploadDocument`, `functions/ingest` | rows appear in `chunks` with embeddings |
| **3. Chat (RAG)** | retrieval + streaming answers with citations | `functions/chat`, `ChatPanel.tsx` | answers cite pages; off-topic questions get "couldn't find that" |
| **4. Q&A generator** | map-reduce generation, shortfall message, PDF export | `functions/generate-qa`, `qa.ts`, `QAPanel.tsx`, `exportPdf.ts` | a 2-page PDF + "30 questions" shows "Only X…" |
| **5. Polish & ship** | landing page, demo video, deploy, README | `Landing.tsx`, `DemoVideo.tsx`, `public/demo.mp4` | live URL on your resume |

All the code is already here. Use the phases as your **learning order**: read and test each phase's files before moving on, so you can explain every part in interviews.

---

## 5. Deploy the frontend (Vercel)
1. Push this folder to a GitHub repo (`.env.local` is git-ignored, which is good).
2. https://vercel.com → **Add New Project** → import the repo. Framework: **Vite**.
3. Add Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy. `vercel.json` already handles page refreshes on routes like `/app/doc/...`.
5. Supabase → **Authentication → URL Configuration** → set **Site URL** to your Vercel URL.

(Netlify works too: `public/_redirects` is included.)

---

## 6. The hero demo video

The landing page plays `public/demo.mp4` automatically (muted, looped). Until that file exists, an animated mock-up of the app is shown instead, so the page never looks broken.

**Record it (60–90 seconds):**
1. Run the app, sign in as guest, and have a good sample PDF ready (lecture notes work well).
2. Record the browser window at 1280×720 or 1920×1080:
   - Windows: **Win + Alt + R** (Xbox Game Bar) or OBS Studio
   - macOS: **Cmd + Shift + 5**
   - Or Loom, then download the MP4
3. Script: upload PDF (progress bar) → ask 2 questions (show the page chips) → switch to **Generate Q&A** → pick 10, MCQ → generate → toggle **Study mode** → **Download PDF**.
4. Compress it to under ~8 MB so the page loads fast:
   ```bash
   ffmpeg -i raw.mp4 -vf "scale=1280:-2,fps=30" -c:v libx264 -crf 28 -preset slow -an public/demo.mp4
   ```
   (or use HandBrake with the "Web" preset). `-an` removes audio, since the video autoplays muted anyway.
5. Optional poster image shown before the video loads: `public/demo-poster.jpg` (a screenshot).

---

## 7. Limits & troubleshooting

| Problem | Fix |
|---|---|
| "Continue as guest" fails | Enable anonymous sign-ins (Step 4) |
| `Failed to fetch` on upload/chat | Functions not deployed, or wrong URL/key in `.env.local`; restart `npm run dev` after editing it |
| "rate limit reached" | Groq free tier; wait a minute. Q&A retries automatically |
| "model is unavailable / decommissioned" | Set `GROQ_MODEL` to a current model name (Step 5) |
| "looks like a scanned PDF" | The PDF is images only; OCR isn't supported yet |
| Non-English characters look wrong in the downloaded PDF | jsPDF's built-in font is Latin-only. Embed a Unicode font (e.g. Noto Sans) via `pdf.addFont` |
| Function logs | Dashboard → Edge Functions → select function → **Logs** |

Default limits: 60 pages and 20 MB per PDF (`src/lib/pdf.ts`). Use **Page range** in the Q&A tab to focus questions on one chapter.

---

## 8. Ideas for v2
- Quiz mode: type your answer and let the LLM grade it, with a score at the end
- Hybrid search: Postgres full-text plus vector search (better for names and numbers)
- Re-ranking of retrieved chunks
- Chat across multiple PDFs
- Export to CSV / Anki flashcards
- Retrieval eval: 15 hand-written Q&A pairs, measure how often the right page is retrieved

---

## 9. Interview talking points
- **Chunking:** 1000 chars with 150 overlap. Too big dilutes similarity; too small loses context.
- **Embeddings:** gte-small, 384 dimensions, cosine similarity, HNSW index in pgvector.
- **Hallucination control:** context-only prompt, "couldn't find that" fallback, page citations.
- **Q&A pipeline:** map-reduce over sections, JSON mode + validation, "allowed to return fewer", Jaccard dedupe, round-robin selection for coverage.
- **Security:** RLS on every table; functions use the user's JWT; LLM key server-side only.
- **Rate limits:** sequential section calls, exponential backoff, and user-visible retry state.
