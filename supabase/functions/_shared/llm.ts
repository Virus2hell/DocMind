import { ChatGroq } from "npm:@langchain/groq@1";

/**
 * Groq chat models via LangChain.
 * Model names change over time; override them with secrets if Groq retires one:
 *   supabase secrets set GROQ_MODEL=... GROQ_FAST_MODEL=...
 * List the models your key can use:  GET https://api.groq.com/openai/v1/models
 */
const apiKey = Deno.env.get("GROQ_API_KEY");

export const MAIN_MODEL = Deno.env.get("GROQ_MODEL") ?? "openai/gpt-oss-120b";
export const FAST_MODEL = Deno.env.get("GROQ_FAST_MODEL") ?? "openai/gpt-oss-20b";

export function getLLM(opts: { fast?: boolean; temperature?: number; maxTokens?: number } = {}) {
  if (!apiKey) throw new Error("GROQ_API_KEY secret is not set");
  return new ChatGroq({
    apiKey,
    model: opts.fast ? FAST_MODEL : MAIN_MODEL,
    temperature: opts.temperature ?? 0.2,
    maxTokens: opts.maxTokens ?? 1024,
    // LangChain retries automatically with exponential backoff,
    // which handles Groq free-tier rate limits (HTTP 429).
    maxRetries: 4,
  });
}

/**
 * "Reasoning" models think before answering, and that thinking counts toward
 * max tokens (and the free-tier token budget). Keep it short.
 * Pass the result as the 2nd argument of .invoke() / .stream().
 */
export function reasoningOptions(fast = false): { reasoning_effort?: "low" | "none" } {
  const model = fast ? FAST_MODEL : MAIN_MODEL;
  if (/gpt-oss/i.test(model)) return { reasoning_effort: "low" };
  if (/qwen3/i.test(model)) return { reasoning_effort: "none" };
  return {};
}
