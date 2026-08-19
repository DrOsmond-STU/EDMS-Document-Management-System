import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import { Card, PageHeader, SectionTitle, inputClass } from '../components/ui'

type Standard = 'ISO9001' | 'ISO14001' | 'ISO45001' | 'SMK3' | 'ISO27001' | 'ISO22301' | 'ISO37001'
type CoverageStatus = 'compliant' | 'partial' | 'gap' | 'na'

const STANDARDS: { key: Standard; label: string }[] = [
  { key: 'ISO9001', label: 'ISO 9001:2015 — Sistem Manajemen Mutu' },
  { key: 'ISO14001', label: 'ISO 14001:2015 — Sistem Manajemen Lingkungan' },
  { key: 'ISO45001', label: 'ISO 45001:2018 — Sistem Manajemen K3' },
  { key: 'SMK3', label: 'PP 50/2012 — SMK3' },
  { key: 'ISO27001', label: 'ISO 27001:2022 — Keamanan Informasi' },
  { key: 'ISO22301', label: 'ISO 22301:2019 — Business Continuity' },
  { key: 'ISO37001', label: 'ISO 37001:2016 — Anti Penyuapan' },
]

type Clause = { id: string; standard: Standard; code: string; title: string }

const CLAUSES: Clause[] = [
  { id: 'k1', standard: 'ISO9001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k2', standard: 'ISO9001', code: '5.2', title: 'Kebijakan Mutu' },
  { id: 'k3', standard: 'ISO9001', code: '6.1', title: 'Tindakan Menangani Risiko & Peluang' },
  { id: 'k4', standard: 'ISO9001', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k5', standard: 'ISO9001', code: '9.2', title: 'Audit Internal' },
  { id: 'k6', standard: 'ISO14001', code: '6.1.2', title: 'Aspek Lingkungan' },
  { id: 'k7', standard: 'ISO14001', code: '8.2', title: 'Kesiapan & Tanggap Darurat' },
  { id: 'k8', standard: 'ISO45001', code: '6.1.2', title: 'Identifikasi Bahaya & Penilaian Risiko K3' },
  { id: 'k9', standard: 'ISO45001', code: '7.4', title: 'Komunikasi K3' },
  { id: 'k10', standard: 'ISO45001', code: '10.2', title: 'Investigasi Insiden' },
  { id: 'k11', standard: 'SMK3', code: '3.1', title: 'Pembangunan & Terpeliharanya Komitmen' },
  { id: 'k12', standard: 'ISO27001', code: 'A.5.1', title: 'Kebijakan Keamanan Informasi' },
  { id: 'k13', standard: 'ISO27001', code: 'A.8.9', title: 'Manajemen Konfigurasi' },
  { id: 'k14', standard: 'ISO22301', code: '8.2', title: 'Business Impact Analysis' },
  { id: 'k15', standard: 'ISO37001', code: '5.2', title: 'Kebijakan Anti Penyuapan' },
]

const DOCUMENTS = [
  { id: 'dc1', code: 'MM-01', title: 'Manual Mutu Terintegrasi' },
  { id: 'dc2', code: 'KEB-001', title: 'Kebijakan Mutu, K3, Lingkungan' },
  { id: 'dc3', code: 'SOP-QMS-002', title: 'SOP Pengendalian Dokumen' },
  { id: 'dc4', code: 'SOP-QMS-004', title: 'SOP Audit Internal' },
  { id: 'dc5', code: 'SOP-HSE-001', title: 'SOP Investigasi Kecelakaan' },
  { id: 'dc6', code: 'SOP-HSE-006', title: 'SOP JSA & HIRADC' },
  { id: 'dc7', code: 'SOP-IT-010', title: 'SOP Keamanan Informasi' },
  { id: 'dc8', code: 'KEB-005', title: 'Kebijakan Anti Penyuapan' },
]

// Coverage matrix keyed by `${clauseId}:${docId}`
const COVERAGE: Record<string, CoverageStatus> = {
  'k1:dc1': 'compliant', 'k1:dc2': 'partial',
  'k2:dc1': 'compliant', 'k2:dc2': 'compliant',
  'k3:dc1': 'partial', 'k3:dc3': 'compliant',
  'k4:dc3': 'compliant', 'k4:dc1': 'compliant',
  'k5:dc4': 'compliant', 'k5:dc1': 'partial',
  'k6:dc1': 'partial', 'k6:dc6': 'gap',
  'k7:dc5': 'compliant', 'k7:dc6': 'partial',
  'k8:dc6': 'compliant', 'k8:dc5': 'partial',
  'k9:dc6': 'partial', 'k9:dc2': 'compliant',
  'k10:dc5': 'compliant',
  'k11:dc2': 'compliant', 'k11:dc6': 'partial',
  'k12:dc7': 'compliant', 'k12:dc2': 'partial',
  'k13:dc7': 'partial',
  'k14:dc1': 'gap', 'k14:dc7': 'gap',
  'k15:dc8': 'compliant', 'k15:dc2': 'compliant',
}

type Gap = { id: string; clause: Clause; priority: 'high' | 'medium' | 'low'; note: string }
const GAPS: Gap[] = [
  { id: 'g1', clause: CLAUSES.find((c) => c.id === 'k14')!, priority: 'high', note: 'BIA belum tersusun secara formal — target penyelesaian Q4 2026.' },
  { id: 'g2', clause: CLAUSES.find((c) => c.id === 'k6')!, priority: 'high', note: 'Register aspek lingkungan perlu ditelaah ulang & disinkronkan dengan JSA.' },
  { id: 'g3', clause: CLAUSES.find((c) => c.id === 'k13')!, priority: 'medium', note: 'Baseline konfigurasi belum lengkap untuk server produksi.' },
  { id: 'g4', clause: CLAUSES.find((c) => c.id === 'k11')!, priority: 'medium', note: 'Bukti komitmen manajemen perlu diformalkan lewat rapat P2K3 rutin.' },
  { id: 'g5', clause: CLAUSES.find((c) => c.id === 'k3')!, priority: 'low', note: 'Register risiko sudah ada tapi mapping ke peluang perbaikan minim.' },
]

function CoverageCell({ s }: { s?: CoverageStatus }) {
  if (!s) return <span className="text-[var(--color-neutral-soft)]">—</span>
  if (s === 'compliant') return <CheckCircle2 size={16} className="mx-auto text-[#1d6e48]" />
  if (s === 'partial') return <AlertTriangle size={16} className="mx-auto text-[#b9791c]" />
  if (s === 'gap') return <XCircle size={16} className="mx-auto text-[#b23b3a]" />
  return <MinusCircle size={16} className="mx-auto text-[var(--color-neutral-soft)]" />
}

function PriorityChip({ p }: { p: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]',
    medium: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]',
    low: 'bg-[#eaf3fb] text-[#2a6fb3] border-[#c9e0f3]',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${map[p]}`}>
      {p}
    </span>
  )
}

export function ComplianceMatrixPage() {
  const [standard, setStandard] = useState<'' | Standard>('')

  const filteredClauses = useMemo(
    () => (standard ? CLAUSES.filter((c) => c.standard === standard) : CLAUSES),
    [standard]
  )

  const stats = useMemo(() => {
    let compliant = 0, partial = 0, gap = 0, empty = 0
    for (const cl of filteredClauses) {
      for (const doc of DOCUMENTS) {
        const s = COVERAGE[`${cl.id}:${doc.id}`]
        if (s === 'compliant') compliant++
        else if (s === 'partial') partial++
        else if (s === 'gap') gap++
        else empty++
      }
    }
    return { compliant, partial, gap, empty, total: filteredClauses.length * DOCUMENTS.length }
  }, [filteredClauses])

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Compliance Matrix"
        subtitle="Peta pemenuhan klausul standar terhadap dokumen internal. Menampilkan gap analysis lintas ISO & regulasi."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1ea] text-[#1d6e48]">
            <CheckCircle2 size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.compliant}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Compliant</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf1dc] text-[#b9791c]">
            <AlertTriangle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.partial}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Partial</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbe7e6] text-[#b23b3a]">
            <XCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.gap}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Gap</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-neutral-bg)] text-[var(--color-neutral-medium)]">
            <MinusCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.empty}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Belum Dinilai</div>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <SectionTitle
          hint={`Menampilkan ${filteredClauses.length} klausul × ${DOCUMENTS.length} dokumen`}
          action={
            <select className={inputClass + ' w-56'} value={standard} onChange={(e) => setStandard(e.target.value as Standard | '')}>
              <option value="">Semua Standar</option>
              {STANDARDS.map((s) => <option key={s.key} value={s.key}>{s.label.split(' — ')[0]}</option>)}
            </select>
          }
        >
          Matriks Klausul × Dokumen
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-2 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  Klausul
                </th>
                {DOCUMENTS.map((d) => (
                  <th key={d.id} className="border-b border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                    <div className="font-mono">{d.code}</div>
                    <div className="mt-0.5 truncate text-[10px] font-normal normal-case text-[var(--color-neutral-soft)]" style={{ maxWidth: 100 }}>{d.title}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClauses.map((cl) => (
                <tr key={cl.id} className="hover:bg-[var(--color-neutral-bg-soft)]">
                  <td className="sticky left-0 z-10 border-b border-r border-[var(--color-neutral-border)] bg-white px-2 py-2 text-left">
                    <div className="flex flex-wrap items-baseline gap-1">
                      <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{cl.standard}</span>
                      <span className="font-mono text-[11px] font-bold">{cl.code}</span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-[var(--color-neutral-dark)]">{cl.title}</div>
                  </td>
                  {DOCUMENTS.map((d) => (
                    <td key={d.id} className="border-b border-[var(--color-neutral-border)] px-1 py-2 text-center">
                      <CoverageCell s={COVERAGE[`${cl.id}:${d.id}`]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-neutral-medium)]">
          <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-[#1d6e48]" /> Compliant</span>
          <span className="flex items-center gap-1"><AlertTriangle size={13} className="text-[#b9791c]" /> Partial</span>
          <span className="flex items-center gap-1"><XCircle size={13} className="text-[#b23b3a]" /> Gap</span>
          <span className="flex items-center gap-1"><MinusCircle size={13} className="text-[var(--color-neutral-soft)]" /> Belum dinilai</span>
        </div>
      </Card>

      <Card>
        <SectionTitle hint={`${GAPS.length} gap teridentifikasi`}>Gap Analysis</SectionTitle>
        <ul className="divide-y divide-[var(--color-neutral-border)]">
          {GAPS.map((g) => (
            <li key={g.id} className="flex items-start gap-3 py-3">
              <div className="mt-0.5"><PriorityChip p={g.priority} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{g.clause.standard}</span>
                  <span className="font-mono text-[12px] font-bold">{g.clause.code}</span>
                  <span className="text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">{g.clause.title}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">{g.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
