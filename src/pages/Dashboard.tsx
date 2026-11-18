import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Trash2 } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { UploadDropzone } from '../components/UploadDropzone'
import { Spinner } from '../components/Spinner'
import { deleteDocument, listDocuments } from '../lib/api'
import type { DocumentRow } from '../types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e.message))
  }, [])

  async function remove(doc: DocumentRow) {
    if (!confirm(`Delete "${doc.name}" and all its questions?`)) return
    await deleteDocument(doc.id)
    setDocs((d) => d?.filter((x) => x.id !== doc.id) ?? null)
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-white">Your documents</h1>
        <p className="mt-1 text-slate-400">Upload a PDF to chat with it or generate questions.</p>

        <div className="mt-8">
          <UploadDropzone onUploaded={(doc) => navigate(`/app/doc/${doc.id}`)} />
        </div>

        <section className="mt-10">
          {error && <p className="text-sm text-red-300">{error}</p>}
          {docs === null && !error ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : docs && docs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No documents yet — your uploads will appear here.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {docs?.map((doc) => (
                <li key={doc.id} className="card group flex items-center gap-4 p-4 transition hover:border-brand-500/40">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/15">
                    <FileText className="h-5 w-5 text-brand-300" />
                  </div>
                  <Link to={`/app/doc/${doc.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{doc.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {doc.page_count} pages · {new Date(doc.created_at).toLocaleDateString()}
                      {doc.status !== 'ready' && (
                        <span className={doc.status === 'failed' ? 'ml-2 text-red-400' : 'ml-2 text-amber-300'}>· {doc.status}</span>
                      )}
                    </p>
                  </Link>
                  <button
                    onClick={() => remove(doc)}
                    className="rounded-lg p-2 text-slate-500 opacity-60 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
