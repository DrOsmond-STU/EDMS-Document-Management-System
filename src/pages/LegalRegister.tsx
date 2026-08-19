import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Gavel, RefreshCw, Search, XCircle } from 'lucide-react'
import { Card, EmptyState, PageHeader, SectionTitle, inputClass } from '../components/ui'

type Compliance = 'compliant' | 'partial' | 'noncompliant' | 'review'

type Regulation = {
  id: string
  number: string
  title: string
  authority: string
  field: string
  effectiveDate: string
  lastReview: string
  compliance: Compliance
  linkedDocs: number
  notes: string
}

const FIELDS = ['Ketenagakerjaan', 'K3', 'Lingkungan', 'Perpajakan', 'Kesehatan', 'Perindustrian', 'Kelistrikan', 'ITE', 'Antikorupsi']

const REGULATIONS: Regulation[] = [
  { id: 'l1', number: 'UU No. 13 Tahun 2003', title: 'Undang-Undang Ketenagakerjaan', authority: 'DPR RI / Kemnaker', field: 'Ketenagakerjaan', effectiveDate: '2003-03-25', lastReview: '2026-03-14', compliance: 'compliant', linkedDocs: 12, notes: 'Beberapa pasal telah diubah UU Cipta Kerja (UU 6/2023).' },
  { id: 'l2', number: 'UU No. 6 Tahun 2023', title: 'UU Cipta Kerja (Perppu 2/2022 → UU)', authority: 'DPR RI', field: 'Ketenagakerjaan', effectiveDate: '2023-03-31', lastReview: '2026-05-02', compliance: 'partial', linkedDocs: 8, notes: 'Perlu penyelarasan PKWT dan alih daya di kontrak vendor.' },
  { id: 'l3', number: 'PP No. 50 Tahun 2012', title: 'Penerapan Sistem Manajemen K3 (SMK3)', authority: 'Presiden RI / Kemnaker', field: 'K3', effectiveDate: '2012-04-12', lastReview: '2026-06-01', compliance: 'compliant', linkedDocs: 24, notes: 'Sertifikat SMK3 gold berlaku hingga 2027.' },
  { id: 'l4', number: 'Permenaker No. 5 Tahun 2018', title: 'K3 Lingkungan Kerja', authority: 'Kemnaker', field: 'K3', effectiveDate: '2018-05-16', lastReview: '2026-04-11', compliance: 'compliant', linkedDocs: 9, notes: 'Pengukuran lingkungan kerja rutin per 6 bulan.' },
  { id: 'l5', number: 'Permenaker No. 8 Tahun 2020', title: 'Keselamatan & Kesehatan Kerja Pesawat Angkat & Angkut', authority: 'Kemnaker', field: 'K3', effectiveDate: '2020-04-30', lastReview: '2026-02-18', compliance: 'compliant', linkedDocs: 5, notes: 'Ijin operator forklift semua sudah SIO.' },
  { id: 'l6', number: 'UU No. 32 Tahun 2009', title: 'Perlindungan & Pengelolaan Lingkungan Hidup', authority: 'DPR RI / KLHK', field: 'Lingkungan', effectiveDate: '2009-10-03', lastReview: '2026-05-25', compliance: 'partial', linkedDocs: 15, notes: 'Perlu update dokumen AMDAL menyesuaikan ekspansi pabrik.' },
  { id: 'l7', number: 'PP No. 22 Tahun 2021', title: 'Penyelenggaraan Perlindungan & Pengelolaan Lingkungan Hidup', authority: 'Presiden RI', field: 'Lingkungan', effectiveDate: '2021-02-02', lastReview: '2026-06-20', compliance: 'compliant', linkedDocs: 11, notes: 'RKL-RPL dilaporkan tepat waktu semester I 2026.' },
  { id: 'l8', number: 'PP No. 101 Tahun 2014', title: 'Pengelolaan Limbah Bahan Berbahaya dan Beracun', authority: 'Presiden RI', field: 'Lingkungan', effectiveDate: '2014-10-17', lastReview: '2026-05-10', compliance: 'noncompliant', linkedDocs: 7, notes: 'Manifest limbah B3 Q1 2026 masih ada gap pengiriman — sedang ditindaklanjuti.' },
  { id: 'l9', number: 'UU No. 7 Tahun 2021', title: 'Harmonisasi Peraturan Perpajakan (UU HPP)', authority: 'DPR RI / Kemenkeu', field: 'Perpajakan', effectiveDate: '2021-10-29', lastReview: '2026-07-15', compliance: 'compliant', linkedDocs: 6, notes: 'PPh badan, PPN dan Coretax sudah menyesuaikan.' },
  { id: 'l10', number: 'PMK No. 168/PMK.03/2023', title: 'Petunjuk Pelaksanaan Pemotongan PPh Pasal 21', authority: 'Kementerian Keuangan', field: 'Perpajakan', effectiveDate: '2024-01-01', lastReview: '2026-06-30', compliance: 'compliant', linkedDocs: 4, notes: 'Skema TER sudah diadopsi payroll sejak Jan 2024.' },
  { id: 'l11', number: 'UU No. 36 Tahun 2009', title: 'Kesehatan', authority: 'DPR RI / Kemenkes', field: 'Kesehatan', effectiveDate: '2009-10-13', lastReview: '2026-01-15', compliance: 'review', linkedDocs: 3, notes: 'Menunggu peninjauan menyesuaikan UU Kesehatan 17/2023.' },
  { id: 'l12', number: 'UU No. 17 Tahun 2023', title: 'Kesehatan (UU Omnibus Kesehatan)', authority: 'DPR RI', field: 'Kesehatan', effectiveDate: '2023-08-08', lastReview: '2026-07-30', compliance: 'partial', linkedDocs: 5, notes: 'Kebijakan MCU tahunan perlu update format sesuai lampiran baru.' },
  { id: 'l13', number: 'UU No. 3 Tahun 2014', title: 'Perindustrian', authority: 'DPR RI / Kemenperin', field: 'Perindustrian', effectiveDate: '2014-01-15', lastReview: '2026-04-05', compliance: 'compliant', linkedDocs: 4, notes: 'IUI berlaku hingga akhir 2027.' },
  { id: 'l14', number: 'UU No. 30 Tahun 2009', title: 'Ketenagalistrikan', authority: 'DPR RI / ESDM', field: 'Kelistrikan', effectiveDate: '2009-09-23', lastReview: '2026-06-12', compliance: 'compliant', linkedDocs: 3, notes: 'SLO (Sertifikat Laik Operasi) instalasi listrik semua berlaku.' },
  { id: 'l15', number: 'UU No. 19 Tahun 2016', title: 'Perubahan UU ITE', authority: 'DPR RI', field: 'ITE', effectiveDate: '2016-11-25', lastReview: '2026-05-19', compliance: 'partial', linkedDocs: 6, notes: 'Kebijakan cyber security perlu penyesuaian untuk data pribadi karyawan.' },
  { id: 'l16', number: 'UU No. 20 Tahun 2001', title: 'Pemberantasan Tindak Pidana Korupsi', authority: 'DPR RI / KPK', field: 'Antikorupsi', effectiveDate: '2001-11-21', lastReview: '2026-03-30', compliance: 'compliant', linkedDocs: 4, notes: 'Kebijakan anti-suap (ISO 37001) sudah tercertifikasi.' },
]

