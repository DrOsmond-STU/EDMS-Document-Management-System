import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button } from '../components/ui'
import { ClassificationBadge } from '../components/Badges'
import { DOCUMENT_STATUS_ORDER, STATUS_COLOR, STATUS_LABEL } from '../constants'
import { canTransition } from '../state/permissions'
import type { DocumentStatus } from '../types'

export function ApprovalBoard() {
  const { state, transitionDocument } = useApp()
  const { documents, currentRoleId } = state

  function handleAdvance(documentId: string, title: string, from: DocumentStatus, to: DocumentStatus) {
    const label = to === 'obsolete' ? 'menyatakan dokumen Obsolete' : `memindahkan ke ${STATUS_LABEL[to]}`
    if (!window.confirm(`Konfirmasi ${label} untuk "${title}"?`)) return
    transitionDocument(documentId, to)
    void from
  }

  return (
    <div>
      <PageHeader title="Papan Approval" subtitle="Alur Draft → Review → Approval → Released → Obsolete" />

      <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
        {DOCUMENT_STATUS_ORDER.map((status, idx) => {
          const docsInColumn = documents.filter((d) => d.status === status)
          const nextStatus = DOCUMENT_STATUS_ORDER[idx + 1]
          const canAdvance = nextStatus && canTransition([currentRoleId], status)
          const color = STATUS_COLOR[status]

          return (
            <div key={status} className="flex min-w-[220px] flex-col rounded-lg bg-[var(--color-neutral-bg)] p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold" style={{ color: color.text }}>{STATUS_LABEL[status]}</span>
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-neutral-medium)]">
                  {docsInColumn.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {docsInColumn.map((d) => (
                  <Card key={d.id} className="!p-2.5">
                    <Link to={`/documents/${d.id}`} className="mb-1.5 block text-[12.5px] font-semibold leading-snug hover:text-[var(--color-brand-primary)]">
                      {d.title}
                    </Link>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[var(--color-neutral-medium)]">{d.code}</span>
                      <ClassificationBadge level={d.classification} />
                    </div>
                    {nextStatus && (
                      <Button
                        variant={nextStatus === 'obsolete' ? 'danger' : 'ghost'}
                        disabled={!canAdvance}
                        onClick={() => handleAdvance(d.id, d.title, status, nextStatus)}
                        className="w-full !justify-center !py-1 text-[11px]"
                      >
                        {STATUS_LABEL[nextStatus]} <ArrowRight size={11} />
                      </Button>
                    )}
                  </Card>
                ))}
                {docsInColumn.length === 0 && (
                  <p className="px-1 py-4 text-center text-[11px] text-[var(--color-neutral-medium)]">Kosong</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
