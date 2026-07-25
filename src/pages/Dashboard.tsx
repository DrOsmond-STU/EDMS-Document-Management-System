import { Link } from 'react-router-dom'
import { FileText, GitPullRequestArrow, AlertTriangle, Users } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card } from '../components/ui'
import { StatusBadge } from '../components/Badges'
import { DOCUMENT_STATUS_ORDER, STATUS_LABEL } from '../constants'
import type { DocumentStatus } from '../types'

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent: string }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: accent + '1a', color: accent }}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold leading-tight">{value}</div>
        <div className="text-[12px] text-[var(--color-neutral-medium)]">{label}</div>
      </div>
    </Card>
  )
}

export function Dashboard() {
  const { state } = useApp()
  const { documents, draftingProjects, functions, auditLog } = state

  const byStatus = DOCUMENT_STATUS_ORDER.reduce<Record<DocumentStatus, number>>((acc, s) => {
    acc[s] = documents.filter((d) => d.status === s).length
    return acc
  }, {} as Record<DocumentStatus, number>)

  const byFunction = functions
    .map((f) => ({ ...f, count: documents.filter((d) => d.functionId === f.id).length }))
    .sort((a, b) => b.count - a.count)

  const today = new Date().toISOString().slice(0, 10)
  const expiringSoon = documents
    .filter((d) => d.status === 'released' && d.reviewDate && d.reviewDate >= today)
    .sort((a, b) => (a.reviewDate! < b.reviewDate! ? -1 : 1))
    .slice(0, 5)

  const activeDrafting = draftingProjects.filter((p) => p.currentStage !== 'register_utama')
  const maxByFunction = Math.max(1, ...byFunction.map((f) => f.count))

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan dokumen lintas fungsi, standar, dan aktivitas terbaru" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<FileText size={18} />} label="Total Dokumen" value={documents.length} accent="#378add" />
        <StatCard icon={<GitPullRequestArrow size={18} />} label="Penyusunan Berjalan" value={activeDrafting.length} accent="#0e7c86" />
        <StatCard icon={<AlertTriangle size={18} />} label="Mendekati Review" value={expiringSoon.length} accent="#ef9f27" />
        <StatCard icon={<Users size={18} />} label="Pengguna Aktif" value={state.users.filter((u) => u.active).length} accent="#7f77df" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-bold">Dokumen per Status</h2>
          <div className="flex flex-col gap-2.5">
            {DOCUMENT_STATUS_ORDER.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <StatusBadge status={s} />
                <span className="text-sm font-semibold">{byStatus[s]}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold">Dokumen per Fungsi</h2>
          <div className="flex flex-col gap-2">
            {byFunction.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <span className="w-40 shrink-0 truncate text-xs text-[var(--color-neutral-medium)]">{f.name}</span>
                <div className="h-2 flex-1 rounded-full bg-[var(--color-neutral-bg)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-brand-primary)]"
                    style={{ width: `${(f.count / maxByFunction) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs font-semibold">{f.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Aktivitas Terbaru</h2>
            <Link to="/audit-trail" className="text-xs font-medium text-[var(--color-brand-primary)] hover:underline">
              Lihat semua
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {auditLog.slice(0, 6).map((a) => (
              <div key={a.id} className="text-xs">
                <span className="font-semibold">{a.actor}</span>{' '}
                <span className="text-[var(--color-neutral-medium)]">{a.detail}</span>
                <div className="text-[10px] text-[var(--color-neutral-medium)]">{a.timestamp}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Dokumen Mendekati Review</h2>
            <Link to="/documents" className="text-xs font-medium text-[var(--color-brand-primary)] hover:underline">
              Lihat register
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
            {expiringSoon.map((d) => (
              <Link key={d.id} to={`/documents/${d.id}`} className="flex items-center justify-between py-2 text-xs hover:text-[var(--color-brand-primary)]">
                <span className="truncate">{d.title}</span>
                <span className="shrink-0 text-[var(--color-neutral-medium)]">{d.reviewDate}</span>
              </Link>
            ))}
            {expiringSoon.length === 0 && <p className="py-2 text-xs text-[var(--color-neutral-medium)]">Tidak ada dokumen mendekati review.</p>}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-[11px] text-[var(--color-neutral-medium)]">
        Status: {DOCUMENT_STATUS_ORDER.map((s) => STATUS_LABEL[s]).join(' → ')}
      </p>
    </div>
  )
}