function ComplianceChip({ c }: { c: Compliance }) {
  const map: Record<Compliance, { label: string; cls: string; icon: React.ReactNode }> = {
    compliant: { label: 'Compliant', cls: 'bg-[#e3f1ea] text-[#1d6e48] border-[#c4dfcf]', icon: <CheckCircle2 size={11} /> },
    partial: { label: 'Partial', cls: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]', icon: <AlertTriangle size={11} /> },
    noncompliant: { label: 'Non-compliant', cls: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]', icon: <XCircle size={11} /> },
    review: { label: 'In Review', cls: 'bg-[#eaf3fb] text-[#2a6fb3] border-[#c9e0f3]', icon: <RefreshCw size={11} /> },
  }
  const m = map[c]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  )
}

export function LegalRegisterPage() {
  const [q, setQ] = useState('')
  const [field, setField] = useState('')
  const [compliance, setCompliance] = useState<'' | Compliance>('')

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return REGULATIONS.filter((r) => {
      if (field && r.field !== field) return false
      if (compliance && r.compliance !== compliance) return false
      if (kw && !`${r.number} ${r.title} ${r.authority}`.toLowerCase().includes(kw)) return false
      return true
    })
  }, [q, field, compliance])

  const stats = {
    total: REGULATIONS.length,
    pending: REGULATIONS.filter((r) => r.compliance === 'review').length,
    non: REGULATIONS.filter((r) => r.compliance === 'noncompliant').length,
    recent: REGULATIONS.filter((r) => new Date(r.lastReview) > new Date('2026-06-01')).length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Legal & Compliance"
        title="Legal Register"
        subtitle="Register regulasi dan peraturan perundang-undangan yang berlaku bagi perusahaan — hukum ketenagakerjaan, K3, lingkungan, perpajakan, dan lainnya."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
            <Gavel size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.total}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Total Regulasi</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3fb] text-[#2a6fb3]">
            <RefreshCw size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.pending}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Pending Review</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbe7e6] text-[#b23b3a]">
            <XCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.non}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Non-compliant</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1ea] text-[#1d6e48]">
            <CheckCircle2 size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.recent}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Recently Updated</div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Peraturan perundang-undangan yang mengikat operasional">Daftar Peraturan</SectionTitle>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
            <input className={inputClass + ' pl-8'} placeholder="Cari nomor / judul / otoritas…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={inputClass} value={field} onChange={(e) => setField(e.target.value)}>
            <option value="">Semua Bidang</option>
            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={inputClass} value={compliance} onChange={(e) => setCompliance(e.target.value as Compliance | '')}>
            <option value="">Semua Status</option>
            <option value="compliant">Compliant</option>
            <option value="partial">Partial</option>
            <option value="noncompliant">Non-compliant</option>
            <option value="review">In Review</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada regulasi yang cocok"
            description="Ubah filter atau kata kunci pencarian."
            icon={<Gavel size={18} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Nomor</th>
                  <th className="py-2 pr-3 font-bold">Judul</th>
                  <th className="py-2 pr-3 font-bold">Otoritas</th>
                  <th className="py-2 pr-3 font-bold">Bidang</th>
                  <th className="py-2 pr-3 font-bold">Berlaku</th>
                  <th className="py-2 pr-3 font-bold">Review Terakhir</th>
                  <th className="py-2 pr-3 font-bold text-center">Docs</th>
                  <th className="py-2 pr-3 font-bold">Kepatuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-neutral-border)]">
                {filtered.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-[var(--color-neutral-bg-soft)]">
                    <td className="py-3 pr-3 font-mono text-[11.5px] font-semibold text-[var(--color-neutral-dark)]">{r.number}</td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-[var(--color-neutral-dark)]">{r.title}</div>
                      <div className="mt-0.5 text-[11px] text-[var(--color-neutral-medium)]">{r.notes}</div>
                    </td>
                    <td className="py-3 pr-3">{r.authority}</td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full border border-[var(--color-neutral-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                        {r.field}
                      </span>
                    </td>
                    <td className="py-3 pr-3 tabular-nums">{r.effectiveDate}</td>
                    <td className="py-3 pr-3 tabular-nums text-[var(--color-neutral-medium)]">{r.lastReview}</td>
                    <td className="py-3 pr-3 text-center font-bold tabular-nums">{r.linkedDocs}</td>
                    <td className="py-3 pr-3"><ComplianceChip c={r.compliance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
          <Gavel size={13} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" />
          <div>
            <strong className="text-[var(--color-neutral-dark)]">Kepatuhan hukum wajib direview minimal 1x setahun</strong> oleh Legal Officer dan
            Management Representative. Perubahan regulasi baru dari JDIH otomatis mengirim notifikasi ke PIC bidang terkait.
          </div>
        </div>
      </Card>
    </div>
  )
}
