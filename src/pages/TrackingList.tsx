import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, EmptyState } from '../components/ui'
import { DRAFTING_STAGE_LABEL } from '../constants'
import { DRAFTING_STAGE_ORDER } from '../types'

export function TrackingList() {
  const { state } = useApp()
  const { draftingProjects, functions } = state

  function funcName(id: string) {
    return functions.find((f) => f.id === id)?.name ?? id
  }

  return (
    <div>
      <PageHeader
        title="Tracking Penyusunan Dokumen"
        subtitle="8 tahap: Permintaan → Undangan Rapat → Rapat → Bukti Notulen → Daftar Hadir & TTD → Finalisasi → Pengesahan → Register Utama"
        actions={
          <Link to="/tracking/new">
            <Button variant="primary"><Plus size={14} /> Permintaan Baru</Button>
          </Link>
        }
      />

      {draftingProjects.length === 0 ? (
        <EmptyState title="Belum ada permintaan penyusunan dokumen" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {draftingProjects.map((p) => {
            const stageIdx = DRAFTING_STAGE_ORDER.indexOf(p.currentStage)
            const progress = ((stageIdx + 1) / DRAFTING_STAGE_ORDER.length) * 100
            const done = p.currentStage === 'register_utama'
            return (
              <Link key={p.id} to={`/tracking/${p.id}`}>
                <Card className="h-full hover:border-[var(--color-brand-primary)]">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug">{p.documentTitle}</h3>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--color-neutral-medium)]">{p.requestNumber}</span>
                  </div>
                  <p className="mb-3 text-xs text-[var(--color-neutral-medium)]">{funcName(p.functionId)} · {p.requester}</p>
                  <div className="mb-1.5 h-1.5 w-full rounded-full bg-[var(--color-neutral-bg)]">
                    <div
                      className={`h-1.5 rounded-full ${done ? 'bg-[var(--color-brand-success-text)]' : 'bg-[var(--color-brand-primary)]'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-medium text-[var(--color-neutral-medium)]">
                    Tahap {stageIdx + 1}/8 — {DRAFTING_STAGE_LABEL[p.currentStage]}
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
