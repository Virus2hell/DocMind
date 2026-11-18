// Builds a clean, printable Q&A PDF in the browser with jsPDF.
import type { QASet } from '../types'

const TYPE_LABEL = { short: 'Short answer', mcq: 'Multiple choice', true_false: 'True / False', mixed: 'Mixed' }

export async function downloadQAPdf(docName: string, set: QASet) {
  const { jsPDF } = await import('jspdf') // loaded on demand (it's large)
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 56
  const width = pageW - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage()
      y = margin
    }
  }

  const write = (text: string, opts: { size?: number; style?: 'normal' | 'bold' | 'italic'; color?: [number, number, number]; indent?: number; gap?: number } = {}) => {
    const { size = 11, style = 'normal', color = [30, 30, 40], indent = 0, gap = 4 } = opts
    pdf.setFont('helvetica', style)
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    const lines = pdf.splitTextToSize(sanitize(text), width - indent) as string[]
    const lineH = size * 1.35
    for (const line of lines) {
      ensureSpace(lineH)
      pdf.text(line, margin + indent, y + size)
      y += lineH
    }
    y += gap
  }

  // Header
  pdf.setFillColor(124, 58, 237)
  pdf.rect(0, 0, pageW, 6, 'F')
  write(docName, { size: 20, style: 'bold', color: [20, 20, 30], gap: 2 })
  write('Questions & Answers', { size: 13, color: [124, 58, 237], gap: 6 })
  write(
    `${set.items.length} questions  ·  ${TYPE_LABEL[set.question_type]}  ·  ${cap(set.difficulty)}  ·  ${new Date(set.created_at).toLocaleDateString()}`,
    { size: 9, color: [110, 110, 125], gap: 10 },
  )
  pdf.setDrawColor(225, 225, 232)
  pdf.line(margin, y, pageW - margin, y)
  y += 18

  // Questions
  set.items.forEach((q, i) => {
    ensureSpace(60) // keep a question's first lines together with its number
    write(`Q${i + 1}. ${q.question}`, { size: 11.5, style: 'bold', gap: 4 })

    if (q.options?.length) {
      q.options.forEach((opt, j) => write(`${'ABCD'[j]})  ${opt}`, { indent: 16, gap: 1 }))
      y += 3
    }

    const answer = q.type === 'mcq' && q.options ? `${'ABCD'[q.options.indexOf(q.answer)] ?? ''}) ${q.answer}` : q.answer
    write(`Answer: ${answer}`, { color: [21, 128, 61], indent: 16, gap: 2 })
    if (q.explanation) write(q.explanation, { style: 'italic', size: 10, color: [90, 90, 105], indent: 16, gap: 2 })
    if (q.page) write(`Source: page ${q.page}`, { size: 8.5, color: [140, 140, 155], indent: 16, gap: 2 })
    y += 12
  })

  // Footer with page numbers
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(150, 150, 160)
    pdf.text(`Generated with DocMind  ·  ${p} / ${pages}`, pageW / 2, pageH - 24, { align: 'center' })
  }

  pdf.save(`${slug(docName)}-qa-${set.items.length}.pdf`)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document'

// jsPDF's built-in fonts only cover Latin characters; replace common symbols they can't draw.
function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●]/g, '-')
    .replace(/ /g, ' ')
}
