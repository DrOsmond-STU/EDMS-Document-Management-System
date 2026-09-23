import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, CircleDashed, Download, Info, XCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, inputClass } from '../components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Status = warna tercadang + ikon + label (tidak pernah warna saja).
const STATUS = {
  ok: { label: 'Sesuai target', bg: '#e3f1ea', text: '#1d6e48', icon: CheckCircle2 },
  warn: { label: 'Perlu perhatian', bg: '#fdf1dc', text: '#9a6412', icon: AlertTriangle },
  bad: { label: 'Di bawah target', bg: '#fbe7e6', text: '#b23b3a', icon: XCircle },
  info: { label: 'Informasi', bg: '#e8f1f9', text: '#0b5fa8', icon: Info },
  na: { label: 'Belum terukur', bg: 'var(--color-neutral-bg)', text: 'var(--color-neutral-medium)', icon: CircleDashed },
}

function formatValue(k) {
  if (k.value === null || k.value === undefined) return '—'
  const v = Number(k.value).toLocaleString('id-ID', { maximumFractionDigits: 1 })
  return k.unit === '%' ? `${v}%` : v
}

function KpiCard({ kpi }) {
  const s = STATUS[kpi.status] ?? STATUS.na
  const Icon = s.icon
  return (
    <Card className="!p-4">
      <div className="text-[12px] font-semibold leading-snug text-[var(--color-neutral-dark)]">{kpi.label}</div>
      <span className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: s.bg, color: s.text }}>
        <Icon size={11} strokeWidth={2.5} /> {s.label}
      </span>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[26px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{formatValue(kpi)}</span>
        {kpi.value !== null && kpi.unit && kpi.unit !== '%' && <span className="text-[12px] text-[var(--color-neutral-medium)]">{kpi.unit}</span>}
      </div>
      {kpi.target && <div className="mt-1 text-[10.5px] text-[var(--color-neutral-medium)]">Target: {kpi.target}</div>}
      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--color-neutral-medium)]">{kpi.description}</p>
    </Card>
  )
}

/** Satu seri per grafik (small multiples) — satu warna, judul menamai seri, tanpa legenda. */
function MiniBars({ title, data, field }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...data.map((d) => d[field]))
  const total = data.reduce((n, d) => n + d[field], 0)
  const H = 120
  return (
    <Card className="!p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">{title}</div>
        <div className="text-[11px] tabular-nums text-[var(--color-neutral-medium)]">Total {total}</div>
      </div>
      <div className="relative">
        <div className="flex items-stretch gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => {
            const h = d[field] === 0 ? 0 : Math.max(3, (d[field] / max) * (H - 18))
            return (
              <div key={d.month} className="relative flex flex-1 cursor-default flex-col justify-end" onMouseEnter={() => setHover(i)}>
                {hover === i && <div className="absolute inset-0 rounded bg-[var(--color-neutral-bg-soft)]" />}
                <div className="relative mx-auto w-[70%] rounded-t-[4px] bg-[var(--color-brand-primary)]" style={{ height: h }} />
              </div>
            )
          })}
        </div>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-md border border-[var(--color-neutral-border)] bg-white px-2 py-1 text-[11px] shadow-md"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
            <div className="font-semibold text-[var(--color-neutral-dark)]">{MONTHS[hover]}</div>
            <div className="tabular-nums text-[var(--color-neutral-medium)]">{data[hover][field]}</div>
          </div>
        )}
        <div className="mt-1 flex gap-[2px] border-t border-[var(--color-neutral-border)] pt-1">
          {data.map((d, i) => <div key={d.month} className="flex-1 text-center text-[9.5px] text-[var(--color-neutral-medium)]">{i % 2 === 0 ? MONTHS[i] : ''}</div>)}
        </div>
      </div>
    </Card>
  )
}

