import { useRef, useState, type DragEvent } from 'react'
import { CheckCircle2, UploadCloud } from 'lucide-react'
import { uploadDocument, type UploadProgress } from '../lib/api'
import { MAX_FILE_MB, MAX_PAGES } from '../lib/pdf'
import type { DocumentRow } from '../types'

const STAGE_LABEL: Record<UploadProgress['stage'], string> = {
  reading: 'Reading PDF',
  chunking: 'Splitting into chunks',
  embedding: 'Creating embeddings',
  done: 'Done',
}

export function UploadDropzone({ onUploaded }: { onUploaded: (doc: DocumentRow) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = progress !== null && progress.stage !== 'done'

  async function handleFile(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    setFileName(file.name)
    setProgress({ stage: 'reading', done: 0, total: 1 })
    try {
      const doc = await uploadDocument(file, setProgress)
      onUploaded(doc)
      setTimeout(() => {
        setProgress(null)
        setFileName(null)
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setProgress(null)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const pct = progress ? Math.round((progress.done / Math.max(progress.total, 1)) * 100) : 0

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? 'border-brand-400 bg-brand-500/10' : 'border-white/15 bg-white/[0.02] hover:border-brand-500/60 hover:bg-white/[0.04]'
        } ${busy ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {progress ? (
          <div className="w-full max-w-sm">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-white">
              {progress.stage === 'done' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : null}
              <span className="truncate">{fileName}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-400 transition-all duration-300"
                style={{ width: `${progress.stage === 'chunking' ? 100 : pct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {STAGE_LABEL[progress.stage]}
              {progress.stage === 'reading' && progress.total > 1 && ` · page ${progress.done}/${progress.total}`}
              {progress.stage === 'embedding' && ` · ${progress.done}/${progress.total} chunks`}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-accent-400/20 ring-1 ring-white/10 transition group-hover:scale-105">
              <UploadCloud className="h-7 w-7 text-brand-300" />
            </div>
            <p className="font-semibold text-white">Drop a PDF here or click to upload</p>
            <p className="mt-1 text-xs text-slate-500">
              Up to {MAX_PAGES} pages · {MAX_FILE_MB} MB · text-based PDFs
            </p>
          </>
        )}
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</p>}
    </div>
  )
}
