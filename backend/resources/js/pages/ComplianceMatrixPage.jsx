import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Layers, ShieldCheck, XCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { Card, ClassificationBadge, StatusBadge, inputClass } from '../components/ui'

// Gaya kartu statistik & legenda mengikuti purwarupa lama (halaman Compliance
// Matrix di dms.semestateknologiutama.com) — kotak ikon berwarna bulat,
// angka besar, label kecil di bawahnya. Warna dan makna Compliant/Partial/Gap
// diturunkan dari data NYATA yang sudah ada (Standard × Document released),
// bukan level klausul seperti purwarupa (itu perlu master data klausul per
// standar yang belum ada di sistem ini — lihat catatan keputusan produk).
const STATE_META = {
  compliant: { label: 'Compliant', bg: '#e3f1ea', text: '#1d6e48', icon: CheckCircle2 },
  partial: { label: 'Partial', bg: '#fdf1dc', text: '#b9791c', icon: AlertTriangle },
  gap: { label: 'Gap', bg: '#fbe7e6', text: '#b23b3a', icon: XCircle },
}

function standardState(row) {
  if (row.released_count > 0) return 'compliant'
  if (row.documents_count > 0) return 'partial'
  return 'gap'
}

function StatCard({ icon: Icon, value, label, bg, text }) {
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: bg, color: text }}>
          <Icon size={17} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{value}</div>
          <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
        </div>
      </div>
    </Card>
  )
}

function DocumentRow({ doc, state }) {
  const meta = STATE_META[state]
  const Icon = meta.icon
  return (
    <Link
      to={`/documents/${doc.id}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-neutral-border)] px-2.5 py-1.5 text-[12.5px] hover:bg-[var(--color-neutral-bg)]"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon size={13} style={{ color: meta.text }} className="shrink-0" />
        <span className="font-mono text-[11px] font-semibold text-[var(--color-neutral-medium)]">{doc.code}</span>
        <span className="truncate font-medium">{doc.title}</span>
        <span className="hidden shrink-0 text-[11px] text-[var(--color-neutral-medium)] sm:inline">— {doc.org_function?.name ?? '—'}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ClassificationBadge level={doc.classification} />
        <StatusBadge status={doc.status} />
      </div>
    </Link>
  )
}

function StandardCard({ row }) {
  const state = standardState(row)
  const meta = STATE_META[state]
  const borderClass = state === 'gap' ? '!border-[#f3c9c8]' : state === 'partial' ? '!border-[#f4dfae]' : undefined

  return (
    <Card className={borderClass}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[12px] font-bold text-[var(--color-neutral-medium)]">{row.code}</div>
          <h2 className="text-[14px] font-bold text-[var(--color-neutral-dark)]">{row.name}</h2>
        </div>
        <span
          className="flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: meta.bg, color: meta.text }}
        >
          <meta.icon size={12} />
          {state === 'compliant' ? `${row.released_count} dokumen released` : state === 'partial' ? 'Belum ada yang released' : 'Belum ada dokumen'}
        </span>
      </div>

      {row.documents.length === 0 ? (
        <p className="mt-3 text-[12px] italic text-[var(--color-neutral-soft)]">Belum ada dokumen yang ditandai memenuhi standar ini.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {row.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} state={doc.status === 'released' ? 'compliant' : 'partial'} />
          ))}
        </div>
      )}
    </Card>
  )
}

export default function ComplianceMatrixPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [standardFilter, setStandardFilter] = useState('')

  useEffect(() => {
    api('compliance-matrix')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat Compliance Matrix.'))
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const s = { total: data.standards.length, compliant: 0, partial: 0, gap: 0 }
    data.standards.forEach((row) => { s[standardState(row)]++ })
    return s
  }, [data])

  const visibleStandards = useMemo(() => {
    if (!data) return []
    if (!standardFilter) return data.standards
    return data.standards.filter((row) => row.code === standardFilter)
  }, [data, standardFilter])

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">{error}</div>
      </Layout>
    )
  }

  if (!data || !stats) {
    return (
      <Layout>
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Governance</div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <ShieldCheck size={18} /> Compliance Matrix
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          Peta pemenuhan standar acuan terhadap dokumen internal — hanya dokumen released yang dihitung sebagai bukti kepatuhan berlaku.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Layers} value={stats.total} label="Total Standar" bg="var(--color-neutral-bg)" text="var(--color-neutral-medium)" />
        <StatCard icon={CheckCircle2} value={stats.compliant} label="Compliant" bg={STATE_META.compliant.bg} text={STATE_META.compliant.text} />
        <StatCard icon={AlertTriangle} value={stats.partial} label="Partial" bg={STATE_META.partial.bg} text={STATE_META.partial.text} />
        <StatCard icon={XCircle} value={stats.gap} label="Gap" bg={STATE_META.gap.bg} text={STATE_META.gap.text} />
      </div>

      <Card className="mb-4 !p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-[var(--color-neutral-medium)]">
            Menampilkan {visibleStandards.length} dari {stats.total} standar
          </p>
          <select className={`${inputClass} w-56`} value={standardFilter} onChange={(e) => setStandardFilter(e.target.value)}>
            <option value="">Semua Standar</option>
            {data.standards.map((row) => <option key={row.code} value={row.code}>{row.code}</option>)}
          </select>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {visibleStandards.map((row) => <StandardCard key={row.code} row={row} />)}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11px] text-[var(--color-neutral-medium)]">
        {Object.entries(STATE_META).map(([key, meta]) => (
          <span key={key} className="flex items-center gap-1">
            <meta.icon size={13} style={{ color: meta.text }} /> {meta.label}
          </span>
        ))}
      </div>
    </Layout>
  )
}
