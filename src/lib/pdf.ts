// Reads a PDF entirely in the browser with Mozilla's pdf.js.
// Returns the text of every page so we can keep page numbers for citations.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const MAX_PAGES = 60
export const MAX_FILE_MB = 20

export interface PageText {
  page: number
  text: string
}

export async function extractPdfText(file: File, onPage?: (done: number, total: number) => void): Promise<PageText[]> {
  if (file.type && file.type !== 'application/pdf') throw new Error('Please upload a PDF file.')
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`PDF is larger than ${MAX_FILE_MB} MB.`)

  const data = new Uint8Array(await file.arrayBuffer())
  const task = pdfjs.getDocument({ data })
  const pdf = await task.promise

  if (pdf.numPages > MAX_PAGES) {
    throw new Error(`This PDF has ${pdf.numPages} pages. The free version supports up to ${MAX_PAGES}.`)
  }

  const pages: PageText[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      if ('str' in item) {
        text += item.str
        text += item.hasEOL ? '\n' : ' '
      }
    }
    pages.push({ page: i, text: normalize(text) })
    onPage?.(i, pdf.numPages)
  }
  await task.destroy()

  const totalChars = pages.reduce((n, p) => n + p.text.length, 0)
  if (totalChars < 200) {
    throw new Error('No readable text found. This looks like a scanned PDF (images only) — OCR is not supported yet.')
  }
  return pages
}

function normalize(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2') // join hyphenated line breaks
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
