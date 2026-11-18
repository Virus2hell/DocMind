// POST /functions/v1/chat
// Body: { document_id: string, question: string, history?: { role: "user" | "assistant", content: string }[] }
//
// The RAG pipeline:
//   1. (follow-ups only) rewrite the question so it makes sense on its own
//   2. embed the question with gte-small
//   3. find the most similar chunks of THIS document with pgvector (match_chunks)
//   4. ask the Groq LLM to answer using ONLY those chunks, citing pages
//   5. stream the answer back as NDJSON lines:
//        {"type":"sources","sources":[...]}
//        {"type":"token","value":"..."}   (many)
//        {"type":"done"}  or  {"type":"error","message":"..."}

import { corsHeaders, errorResponse } from "../_shared/cors.ts";
import { getUserClient, HttpError } from "../_shared/supabase.ts";
import { embed } from "../_shared/embed.ts";
import { getLLM, reasoningOptions } from "../_shared/llm.ts";

const TOP_K = 6;
const MAX_HISTORY = 6;

type ChatTurn = { role: "user" | "assistant"; content: string };
type Match = { id: number; page: number; chunk_index: number; content: string; similarity: number };

const SYSTEM_PROMPT = `You are DocMind, an assistant that answers questions about a PDF the user uploaded.

Rules:
- Use ONLY the context excerpts below. Do not use outside knowledge.
- If the answer is not in the context, say: "I couldn't find that in this document." and suggest what the user could ask instead.
- Cite the page for each fact like this: (p. 4). Use the page numbers shown in the excerpt headers.
- Be concise. Use short paragraphs or bullet points. Use Markdown.`;

async function condenseQuestion(question: string, history: ChatTurn[]): Promise<string> {
  if (history.length === 0) return question;
  const llm = getLLM({ fast: true, temperature: 0, maxTokens: 600 });
  const transcript = history.map((t) => `${t.role}: ${t.content}`).join("\n");
  const res = await llm.invoke([
    {
      role: "system",
      content:
        "Rewrite the user's latest question as a single standalone question that can be understood without the conversation. Return only the question.",
    },
    { role: "user", content: `Conversation:\n${transcript}\n\nLatest question: ${question}` },
  ], reasoningOptions(true));
  const text = typeof res.content === "string" ? res.content.trim() : "";
  return text || question;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let supabase, body;
  try {
    ({ supabase } = await getUserClient(req));
    body = (await req.json()) as { document_id?: string; question?: string; history?: ChatTurn[] };
    if (!body.document_id || !body.question?.trim()) {
      throw new HttpError(400, "document_id and question are required");
    }
  } catch (err) {
    return errorResponse(err, err instanceof HttpError ? err.status : 500);
  }

  const { document_id, question } = body as { document_id: string; question: string };
  const history = (body.history ?? []).slice(-MAX_HISTORY).map((t) => ({
    role: t.role === "assistant" ? "assistant" as const : "user" as const,
    content: String(t.content).slice(0, 2000),
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        // 1 + 2: standalone question → embedding
        const standalone = await condenseQuestion(question.trim(), history);
        const queryEmbedding = await embed(standalone);

        // 3: vector search (RLS-protected)
        const { data, error } = await supabase.rpc("match_chunks", {
          query_embedding: queryEmbedding,
          doc_id: document_id,
          match_count: TOP_K,
        });
        if (error) throw new Error(error.message);
        const matches = (data ?? []) as Match[];

        send({
          type: "sources",
          sources: matches.map((m) => ({
            page: m.page,
            similarity: Math.round(m.similarity * 100) / 100,
            snippet: m.content.slice(0, 240),
          })),
        });

        // 4: answer with the retrieved context
        const context = matches
          .sort((a, b) => a.chunk_index - b.chunk_index)
          .map((m) => `[Excerpt — page ${m.page}]\n${m.content}`)
          .join("\n\n---\n\n");

        const llm = getLLM({ temperature: 0.2, maxTokens: 2048 });
        const answerStream = await llm.stream([
          { role: "system", content: `${SYSTEM_PROMPT}\n\nContext:\n${context || "(no relevant excerpts found)"}` },
          ...history,
          { role: "user", content: question },
        ], reasoningOptions());

        // 5: stream tokens to the browser
        for await (const chunk of answerStream) {
          const token = typeof chunk.content === "string" ? chunk.content : "";
          if (token) send({ type: "token", value: token });
        }
        send({ type: "done" });
      } catch (err) {
        console.error(err);
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
});
