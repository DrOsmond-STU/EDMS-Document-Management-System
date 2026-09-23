import { Fragment, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Archive, BookOpen, CalendarClock, ClipboardCheck, ClipboardEdit, FileText, GitBranch, Info, Scale, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Card, inputClass } from '../components/ui'

const TYPE_ICON = {
  document: FileText, record: Archive, risk: AlertTriangle, finding: ClipboardEdit,
  legal: Scale, audit: ClipboardCheck, drafting: GitBranch, clause: ShieldCheck,
}

// Label ramah untuk token status/jenis yang dikirim backend di baris meta hasil.
const TOKEN_LABEL = {
  draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', frozen: 'Dibekukan', revoked: 'Dicabut', obsolete: 'Obsolete', cancelled: 'Dibatalkan',
  active: 'Aktif', inactive: 'Inaktif', destroyed: 'Dimusnahkan', archived_permanent: 'Permanen',
  identified: 'Teridentifikasi', assessed: 'Dinilai', treated: 'Dalam perlakuan', monitored: 'Dipantau', closed: 'Ditutup',
  low: 'rendah', moderate: 'sedang', high: 'tinggi', extreme: 'ekstrem',
  nc_major: 'NC Mayor', nc_minor: 'NC Minor', ofi: 'OFI', observation: 'Observasi', strength: 'Strength',
  open: 'Terbuka', root_cause_analysis: 'Analisis akar masalah', capa_in_progress: 'CAPA berjalan', verification: 'Verifikasi', rejected: 'Ditolak',
  compliant: 'patuh', partial: 'sebagian', non_compliant: 'tidak patuh', not_evaluated: 'belum dievaluasi',
  internal: 'internal', external: 'eksternal', planned: 'Terjadwal', in_progress: 'Berlangsung', completed: 'Selesai',
  requested: 'Permintaan', finalized: 'Menunggu pengesahan', ratified: 'Disahkan',
}
const prettyMeta = (meta) => (meta ?? '').replace(/\b[a-z_]+\b/g, (w) => TOKEN_LABEL[w] ?? w)

/** Sorot kata yang dicari — teks tetap dirender sebagai teks (bukan HTML). */
function Highlight({ text, q }) {
  if (!text || !q) return text ?? null
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text).split(new RegExp(`(${esc})`, 'ig'))
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase()
    ? <mark key={i} className="rounded bg-[#fdf1dc] px-0.5 text-inherit">{p}</mark>
    : <Fragment key={i}>{p}</Fragment>))
}

function SectionList({ title, icon: Icon, items, render, empty }) {
  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--color-neutral-dark)]"><Icon size={14} /> {title}</h2>
      {items.length === 0 ? <p className="py-3 text-[12px] text-[var(--color-neutral-medium)]">{empty}</p> : (
        <ul className="divide-y divide-[var(--color-neutral-border)]">{items.map(render)}</ul>
      )}
    </Card>
  )
}

