import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileText, ListChecks, MessagesSquare } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { ChatPanel } from '../components/ChatPanel'
import { QAPanel } from '../components/QAPanel'
import { Spinner } from '../components/Spinner'
import { getDocument } from '../lib/api'
import type { DocumentRow } from '../types'

type Tab = 'chat' | 'qa'

export default function DocumentPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'qa' ? 'qa' : 'chat'
  const [doc, setDoc] = useState<DocumentRow | null | undefined>(undefined)

  useEffect(() => {
    if (id) getDocument(id).then(setDoc).catch(() => setDoc(null))
  }, [id])

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {doc === undefined ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-6 w-6" />
          </div>
        ) : doc === null ? (
          <div className="py-20 text-center">
            <p className="text-slate-400">Document not found.</p>
            <Link to="/app" className="btn-ghost mt-4">
              Back to documents
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link to="/app" className="btn-ghost h-10 w-10 p-0" title="Back">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/15">
                  <FileText className="h-5 w-5 text-brand-300" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-white">{doc.name}</h1>
                  <p className="text-xs text-slate-500">
                    {doc.page_count} pages · {doc.word_count.toLocaleString()} words · {doc.chunk_count} chunks
                  </p>
                </div>
              </div>

              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                <TabButton active={tab === 'chat'} onClick={() => setParams({})} icon={<MessagesSquare className="h-4 w-4" />}>
                  Chat
                </TabButton>
                <TabButton active={tab === 'qa'} onClick={() => setParams({ tab: 'qa' })} icon={<ListChecks className="h-4 w-4" />}>
                  Generate Q&A
                </TabButton>
              </div>
            </div>

            {doc.status !== 'ready' ? (
              <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                This document {doc.status === 'failed' ? 'failed to process. Delete it and upload again.' : 'is still processing.'}
              </p>
            ) : tab === 'chat' ? (
              <ChatPanel key={doc.id} doc={doc} />
            ) : (
              <QAPanel key={doc.id} doc={doc} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'text-slate-400 hover:text-white'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
