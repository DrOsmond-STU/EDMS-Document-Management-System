import { useMemo, useState } from 'react'
import { Clock, FileText, Filter, Search, Sparkles, TrendingUp } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, SectionTitle, inputClass } from '../components/ui'

type ResultType = 'sop' | 'ik' | 'formulir' | 'kebijakan' | 'manual' | 'rekaman'

type SearchResult = {
  id: string
  code: string
  title: string
  type: ResultType
  category: string
  updated: string
  tags: string[]
  snippet: string
  breadcrumb: string
  score: number
}

const RESULTS: SearchResult[] = [
  { id: 's1', code: 'SOP-OP-011', title: 'Prosedur Penanganan Produk Tidak Sesuai (NCP)', type: 'sop', category: 'Operasional', updated: '2026-07-02', tags: ['ISO 9001', 'Kualitas'], breadcrumb: 'Prosedur > SOP Operasional > Kualitas', score: 0.97, snippet: '…Setiap <mark>produk tidak sesuai</mark> harus diberi tanda identifikasi jelas dan disimpan di area karantina. Petugas QC wajib membuat laporan…' },
  { id: 's2', code: 'SOP-HSE-001', title: 'Prosedur Investigasi Kecelakaan Kerja', type: 'sop', category: 'K3', updated: '2026-06-08', tags: ['ISO 45001', 'SMK3'], breadcrumb: 'Prosedur > SOP K3L > Insiden', score: 0.94, snippet: '…Investigasi <mark>kecelakaan kerja</mark> menggunakan metode 5-Why dan fishbone. Root cause harus teridentifikasi dalam 3×24 jam sejak insiden…' },
  { id: 's3', code: 'IK-LAB-002', title: 'IK Uji Kadar Air Metode Oven', type: 'ik', category: 'Laboratorium', updated: '2026-06-12', tags: ['ISO 17025'], breadcrumb: 'Instruksi Kerja > IK Laboratorium', score: 0.91, snippet: '…Panaskan oven pada suhu 105°C selama 3 jam sebelum menimbang sample kering. Toleransi <mark>kadar air</mark> maksimum 12%…' },
  { id: 's4', code: 'KEB-001', title: 'Kebijakan Mutu, Lingkungan, dan K3', type: 'kebijakan', category: 'Manajemen', updated: '2026-01-15', tags: ['ISO 9001', 'ISO 14001', 'ISO 45001'], breadcrumb: 'Kebijakan > Terintegrasi', score: 0.88, snippet: '…Manajemen berkomitmen untuk menerapkan sistem <mark>mutu</mark> yang efektif, meminimalisir dampak lingkungan, dan menjamin keselamatan kerja…' },
  { id: 's5', code: 'MM-01', title: 'Manual Mutu Terintegrasi (IMS)', type: 'manual', category: 'Manajemen', updated: '2026-02-01', tags: ['ISO 9001', 'IMS'], breadcrumb: 'Manual > IMS', score: 0.85, snippet: '…Ruang lingkup Sistem <mark>Manajemen Mutu</mark> Terintegrasi mencakup seluruh proses bisnis: penerimaan bahan baku, produksi, QC, gudang, hingga distribusi…' },
  { id: 's6', code: 'FM-HSE-002', title: 'Form Laporan Nearmiss', type: 'formulir', category: 'K3', updated: '2026-04-11', tags: ['ISO 45001'], breadcrumb: 'Formulir > Formulir K3', score: 0.82, snippet: '…Formulir laporan <mark>nearmiss</mark> wajib diisi oleh semua karyawan yang menyaksikan atau mengalami hampir kecelakaan. Kirimkan ke HSE Officer…' },
  { id: 's7', code: 'SOP-IT-010', title: 'SOP Keamanan Informasi & ISMS', type: 'sop', category: 'IT', updated: '2026-05-14', tags: ['ISO 27001'], breadcrumb: 'Prosedur > SOP Support > IT', score: 0.79, snippet: '…Setiap akses ke sistem produksi memerlukan otorisasi multi-factor. Log <mark>keamanan</mark> disimpan minimum 12 bulan sesuai kebijakan retensi…' },
  { id: 's8', code: 'SOP-OP-004', title: 'Prosedur Kontrol Kualitas Produksi', type: 'sop', category: 'Operasional', updated: '2026-05-27', tags: ['ISO 9001'], breadcrumb: 'Prosedur > SOP Operasional > QC', score: 0.76, snippet: '…Setiap batch produksi wajib melalui pemeriksaan <mark>kualitas</mark> incoming, in-process, dan outgoing dengan sampling sesuai MIL-STD-105E…' },
  { id: 's9', code: 'REC-AUD-2026-014', title: 'Laporan Audit Internal Q2 2026', type: 'rekaman', category: 'Audit', updated: '2026-07-15', tags: ['ISO 9001', 'Audit'], breadcrumb: 'Rekaman > Rekaman Audit', score: 0.72, snippet: '…Ditemukan 3 major dan 8 minor findings. Fokus <mark>audit</mark> pada implementasi SOP produksi dan pengelolaan risiko rantai pasok…' },
  { id: 's10', code: 'SOP-HR-002', title: 'Prosedur Rekrutmen Karyawan', type: 'sop', category: 'HR', updated: '2026-05-11', tags: ['ISO 9001', 'HR'], breadcrumb: 'Prosedur > SOP Support > HR', score: 0.70, snippet: '…Proses <mark>rekrutmen</mark> mencakup screening CV, tes kompetensi, wawancara HR, wawancara user, hingga MCU sebelum penandatanganan kontrak…' },
  { id: 's11', code: 'IK-PRD-007', title: 'IK Inspeksi Visual Produk Jadi', type: 'ik', category: 'Produksi', updated: '2026-06-19', tags: ['ISO 9001'], breadcrumb: 'Instruksi Kerja > IK Produksi', score: 0.67, snippet: '…<mark>Inspeksi visual</mark> dilakukan di bawah lampu 500 lux dengan latar putih. Perhatikan cacat permukaan, warna, dan label yang terbaca jelas…' },
  { id: 's12', code: 'KEB-005', title: 'Kebijakan Anti Penyuapan', type: 'kebijakan', category: 'Governance', updated: '2026-02-22', tags: ['ISO 37001'], breadcrumb: 'Kebijakan > Governance', score: 0.64, snippet: '…Perusahaan menerapkan zero-tolerance terhadap segala bentuk <mark>penyuapan</mark>, gratifikasi, dan konflik kepentingan…' },
]

