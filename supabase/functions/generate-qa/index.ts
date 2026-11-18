// POST /functions/v1/generate-qa
// Body: {
//   document_id: string,
//   from_index: number, to_index: number,     // chunk range (inclusive) = one "section"
//   count: number,                             // how many questions to ask for (max 15)
//   question_type: "short" | "mcq" | "true_false" | "mixed",
//   difficulty: "easy" | "medium" | "hard",
//   avoid?: string[]                           // questions already generated (prevents repeats)
// }
//
// This is the MAP step of map-reduce. The browser splits the document into
// sections and calls this once per section; then it merges, de-duplicates and
// trims the results (the REDUCE step). The model is explicitly allowed to
// return FEWER questions than asked if the text doesn't support more.

import { corsHeaders, errorResponse, json } from "../_shared/cors.ts";
import { getUserClient, HttpError } from "../_shared/supabase.ts";
import { getLLM, reasoningOptions } from "../_shared/llm.ts";

type QType = "short" | "mcq" | "true_false";
const TYPES = ["short", "mcq", "true_false", "mixed"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const MAX_SECTION_CHARS = 14000;

interface QAItem {
  question: string;
  answer: string;
  page: number | null;
  type: QType;
  options?: string[];
  explanation?: string;
}

const TYPE_INSTRUCTIONS: Record<(typeof TYPES)[number], string> = {
  short:
    'Every question is "short": an open question with a 1–3 sentence answer.',
  mcq:
    'Every question is "mcq": exactly 4 options in "options", one correct. "answer" must be copied exactly from "options".',
  true_false:
    'Every question is "true_false": a statement to judge. "answer" is exactly "True" or "False". Put the reason in "explanation".',
  mixed:
    'Mix the types "short", "mcq" (exactly 4 options, "answer" copied exactly from "options") and "true_false" ("answer" is "True" or "False").',
};

const DIFFICULTY_INSTRUCTIONS: Record<(typeof DIFFICULTIES)[number], string> = {
  easy: "Easy: test recall of clearly stated facts and definitions.",
  medium: "Medium: test understanding — explain why/how, compare, summarize ideas.",
  hard: "Hard: test application and analysis — combine ideas, apply them to a scenario, find implications.",
};

function buildPrompt(text: string, count: number, type: (typeof TYPES)[number], difficulty: (typeof DIFFICULTIES)[number], avoid: string[]) {
  return `You write study questions from a document excerpt.

Write UP TO ${count} question-answer pairs based ONLY on the excerpt below.
- Quality over quantity. If the excerpt only supports fewer good questions, return fewer. Never invent facts and never pad.
- Skip trivia like page numbers, headers, author names, copyright text or tables of contents.
- Each question must be answerable from the excerpt alone, and must not depend on "the excerpt" or "the text" wording.
- ${TYPE_INSTRUCTIONS[type]}
- ${DIFFICULTY_INSTRUCTIONS[difficulty]}
- "page" is the page number (from the [Page N] markers) where the answer is found.
${avoid.length ? `- Do NOT repeat or rephrase these existing questions:\n${avoid.map((q) => `  * ${q}`).join("\n")}` : ""}

Respond with JSON only, in this exact shape:
{"questions":[{"question":"...","answer":"...","page":1,"type":"short|mcq|true_false","options":["..."],"explanation":"..."}]}
("options" only for mcq; "explanation" optional.)

Excerpt:
"""
${text}
"""`;
}

function clean(raw: unknown, allowed: QType[]): QAItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const question = typeof r.question === "string" ? r.question.trim() : "";
  let answer = typeof r.answer === "string" ? r.answer.trim() : typeof r.answer === "boolean" ? (r.answer ? "True" : "False") : "";
  const type = (typeof r.type === "string" ? r.type : allowed[0]) as QType;
  if (!question || !answer || !allowed.includes(type)) return null;

  const page = Number.isFinite(Number(r.page)) ? Number(r.page) : null;
  const explanation = typeof r.explanation === "string" && r.explanation.trim() ? r.explanation.trim() : undefined;
  const item: QAItem = { question, answer, page, type, explanation };

  if (type === "mcq") {
    const options = Array.isArray(r.options) ? r.options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (options.length < 3) return null;
    // Accept "B" / "B) foo" style answers by mapping them back to the option text.
    const letter = answer.match(/^([A-D])(\)|\.|:|$)/i);
    if (!options.includes(answer) && letter) answer = options["ABCD".indexOf(letter[1].toUpperCase())] ?? answer;
    if (!options.includes(answer)) return null;
    item.answer = answer;
    item.options = options.slice(0, 4);
  }
  if (type === "true_false") {
    const a = answer.toLowerCase();
    if (a.startsWith("true")) item.answer = "True";
    else if (a.startsWith("false")) item.answer = "False";
    else return null;
  }
  return item;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { supabase } = await getUserClient(req);
    const body = await req.json();

    const document_id = String(body.document_id ?? "");
    const from = Math.max(0, Number(body.from_index ?? 0));
    const to = Number(body.to_index ?? from);
    const count = Math.min(15, Math.max(1, Number(body.count ?? 5)));
    const question_type = TYPES.includes(body.question_type) ? body.question_type : "short";
    const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : "medium";
    const avoid: string[] = Array.isArray(body.avoid) ? body.avoid.slice(-40).map(String) : [];

    if (!document_id) throw new HttpError(400, "document_id is required");

    const { data: chunks, error } = await supabase
      .from("chunks")
      .select("page, content, chunk_index")
      .eq("document_id", document_id)
      .gte("chunk_index", from)
      .lte("chunk_index", to)
      .order("chunk_index");
    if (error) throw new Error(error.message);
    if (!chunks?.length) return json({ items: [] });

    // Join chunks with page markers so the model can cite pages.
    let text = "";
    let lastPage = -1;
    for (const c of chunks) {
      if (c.page !== lastPage) {
        text += `\n[Page ${c.page}]\n`;
        lastPage = c.page;
      }
      text += c.content + "\n";
    }
    text = text.slice(0, MAX_SECTION_CHARS);

    const llm = getLLM({ temperature: 0.4, maxTokens: 4096 });
    const res = await llm.invoke(
      [{ role: "user", content: buildPrompt(text, count, question_type, difficulty, avoid) }],
      { response_format: { type: "json_object" }, ...reasoningOptions() },
    );

    const content = typeof res.content === "string" ? res.content : "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ items: [], warning: "Model returned invalid JSON for this section" });
    }

    const allowed: QType[] = question_type === "mixed" ? ["short", "mcq", "true_false"] : [question_type];
    const list = Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];
    const items = list.map((q) => clean(q, allowed)).filter((q): q is QAItem => q !== null).slice(0, count);

    return json({ items });
  } catch (err) {
    return errorResponse(err, err instanceof HttpError ? err.status : 500);
  }
});
