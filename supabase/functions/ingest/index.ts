// POST /functions/v1/ingest
// Body: { document_id: string, chunks: { chunk_index: number, page: number, content: string }[] }
//
// The browser parses the PDF and splits it into chunks, then sends them here
// in small batches. For each chunk we create an embedding (gte-small) and
// store it in the `chunks` table. Small batches keep every request quick and
// let the UI show a real progress bar.

import { corsHeaders, errorResponse, json } from "../_shared/cors.ts";
import { getUserClient, HttpError } from "../_shared/supabase.ts";
import { embed } from "../_shared/embed.ts";

const MAX_BATCH = 24;
const MAX_CHUNK_CHARS = 2000;

interface IncomingChunk {
  chunk_index: number;
  page: number;
  content: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { supabase } = await getUserClient(req);
    const { document_id, chunks } = (await req.json()) as {
      document_id?: string;
      chunks?: IncomingChunk[];
    };

    if (!document_id || !Array.isArray(chunks) || chunks.length === 0) {
      throw new HttpError(400, "document_id and a non-empty chunks array are required");
    }
    if (chunks.length > MAX_BATCH) throw new HttpError(400, `Send at most ${MAX_BATCH} chunks per request`);

    // RLS makes this return nothing if the document belongs to someone else.
    const { data: doc } = await supabase.from("documents").select("id").eq("id", document_id).maybeSingle();
    if (!doc) throw new HttpError(404, "Document not found");

    const rows = [];
    for (const c of chunks) {
      const content = String(c.content ?? "").slice(0, MAX_CHUNK_CHARS).trim();
      if (!content) continue;
      rows.push({
        document_id,
        chunk_index: Number(c.chunk_index),
        page: Number(c.page),
        content,
        embedding: await embed(content),
      });
    }

    if (rows.length) {
      const { error } = await supabase.from("chunks").insert(rows);
      if (error) throw new Error(error.message);
    }

    return json({ inserted: rows.length });
  } catch (err) {
    return errorResponse(err, err instanceof HttpError ? err.status : 500);
  }
});
