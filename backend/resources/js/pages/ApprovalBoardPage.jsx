import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock, KanbanSquare } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { Button, Card, ClassificationBadge, StandardChip } from '../components/ui'

const COLUMNS = [
  { key: 'draft', label: 'Draft', hint: 'Perlu didorong ke Review oleh Drafter' },
  { key: 'review', label: 'Review', hint: 'Menunggu ditinjau oleh Reviewer' },
  { key: 'approval', label: 'Approval', hint: 'Menunggu disetujui oleh Approver' },
]

function DocumentCard({ doc, onPush, pushing }) {
  return (
    <Card className="!p-3">
      <Link to={`/documents/${doc.id}`} className="block">
        <div className="font-mono text-[11px] font-semibold text-[var(--color-neutral-medium)]">{doc.code}</div>
        <div className="mt-0.5 text-[13px] font-semibold leading-snug hover:text-[var(--color-brand-primary)] hover:underline">
          {doc.title}
        </div>
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <ClassificationBadge level={doc.classification} />
        {doc.standards?.map((s) => <StandardChip key={s.code} code={s.code} />)}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-neutral-medium)]">
        <span>{doc.org_function?.name ?? '—'} · {doc.owner?.name ?? '—'}</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Clock size={11} />
          {doc.days_pending === 0 ? 'Hari ini' : `${doc.days_pending} hari`}
        </span>
      </div>
      {doc.can_act && (
        <Button
          variant="primary" size="sm" className="mt-2.5 w-full"
          disabled={pushing}
          onClick={() => onPush(doc)}
        >
          Dorong ke {doc.next_status} <ArrowRight size={12} />
        </Button>
      )}
    </Card>
  )
}

export default function ApprovalBoardPage() {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [pushingId, setPushingId] = useState(null)

  const load = useCallback(async () => {
    try {
      const r = await api('approval-board')
      setBoard(r.columns)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat papan approval.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handlePush(doc) {
    if (!confirm(`Dorong "${doc.title}" ke status "${doc.next_status}"?`)) return
    setPushingId(doc.id)
    try {
      await api(`documents/${doc.id}/transition`, { method: 'POST', body: { to_status: doc.next_status } })
      await load()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal memindahkan status.')
    } finally {
      setPushingId(null)
    }
  }

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">{error}</div>
      </Layout>
    )
  }

  const total = board ? Object.values(board).reduce((n, list) => n + list.length, 0) : null

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <KanbanSquare size={18} /> Papan Approval
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          {board ? `${total} dokumen menunggu tindakan` : 'Dokumen yang sedang berjalan di alur Draft → Review → Approval, diurutkan dari yang paling lama menunggu.'}
        </p>
      </div>

      {!board ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--color-neutral-dark)]">{col.label}</h2>
                <span className="rounded-full bg-[var(--color-neutral-bg-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-neutral-medium)]">
                  {board[col.key].length}
                </span>
              </div>
              <p className="mb-2 px-0.5 text-[11px] text-[var(--color-neutral-medium)]">{col.hint}</p>
              <div className="flex flex-col gap-2">
                {board[col.key].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--color-neutral-border)] px-3 py-6 text-center text-[12px] italic text-[var(--color-neutral-soft)]">
                    Tidak ada dokumen.
                  </div>
                ) : (
                  board[col.key].map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} onPush={handlePush} pushing={pushingId === doc.id} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
