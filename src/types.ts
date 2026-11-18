export type DocStatus = 'processing' | 'ready' | 'failed'

export interface DocumentRow {
  id: string
  name: string
  page_count: number
  word_count: number
  chunk_count: number
  status: DocStatus
  created_at: string
}

export interface Source {
  page: number
  similarity: number
  snippet: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  error?: boolean
}

export type QuestionType = 'short' | 'mcq' | 'true_false' | 'mixed'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QAItem {
  question: string
  answer: string
  page: number | null
  type: Exclude<QuestionType, 'mixed'>
  options?: string[]
  explanation?: string
}

export interface QASet {
  id: string
  document_id: string
  requested: number
  generated: number
  question_type: QuestionType
  difficulty: Difficulty
  items: QAItem[]
  created_at: string
}