const TYPE_LABEL: Record<ResultType, string> = {
  sop: 'SOP', ik: 'IK', formulir: 'Formulir', kebijakan: 'Kebijakan', manual: 'Manual', rekaman: 'Rekaman'
}
const TYPE_TONE: Record<ResultType, string> = {
  sop: 'bg-[#eaf3fb] text-[#2a6fb3] border-[#c9e0f3]',
  ik: 'bg-[#e3f1ea] text-[#1d6e48] border-[#c4dfcf]',
  formulir: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]',
  kebijakan: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]',
  manual: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)] border-[#c9e0f3]',
  rekaman: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-medium)] border-[var(--color-neutral-border)]',
}

const CATEGORIES = ['Operasional', 'K3', 'Laboratorium', 'Manajemen', 'IT', 'HR', 'Audit', 'Produksi', 'Governance']

const POPULAR = [
  'Prosedur audit internal', 'Format laporan nearmiss', 'Kebijakan mutu', 'MSDS bahan kimia',
  'IK kalibrasi timbangan', 'Form permintaan cuti',
]

const RECENT = [
  'penanganan produk tidak sesuai', 'investigasi kecelakaan kerja', 'kadar air metode oven',
]

const TRENDING = ['ISO 45001', 'ISO 27001', 'SMK3 emas', 'Cipta Kerja', 'Coretax']

