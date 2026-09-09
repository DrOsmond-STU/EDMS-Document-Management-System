import { useEffect, useState } from 'react'
import {
  AlertTriangle, CalendarClock, CheckCircle2, ClipboardList,
  FileText, LayoutDashboard, ListChecks, TrendingUp, UserCheck, Users,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { ActionBadge, Card } from '../components/ui'

// Warna & label mengikuti palet yang sama dipakai di seluruh aplikasi
// (lihat components/ui.jsx STATUS_COLOR / DocumentsPage.jsx) — diduplikasi
// di sini secara sengaja, sama seperti pola yang sudah dipakai halaman lain,
// karena grafik ini butuh warna mentah (bukan komponen badge siap pakai).
const STATUS_COLOR = {
  draft: '#94A3B8', review: '#D9A441', approval: '#D4801F', released: '#1E8E5A',
  obsolete: '#B23B3A', frozen: '#0369A1', revoked: '#7F1D1D', cancelled: '#7A828C',
}
const STATUS_LABEL = {
  draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', obsolete: 'Obsolete',
  frozen: 'Dibekukan', revoked: 'Dicabut', cancelled: 'Dibatalkan',
}
const CLASSIFICATION_COLOR = {
  public: '#7fa88f', internal: '#5f8fb4', restricted: '#c98a3e',
  confidential: '#b9563f', secret: '#7a3b3b', top_secret: '#1f2937',
}
const CLASSIFICATION_LABEL = {
  public: 'Public', internal: 'Internal', restricted: 'Restricted',
  confidential: 'Confidential', secret: 'Secret', top_secret: 'Top Secret',
}
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function KpiCard({ icon: Icon, label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-[var(--color-neutral-dark)]',
    warn: 'text-[#B9791C]',
    danger: 'text-[#B23B3A]',
    good: 'text-[#1E8E5A]',
  }[tone]

  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
        <Icon size={12} /> {label}
      </div>
      <div className={`mt-1.5 text-[22px] font-bold leading-none ${toneClass}`}>{value}</div>
    </Card>
  )
}

function BarRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[var(--color-neutral-dark)]">{label}</span>
        <span className="font-semibold text-[var(--color-neutral-medium)]">{count}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-bg-soft)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-[var(--color-neutral-dark)]">
        <Icon size={14} /> {title}
      </h2>
      {children}
    </Card>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat dashboard.'))
  }, [])

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">{error}</div>
      </Layout>
    )
  }

  if (!data) {
    return (
      <Layout>
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      </Layout>
    )
  }

  const statusTotal = data.status_breakdown.reduce((n, s) => n + s.count, 0)
  const classificationTotal = data.classification_breakdown.reduce((n, c) => n + c.count, 0)
  const typeTotal = data.type_breakdown.reduce((n, t) => n + t.count, 0)
  const trendMax = data.monthly_trend ? Math.max(1, ...data.monthly_trend.map((m) => m.count)) : 1

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <LayoutDashboard size={18} /> Dashboard
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          Ringkasan status dokumen, tindakan yang menunggu, dan aktivitas terbaru.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={FileText} label="Total Dokumen" value={data.totals.documents} />
        <KpiCard icon={CheckCircle2} label="Released" value={data.totals.released} tone="good" />
        <KpiCard icon={ClipboardList} label="Menunggu Proses" value={data.totals.pending} />
        <KpiCard icon={UserCheck} label="Perlu Tindakan Saya" value={data.totals.my_actionable} tone={data.totals.my_actionable > 0 ? 'warn' : 'neutral'} />
        <KpiCard icon={AlertTriangle} label="Tinjauan Lewat Tempo" value={data.totals.overdue_review} tone={data.totals.overdue_review > 0 ? 'danger' : 'neutral'} />
        <KpiCard icon={CalendarClock} label="Tinjauan ≤30 Hari" value={data.totals.upcoming_review} tone={data.totals.upcoming_review > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard icon={FileText} title="Dokumen per Status">
          <div className="flex flex-col gap-2.5">
            {data.status_breakdown.map((s) => (
              <BarRow key={s.key} label={STATUS_LABEL[s.key] ?? s.key} count={s.count} total={statusTotal} color={STATUS_COLOR[s.key] ?? '#94A3B8'} />
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={ListChecks} title="Dokumen per Klasifikasi">
          <div className="flex flex-col gap-2.5">
            {data.classification_breakdown.map((c) => (
              <BarRow key={c.key} label={CLASSIFICATION_LABEL[c.key] ?? c.key} count={c.count} total={classificationTotal} color={CLASSIFICATION_COLOR[c.key] ?? '#5f8fb4'} />
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={ClipboardList} title="Dokumen per Jenis">
          <div className="flex flex-col gap-2.5">
            {data.type_breakdown.map((t) => (
              <BarRow key={t.key} label={t.key} count={t.count} total={typeTotal} color="#5f8fb4" />
            ))}
          </div>
        </SectionCard>

        {data.monthly_trend && (
          <SectionCard icon={TrendingUp} title="Tren Dokumen Dibuat (6 Bulan Terakhir)">
            <div className="flex h-32 gap-2.5">
              {data.monthly_trend.map((m) => {
                const [, mm] = m.month.split('-')
                const heightPct = Math.round((m.count / trendMax) * 100)
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--color-neutral-dark)]">{m.count}</span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-[var(--color-brand-primary)]"
                        style={{ height: `${Math.max(heightPct, m.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[10.5px] text-[var(--color-neutral-medium)]">{MONTH_LABEL[parseInt(mm, 10) - 1]}</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {data.recent_activity && (
          <SectionCard icon={ClipboardList} title="Aktivitas Audit Terbaru">
            {data.recent_activity.length === 0 ? (
              <p className="text-[12px] italic text-[var(--color-neutral-soft)]">Belum ada aktivitas.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.recent_activity.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-2 border-b border-[var(--color-neutral-border)] pb-2 text-[12px] last:border-b-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-neutral-dark)]">{log.actor_name}</div>
                      <div className="truncate text-[11px] text-[var(--color-neutral-medium)]">{log.entity_label ?? log.entity}</div>
                    </div>
                    <ActionBadge action={log.action} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {data.users && (
          <SectionCard icon={Users} title="Pengguna">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[22px] font-bold leading-none text-[#1E8E5A]">{data.users.active}</div>
                <div className="mt-1 text-[11px] text-[var(--color-neutral-medium)]">Aktif</div>
              </div>
              <div>
                <div className="text-[22px] font-bold leading-none text-[var(--color-neutral-soft)]">{data.users.inactive}</div>
                <div className="mt-1 text-[11px] text-[var(--color-neutral-medium)]">Nonaktif</div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </Layout>
  )
}
