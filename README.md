# DocMind

**Chat with your PDFs and turn them into question banks.**

🔗 **Live demo:** [docmind.vercel.app](https://doc-mind-tan.vercel.app/) (no sign-up needed, just click *Continue as guest*)

I built DocMind because re-reading long notes before exams is slow. You upload a PDF and either ask it questions, with every answer pointing back to the page it came from, or generate a set of practice questions with answers that you can download as a PDF.

Under the hood it's a full **RAG (Retrieval-Augmented Generation)** pipeline: PDF parsing, chunking, embeddings, vector search and an LLM, with each user's data isolated from everyone else's.

---

## Features

**💬 Chat with a PDF**
- Ask anything about the document and get an answer that streams in live
- Every answer cites its source pages, e.g. *(p. 4)*, so you can check it
- If something isn't in the document, it says so instead of making it up
- Follow-up questions work ("what about the second one?")

**📝 Q&A Generator**
- Generate **10, 15, 20, 25 or 30** questions with answers
- Question types: **short answer, multiple choice, true/false, or mixed**
- Difficulty: **easy, medium or hard**
- Option to generate from a **page range** only (e.g. one chapter)
- **Honest generation:** if a PDF can't support 30 good questions, you get the ones that could be made, with a message like *"Only 12 questions could be generated from this PDF"*. No padding, no invented facts
- **Study mode** hides the answers so you can test yourself
- **Download as PDF:** a clean, printable sheet with each answer and its page reference
- Previously generated sets are saved per document

**🔐 Accounts**
- Email sign-up, or one-click guest access
- Your documents are private to your account (enforced in the database with Row Level Security)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| PDF handling | pdf.js (text extraction), jsPDF (export) |
| AI orchestration | LangChain.js |
| LLM | Groq (`gpt-oss-120b` for answers and questions, `gpt-oss-20b` for query rewriting) |
| Embeddings | gte-small (384-dim), running inside Supabase Edge Functions |
| Database | Supabase Postgres + **pgvector** (HNSW index) |
| Backend | Supabase Edge Functions (Deno) |
| Auth | Supabase Auth (email + anonymous) |
| Hosting | Vercel (frontend), Supabase (backend) |

---

## How it works

### 1. Ingestion: turning a PDF into searchable vectors
```
Browser                                         Supabase
───────                                         ────────
PDF ─► pdf.js extracts text page by page
    ─► LangChain splitter → ~1000-char chunks (each keeps its page number)
    ─► create a row in `documents`  ────────────► documents table
    ─► send chunks in batches of 16 ────────────► Edge Function `ingest`
                                                    └─ gte-small embedding per chunk
                                                    └─ stored in `chunks` (pgvector)
```
I parse the PDF **in the browser**, so the server never handles raw files. Sending chunks in small batches keeps each request short and lets the UI show real progress.

### 2. Chat: retrieval-augmented generation
```
Question ─► Edge Function `chat`
             1. if it's a follow-up, rewrite it as a standalone question
             2. embed the question with gte-small
             3. pgvector finds the 6 most similar chunks of this document
             4. the LLM answers using ONLY those chunks and cites pages
             5. the response streams back: sources first, then tokens
```
The model never sees the whole PDF, only the few chunks relevant to the question. That keeps it fast and cheap, and it's what makes page citations possible.

### 3. Q&A generation: map-reduce
Plain RAG doesn't work for this. Questions need to cover the *whole* document, not just the parts that match a single query, so I used a map-reduce approach:
```
PLAN    split the document (or the chosen page range) into sections
MAP     for each section → Edge Function `generate-qa`
          "Write UP TO k questions using ONLY this text. Return fewer if it can't support more."
          JSON output, validated (e.g. an MCQ answer must be one of its options)
          questions already generated are passed along to avoid repeats
REDUCE  remove near-duplicates (Jaccard similarity on keywords)
        → pick round-robin across sections so the whole document is covered
        → sort by page → trim to the requested number
```
Sections run one after another to stay inside Groq's free-tier rate limits. If a request gets rate-limited, the app waits and retries automatically and shows that in the UI.

---

## Design decisions

- **Embeddings inside Supabase:** Groq doesn't offer embedding models, so I used Supabase's built-in `gte-small`. That meant no extra API key, no extra cost, and the embeddings are created right next to the database.
- **Allowing the model to return fewer questions:** LLMs pad lists with weak or made-up questions when they're forced to hit a number. Letting the model return fewer, and counting the result in code, gave noticeably better questions.
- **Security by default:** the LLM key exists only as a server-side secret. Edge Functions run *as the signed-in user* (they forward the user's JWT), so Row Level Security applies everywhere, even inside the vector search function.
- **Streaming with sources first:** the chat endpoint sends newline-delimited JSON. The sources arrive first and then the answer token by token, so the citation chips can appear before the answer finishes.
- **Lazy loading:** pdf.js and jsPDF are large libraries, so they're only loaded on the app pages. The landing page stays light.

---

## Project structure

```
docmind/
├── src/                          # Frontend
│   ├── pages/                    # Landing, Login, Dashboard, DocumentPage
│   ├── components/               # ChatPanel, QAPanel, QAList, UploadDropzone, DemoVideo…
│   ├── context/AuthContext.tsx   # Supabase session
│   └── lib/
│       ├── pdf.ts                # pdf.js → text per page
│       ├── chunk.ts              # LangChain text splitter
│       ├── api.ts                # upload pipeline, streaming chat, retries
│       ├── qa.ts                 # Q&A map-reduce: plan, generate, dedupe, trim
│       └── exportPdf.ts          # Q&A → downloadable PDF
│
└── supabase/                     # Backend
    ├── migrations/0001_init.sql  # tables, pgvector, HNSW index, RLS, match_chunks()
    └── functions/
        ├── _shared/              # CORS, user-scoped client, embeddings, LLM setup
        ├── ingest/               # embed + store chunks
        ├── chat/                 # RAG chat (streaming)
        └── generate-qa/          # question generation for one section
```

---

## Limitations

- Supports text-based PDFs up to **60 pages / 20 MB**. Scanned PDFs (images only) need OCR, which isn't supported yet.
- The exported PDF uses a Latin-only font, so non-English scripts may not render correctly.
- Runs on Groq's free tier, so heavy use can hit rate limits (the app retries automatically).

## What I'd add next

- **Quiz mode** where you type an answer, the LLM grades it, and you get a score at the end
- **Hybrid search** (keyword + vector) for better results on names and numbers
- **Re-ranking** of retrieved chunks
- **Chat across multiple PDFs** at once
- **Export to Anki / CSV** for flashcards
- A small **evaluation set** to measure how often the right page is retrieved

---

## Author

**Atharva Narvekar**
[GitHub](https://github.com/Virus2hell) · [LinkedIn](https://www.linkedin.com/in/atharva-narvekar-8535862b1/)