export function KnowledgeDiscoveryPage() {
  const [q, setQ] = useState('produk tidak sesuai')
  const [types, setTypes] = useState<Set<ResultType>>(new Set())
  const [category, setCategory] = useState('')

  function toggleType(t: ResultType) {
    setTypes((prev) => {
      const n = new Set(prev)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  }

  const filtered = useMemo(() => {
    return RESULTS.filter((r) => {
      if (types.size > 0 && !types.has(r.type)) return false
      if (category && r.category !== category) return false
      return true
    })
  }, [types, category])

  return (
    <div>
      <PageHeader
        eyebrow="AI-Powered Discovery"
        title="Knowledge Base & Discovery"
        subtitle="Cari, telusuri, dan temukan dokumen di seluruh EDMS dengan pencarian semantik, filter granular, dan rekomendasi berbasis konteks."
      />

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
            <input
              className={inputClass + ' pl-10 py-3 text-[14px]'}
              placeholder="Cari dokumen, SOP, kebijakan, formulir…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button variant="primary" size="md"><Search size={14} /> Cari</Button>
          <Button variant="secondary" size="md"><Sparkles size={14} /> AI Assist</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
            <Filter size={12} /> Filter Tipe:
          </span>
          {(Object.keys(TYPE_LABEL) as ResultType[]).map((t) => {
            const active = types.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide transition ${
                  active ? TYPE_TONE[t] : 'border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg-soft)]'
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            )
          })}
          <span className="mx-1 h-4 w-px bg-[var(--color-neutral-border)]" />
          <select className={inputClass + ' w-40'} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-[12px] font-semibold text-[var(--color-neutral-medium)]">
              Menampilkan <strong className="text-[var(--color-neutral-dark)]">{filtered.length}</strong> hasil untuk “{q}”
            </div>
            <div className="text-[11px] text-[var(--color-neutral-soft)]">Diurutkan berdasarkan relevansi</div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                title="Tidak ada hasil"
                description="Coba longgarkan filter atau gunakan kata kunci berbeda."
                icon={<Search size={18} />}
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Card interactive>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-baseline gap-2 text-[11px] text-[var(--color-neutral-medium)]">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_TONE[r.type]}`}>
                            {TYPE_LABEL[r.type]}
                          </span>
                          <span className="font-mono">{r.code}</span>
                          <span>·</span>
                          <span>{r.breadcrumb}</span>
                        </div>
                        <h3 className="text-[14.5px] font-bold text-[var(--color-neutral-dark)]">{r.title}</h3>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-[var(--color-neutral-medium)]">Relevance</div>
                        <div className="text-[14px] font-bold tabular-nums text-[var(--color-brand-primary-dark)]">
                          {Math.round(r.score * 100)}%
                        </div>
                      </div>
                    </div>
                    <p
                      className="mb-2 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]"
                      dangerouslySetInnerHTML={{
                        __html: r.snippet.replace(/<mark>/g, '<mark class="bg-[#fef1cf] text-[#8a5a10] rounded px-0.5">'),
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-neutral-medium)]">
                      <Clock size={11} /> Update {r.updated}
                      <span>·</span>
                      {r.tags.map((t) => (
                        <span key={t} className="rounded-full border border-[var(--color-neutral-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
                          {t}
                        </span>
                      ))}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle hint="Query yang sering dicari">Popular Queries</SectionTitle>
            <ul className="space-y-1.5">
              {POPULAR.map((p) => (
                <li key={p}>
                  <button
                    onClick={() => setQ(p)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition hover:bg-[var(--color-neutral-bg-soft)]"
                  >
                    <Search size={12} className="text-[var(--color-neutral-soft)]" />
                    <span className="flex-1 truncate">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle hint="Pencarian Anda">Recent Searches</SectionTitle>
            <ul className="space-y-1.5">
              {RECENT.map((p) => (
                <li key={p} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--color-neutral-medium)]">
                  <Clock size={12} />
                  <span className="flex-1 truncate">{p}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle hint="Topik trending minggu ini">Trending Topics</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {TRENDING.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-primary-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--color-brand-primary-dark)]">
                  <TrendingUp size={10} />
                  {t}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-2">
              <FileText size={16} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" />
              <div>
                <div className="text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">Butuh bantuan?</div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-neutral-medium)]">
                  Gunakan Asisten AI untuk merangkum, menyusun draft, atau menganalisis dokumen ISO Anda.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