function Overview({ data }) {
  const docRow = (extra) => (d) => (
    <li key={d.id}>
      <Link to={`/documents/${d.id}`} className="flex items-baseline justify-between gap-2 py-1.5 text-[12.5px] hover:text-[var(--color-brand-primary)]">
        <span className="min-w-0"><span className="font-mono text-[11px] text-[var(--color-brand-primary)]">{d.code}</span> <span className="font-semibold">{d.title}</span></span>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-neutral-medium)]">{extra(d)}</span>
      </Link>
    </li>
  )

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Jelajahi {data.totals.released} Dokumen Berlaku</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Per standar, fungsi, dan jenis — klik untuk membuka Register Dokumen yang sudah terfilter</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Standar</div>
            <div className="flex flex-wrap gap-1.5">
              {data.by_standard.length === 0 ? <span className="text-[12px] text-[var(--color-neutral-medium)]">—</span> : data.by_standard.map((s) => (
                <Link key={s.code} to={`/documents?standard=${encodeURIComponent(s.code)}`} title={s.name}
                  className="rounded-full border border-[var(--color-neutral-border)] px-2.5 py-1 text-[11.5px] font-semibold hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]">
                  {s.code} <span className="text-[var(--color-neutral-medium)]">{s.documents_count}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Fungsi</div>
            <ul className="space-y-0.5">
              {data.by_function.map((f) => (
                <li key={f.id}><Link to={`/documents?function_id=${encodeURIComponent(f.id)}`} className="flex justify-between text-[12.5px] hover:text-[var(--color-brand-primary)]"><span>{f.name}</span><span className="tabular-nums text-[var(--color-neutral-medium)]">{f.count}</span></Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Jenis</div>
            <ul className="space-y-0.5">
              {Object.entries(data.by_type).map(([t, c]) => (
                <li key={t}><Link to={`/documents?type=${encodeURIComponent(t)}`} className="flex justify-between text-[12.5px] hover:text-[var(--color-brand-primary)]"><span>{t}</span><span className="tabular-nums text-[var(--color-neutral-medium)]">{c}</span></Link></li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionList title="Paling Sering Diakses (90 hari)" icon={TrendingUp} items={data.popular} empty="Belum ada akses tercatat." render={docRow((d) => `${d.hits}×`)} />
        <SectionList title="Baru Berlaku" icon={BookOpen} items={data.recent} empty="Belum ada dokumen berlaku." render={docRow((d) => d.effective_date?.slice(0, 10))} />
        <SectionList title="Tinjau Ulang ≤ 60 Hari" icon={CalendarClock} items={data.review_soon} empty="Tidak ada tinjauan dalam 60 hari." render={docRow((d) => d.review_date?.slice(0, 10))} />
      </div>
    </div>
  )
}

export default function KnowledgePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [results, setResults] = useState(null)
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { setInput(q) }, [q])
  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return }
    setResults(undefined)
    api(`search?q=${encodeURIComponent(q.trim())}`).then(setResults).catch((err) => setError(err?.message || 'Pencarian gagal.'))
  }, [q])
  useEffect(() => { api('knowledge/overview').then(setOverview).catch(() => {}) }, [])

  return (
    <Layout>
      <div className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Search & AI</div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Search size={18} /> Knowledge Base & Discovery</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
          Satu pencarian untuk seluruh modul — dokumen, rekaman, risiko, temuan, peraturan, audit, proyek penyusunan, dan klausul standar — sesuai hak akses Anda.
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); navigate(`/knowledge?q=${encodeURIComponent(input.trim())}`) }} className="mb-2 flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-medium)]" />
          <input className={`${inputClass} !py-2.5 !pl-9 text-[14px]`} placeholder="Cari kode, judul, kata kunci, nomor peraturan, lokasi rekaman…" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
        </div>
        <button type="submit" className="rounded-md bg-[var(--color-brand-primary)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--color-brand-primary-dark)]">Cari</button>
      </form>
      <p className="mb-5 flex items-center gap-1.5 text-[11px] text-[var(--color-neutral-medium)]">
        <Info size={12} /> Pencarian mencakup metadata & ringkasan isi. Teks di dalam berkas PDF belum ikut diindeks.
      </p>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {results === undefined && <p className="text-[13px] text-[var(--color-neutral-medium)]">Mencari…</p>}
      {results && (
        results.total === 0 ? (
          <Card><p className="py-8 text-center text-[13px] text-[var(--color-neutral-medium)]">Tidak ada hasil untuk "<b>{results.query}</b>".</p></Card>
        ) : (
          <div className="space-y-4">
            <p className="text-[12px] text-[var(--color-neutral-medium)]">{results.total} hasil untuk "<b className="text-[var(--color-neutral-dark)]">{results.query}</b>"</p>
            {results.groups.map((g) => {
              const Icon = TYPE_ICON[g.type] ?? FileText
              return (
                <Card key={g.type} className="!p-4">
                  <h2 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-[var(--color-neutral-dark)]"><Icon size={14} /> {g.label} <span className="font-normal text-[var(--color-neutral-medium)]">({g.items.length})</span></h2>
                  <ul className="divide-y divide-[var(--color-neutral-border)]">
                    {g.items.map((it, i) => (
                      <li key={`${it.code}-${i}`}>
                        <Link to={it.url} className="block py-2 hover:bg-[var(--color-neutral-bg-soft)]">
                          <div className="text-[13px]">
                            {it.code && <span className="mr-2 font-mono text-[11.5px] text-[var(--color-brand-primary)]"><Highlight text={it.code} q={results.query} /></span>}
                            <span className="font-semibold text-[var(--color-neutral-dark)]"><Highlight text={it.title} q={results.query} /></span>
                          </div>
                          {it.snippet && <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]"><Highlight text={it.snippet} q={results.query} /></p>}
                          <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-soft)]">{prettyMeta(it.meta)}</div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        )
      )}
      {results === null && (overview ? <Overview data={overview} /> : <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>)}
    </Layout>
  )
}
