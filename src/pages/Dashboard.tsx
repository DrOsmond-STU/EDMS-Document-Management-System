import { Link } from 'react-router-dom'
import {
  FileText,
  GitPullRequestArrow,
  AlertTriangle,
  Users,
  ArrowUpRight,
  Activity,
  Calendar,
} from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, SectionTitle } from '../components/ui'
import { StatusBadge } from '../components/Badges'
import { DOCUMENT_STATUS_ORDER, STATUS_LABEL } from '../constants'
import type { DocumentStatus } from '../types'

function StatCard({
  icon,
  label,
  value,
  accent,
  hint,
  to,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  accent: string
  hint?: string
  to?: string
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: accent + '18', color: accent }}
        >
          {icon}
        </div>
        {to && (
          <ArrowUpRight
            size={15}
            className="text-[var(--color-neutral-soft)] transition-colors group-hover:text-[var(--color-brand-primary)]"
          />
        )}
      </div>
      <div>
        <div className="text-[26px] font-bold leading-none tracking-tight text-[var(--color-neutral-dark)]">
          {value}
        </div>
        <div className="mt-1.5 text-[12px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
        {hint && (
          <div className="mt-2 text-[11px] leading-snug text-[var(--color-neutral-soft)]">{hint}</div>
        )}
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="group block h-full">
        <Card interactive className="h-full">
          {inner}
        </Card>
      </Link>
    )
  }
  return <Card className="h-full">{inner}</Card>
}

export function Dashboard() {
  const { state, currentUser } = useApp()
  const { documents, draftingProjects, functions, auditLog } = state

  const byStatus = DOCUMENT_STATUS_ORDER.reduce<Record<DocumentStatus, number>>((acc, s) => {
    acc[s] = documents.filter((d) => d.status === s).length
    return acc
  }, {} as Record<DocumentStatus, number>)

  const totalDocs = documents.length

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

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 11) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'
    return 'Selamat malam'
  })()

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title={`${greeting}, ${currentUser.name.split(' ')[0]} 👋`}
        subtitle="Ringkasan dokumen lintas fungsi, standar, dan aktivitas terbaru di seluruh organisasi."
      />

      {/* Stat grid */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText size={18} />}
          label="Total Dokumen"
          value={totalDocs}
          accent="#0b5fa8"
          hint={`${byStatus.released} sudah dirilis`}
          to="/documents"
        />
        <StatCard
          icon={<GitPullRequestArrow size={18} />}
          label="Penyusunan Berjalan"
          value={activeDrafting.length}
          accent="#0891a8"
          hint={`${draftingProjects.length - activeDrafting.length} sudah masuk register`}
          to="/tracking"
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Mendekati Review"
          value={expiringSoon.length}
          accent="#f2a93b"
          hint={expiringSoon.length ? 'Perlu peninjauan berkala' : 'Tidak ada yang mendekat'}
          to="/documents"
        />
        <StatCard
          icon={<Users size={18} />}
          label="Pengguna Aktif"
          value={state.users.filter((u) => u.active).length}
          accent="#6c63c7"
          hint={`${state.users.length} total pengguna terdaftar`}
          to="/users"
        />
      </div>

      {/* Middle row */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Status donut-ish list */}
        <Card className="lg:col-span-1">
          <SectionTitle hint="Distribusi lifecycle">Dokumen per Status</SectionTitle>

          {/* Segmented progress bar */}
          <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-bg)]">
            {DOCUMENT_STATUS_ORDER.map((s) => {
              const pct = totalDocs === 0 ? 0 : (byStatus[s] / totalDocs) * 100
              if (pct === 0) return null
              const colors: Record<DocumentStatus, string> = {
                draft: '#94a3b8',
                review: '#f2a93b',
                approval: '#c98a3e',
                released: '#1e8e5a',
                obsolete: '#d93b3b',
              }
              return (
                <div
                  key={s}
                  style={{ width: `${pct}%`, backgroundColor: colors[s] }}
                  title={`${STATUS_LABEL[s]}: ${byStatus[s]}`}
                />
              )
            })}
          </div>

          <div className="flex flex-col gap-2.5">
            {DOCUMENT_STATUS_ORDER.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <StatusBadge status={s} />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold tabular-nums text-[var(--color-neutral-dark)]">
                    {byStatus[s]}
                  </span>
                  <span className="text-[10.5px] font-medium text-[var(--color-neutral-soft)]">
                    {totalDocs === 0 ? '0%' : `${Math.round((byStatus[s] / totalDocs) * 100)}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Function bar chart */}
        <Card className="lg:col-span-2">
          <SectionTitle hint="Volume dokumen per unit organisasi">Dokumen per Fungsi</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {byFunction.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[12px] font-medium text-[var(--color-neutral-medium)]">
                  {f.name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-neutral-bg)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-teal)] transition-all"
                    style={{ width: `${(f.count / maxByFunction) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[12px] font-bold tabular-nums text-[var(--color-neutral-dark)]">
                  {f.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            action={
              <Link
                to="/audit-trail"
                className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-[var(--color-brand-primary)] hover:underline"
              >
                Lihat semua <ArrowUpRight size={12} />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Activity size={14} className="text-[var(--color-brand-primary)]" /> Aktivitas Terbaru
            </span>
          </SectionTitle>
          <div className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
            {auditLog.slice(0, 6).map((a) => (
              <div key={a.id} className="flex gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[10px] font-bold text-[var(--color-brand-primary-dark)]">
                  {a.actor.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] leading-snug">
                    <span className="font-semibold text-[var(--color-neutral-dark)]">{a.actor}</span>{' '}
                    <span className="text-[var(--color-neutral-medium)]">{a.detail}</span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-soft)]">
                    {a.timestamp}
                  </div>
                </div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <p className="py-4 text-xs text-[var(--color-neutral-soft)]">Belum ada aktivitas.</p>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle
            action={
              <Link
                to="/documents"
                className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-[var(--color-brand-primary)] hover:underline"
              >
                Lihat register <ArrowUpRight size={12} />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} className="text-[var(--color-brand-warning)]" /> Dokumen Mendekati Review
            </span>
          </SectionTitle>
          <div className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
            {expiringSoon.map((d) => (
              <Link
                key={d.id}
                to={`/documents/${d.id}`}
                className="group flex items-center justify-between gap-3 py-2.5 text-[12.5px] first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--color-neutral-dark)] group-hover:text-[var(--color-brand-primary)]">
                    {d.title}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-soft)]">
                    {d.code ?? '—'}
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-[var(--color-neutral-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-neutral-medium)]">
                  {d.reviewDate}
                </span>
              </Link>
            ))}
            {expiringSoon.length === 0 && (
              <p className="py-4 text-xs text-[var(--color-neutral-soft)]">
                Tidak ada dokumen mendekati review.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Lifecycle legend */}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--color-neutral-border-strong)] bg-[var(--color-neutral-bg-soft)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">
          <span className="font-bold uppercase tracking-wide text-[var(--color-neutral-dark)]">
            Alur status:
          </span>
          {DOCUMENT_STATUS_ORDER.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <StatusBadge status={s} />
              {i < DOCUMENT_STATUS_ORDER.length - 1 && (
                <span className="text-[var(--color-neutral-soft)]">→</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
