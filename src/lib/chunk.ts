// Splits page text into overlapping chunks using LangChain's text splitter.
// Each chunk remembers its page number (used for citations).
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import type { PageText } from './pdf'

export interface Chunk {
  chunk_index: number
  page: number
  content: string
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, // ~150–200 words: small enough to be specific, big enough for context
  chunkOverlap: 150, // overlap so sentences cut at a boundary still appear whole somewhere
})

export async function chunkPages(pages: PageText[]): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  for (const { page, text } of pages) {
    if (!text.trim()) continue
    const parts = await splitter.splitText(text)
    for (const content of parts) {
      if (content.trim().length < 30) continue // skip page numbers / stray headers
      chunks.push({ chunk_index: chunks.length, page, content })
    }
  }
  return chunks
}

export function countWords(pages: PageText[]): number {
  return pages.reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0)
}
