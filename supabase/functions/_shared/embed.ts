// Embeddings with Supabase's built-in gte-small model.
// Runs inside the Edge Function itself: free, no extra API key needed.
// Output: 384 numbers per text, normalized so cosine similarity works well.

// deno-lint-ignore no-explicit-any
declare const Supabase: any;

const session = new Supabase.ai.Session("gte-small");

export async function embed(text: string): Promise<number[]> {
  const output = await session.run(text, { mean_pool: true, normalize: true });
  return Array.from(output as ArrayLike<number>);
}