export default function ReportingPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('reporting.view')
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    if (!canView) return
    setData(null)
    api(`reporting/kpi?year=${year}`).then(setData).catch((err) => setError(err?.message || 'Gagal memuat laporan.'))
  }, [canView, year])

  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => thisYear - i), [thisYear])

  if (!canView) return <Layout><div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Anda tidak berwenang melihat Reporting & KPI.</div></Layout>

  const measured = data ? [...data.kpis, ...data.governance].filter((k) => ['ok', 'warn', 'bad'].includes(k.status)) : []
  const onTarget = measured.filter((k) => k.status === 'ok').length

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Operasional</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><BarChart3 size={18} /> Reporting & KPI</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Indikator kinerja pengelolaan dokumen & sistem manajemen, dihitung langsung dari data seluruh modul. KPI yang sumber datanya belum ada ditandai "Belum terukur", bukan diisi angka perkiraan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className={`${inputClass} !w-28`} value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Periode">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <a href={`/api/reporting/kpi.csv?year=${year}`}><Button variant="secondary"><Download size={14} /> Ekspor CSV</Button></a>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {!data ? <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p> : (
        <>
          <Card className="mb-5 !p-4">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Periode</div>
                <div className="text-[14px] font-semibold tabular-nums">{data.period.from} s/d {data.period.to}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">KPI sesuai target</div>
                <div className="text-[14px] font-semibold tabular-nums">{onTarget} dari {measured.length} KPI terukur</div>
              </div>
            </div>
          </Card>

          <h2 className="mb-2 text-[13px] font-bold text-[var(--color-neutral-dark)]">KPI Pengelolaan Dokumen (PRD §9)</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
          </div>

          <h2 className="mb-2 text-[13px] font-bold text-[var(--color-neutral-dark)]">KPI Governance, Risiko & Audit</h2>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.governance.map((k) => <KpiCard key={k.key} kpi={k} />)}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[var(--color-neutral-dark)]">Tren Bulanan {data.year}</h2>
            <button type="button" className="text-[12px] font-semibold text-[var(--color-brand-primary)] hover:underline" onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Tampilkan grafik' : 'Tampilkan tabel'}
            </button>
          </div>
          {showTable ? (
            <Card className="mb-6 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <tr className="border-b border-[var(--color-neutral-border)]"><th className="py-2 pr-3">Bulan</th><th className="py-2 pr-3 text-right">Dokumen berlaku</th><th className="py-2 pr-3 text-right">Temuan diangkat</th><th className="py-2 pr-3 text-right">Rekaman didaftarkan</th></tr>
                </thead>
                <tbody>
                  {data.monthly.map((m) => (
                    <tr key={m.month} className="border-b border-[var(--color-neutral-border)]">
                      <td className="py-1.5 pr-3">{MONTHS[m.month - 1]}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{m.released}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{m.findings}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{m.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
              <MiniBars title="Dokumen berlaku (Released)" data={data.monthly} field="released" />
              <MiniBars title="Temuan diangkat" data={data.monthly} field="findings" />
              <MiniBars title="Rekaman didaftarkan" data={data.monthly} field="records" />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Waktu Siklus per Standar</h2>
              <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Rata-rata hari Draft → Released, dokumen jalur approval pada periode ini</p>
              {data.cycle_by_standard.length === 0 ? <p className="py-4 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada data.</p> : (
                <table className="w-full text-[12.5px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                    <tr className="border-b border-[var(--color-neutral-border)]"><th className="py-2 pr-3">Standar</th><th className="py-2 pr-3 text-right">Dokumen</th><th className="py-2 pr-3 text-right">Rata-rata</th></tr>
                  </thead>
                  <tbody>
                    {data.cycle_by_standard.map((r) => (
                      <tr key={r.standard} className="border-b border-[var(--color-neutral-border)]">
                        <td className="py-1.5 pr-3 font-semibold">{r.standard}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{r.documents}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{Number(r.avg_days).toLocaleString('id-ID')} hari</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Dokumen Paling Sering Diakses</h2>
              <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Jumlah lihat/unduh berkas pada periode ini</p>
              {data.top_documents.length === 0 ? <p className="py-4 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada akses tercatat.</p> : (
                <ol className="space-y-1.5">
                  {data.top_documents.map((d, i) => {
                    const pct = (d.hits / data.top_documents[0].hits) * 100
                    return (
                      <li key={d.code} className="text-[12.5px]">
                        <div className="flex justify-between"><span><span className="mr-1.5 text-[var(--color-neutral-medium)]">{i + 1}.</span><span className="font-mono">{d.code}</span></span><span className="tabular-nums text-[var(--color-neutral-dark)]">{d.hits}</span></div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-[var(--color-neutral-bg)]"><div className="h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${pct}%` }} /></div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Card>
          </div>
        </>
      )}
    </Layout>
  )
}
