import { useMemo, useState } from 'react'
import { AlertTriangle, Archive, CheckCircle2, Clock, FileText, Search } from 'lucide-react'
import { Card, EmptyState, PageHeader, SectionTitle, inputClass } from '../components/ui'

type Classification = 'vital' | 'important' | 'useful' | 'nonessential'
type Media = 'fisik' | 'digital' | 'hybrid'
type Status = 'aktif' | 'due_review' | 'overdue' | 'archived'

type RecordItem = {
  id: string
  code: string
  name: string
  category: string
  classification: Classification
  retention: string
  media: Media
  location: string
  owner: string
  nextReview: string
  status: Status
}

const CATEGORIES = ['Mutu', 'K3', 'Lingkungan', 'HR', 'Keuangan', 'Produksi', 'Legal', 'IT']

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  vital: 'Vital',
  important: 'Important',
  useful: 'Useful',
  nonessential: 'Nonessential',
}

const CLASSIFICATION_TONE: Record<Classification, string> = {
  vital: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]',
  important: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]',
  useful: 'bg-[#eaf3fb] text-[#2a6fb3] border-[#c9e0f3]',
  nonessential: 'bg-[#f2f3ee] text-[#6b7268] border-[#e2e4dd]',
}

const MEDIA_LABEL: Record<Media, string> = { fisik: 'Fisik', digital: 'Digital', hybrid: 'Hybrid' }

const RECORDS: RecordItem[] = [
  { id: 'r1', code: 'REC-QMS-001', name: 'Notulen Tinjauan Manajemen', category: 'Mutu', classification: 'vital', retention: '10 tahun', media: 'hybrid', location: 'Arsip Pusat Rak A-1', owner: 'Sekretariat ISO', nextReview: '2027-01-15', status: 'aktif' },
  { id: 'r2', code: 'REC-QMS-002', name: 'Laporan Audit Internal', category: 'Mutu', classification: 'vital', retention: '7 tahun', media: 'digital', location: 'Server EDMS /audit', owner: 'MR', nextReview: '2026-09-01', status: 'aktif' },
  { id: 'r3', code: 'REC-QMS-003', name: 'Sertifikat ISO 9001:2015', category: 'Mutu', classification: 'vital', retention: 'Permanen', media: 'hybrid', location: 'Brankas Direksi', owner: 'Management Representative', nextReview: '2026-08-20', status: 'due_review' },
  { id: 'r4', code: 'REC-HSE-001', name: 'Laporan Investigasi Kecelakaan Kerja', category: 'K3', classification: 'vital', retention: '10 tahun', media: 'digital', location: 'Server EDMS /hse', owner: 'HSE Manager', nextReview: '2026-11-30', status: 'aktif' },
  { id: 'r5', code: 'REC-HSE-002', name: 'Absensi Training K3', category: 'K3', classification: 'important', retention: '5 tahun', media: 'hybrid', location: 'Filing Cabinet HSE', owner: 'HSE Officer', nextReview: '2026-07-01', status: 'overdue' },
  { id: 'r6', code: 'REC-HSE-003', name: 'Laporan Nearmiss', category: 'K3', classification: 'important', retention: '5 tahun', media: 'digital', location: 'Server EDMS /nearmiss', owner: 'HSE Officer', nextReview: '2026-10-15', status: 'aktif' },
  { id: 'r7', code: 'REC-ENV-001', name: 'Laporan Pemantauan Lingkungan (RKL-RPL)', category: 'Lingkungan', classification: 'vital', retention: '10 tahun', media: 'hybrid', location: 'Arsip Lingkungan', owner: 'Environmental Officer', nextReview: '2026-08-30', status: 'due_review' },
  { id: 'r8', code: 'REC-ENV-002', name: 'Manifest Limbah B3', category: 'Lingkungan', classification: 'vital', retention: '5 tahun', media: 'fisik', location: 'Gudang B3 Arsip', owner: 'HSE Officer', nextReview: '2026-12-05', status: 'aktif' },
  { id: 'r9', code: 'REC-HR-001', name: 'Kontrak Kerja Karyawan Tetap', category: 'HR', classification: 'vital', retention: '10 tahun setelah PHK', media: 'hybrid', location: 'HR Filing Room', owner: 'HR Manager', nextReview: '2027-02-20', status: 'aktif' },
  { id: 'r10', code: 'REC-HR-002', name: 'Rekaman Pelatihan Karyawan', category: 'HR', classification: 'important', retention: '5 tahun', media: 'digital', location: 'HRIS', owner: 'HR Learning', nextReview: '2026-09-10', status: 'aktif' },
  { id: 'r11', code: 'REC-HR-003', name: 'Slip Gaji Karyawan', category: 'HR', classification: 'important', retention: '10 tahun', media: 'digital', location: 'Payroll System', owner: 'HR Payroll', nextReview: '2026-06-30', status: 'overdue' },
  { id: 'r12', code: 'REC-FIN-001', name: 'Laporan Keuangan Tahunan (Audited)', category: 'Keuangan', classification: 'vital', retention: '10 tahun', media: 'hybrid', location: 'Arsip Finance', owner: 'Finance Manager', nextReview: '2027-03-31', status: 'aktif' },
  { id: 'r13', code: 'REC-FIN-002', name: 'Faktur Pajak', category: 'Keuangan', classification: 'important', retention: '10 tahun', media: 'digital', location: 'Coretax System', owner: 'Tax Officer', nextReview: '2026-11-20', status: 'aktif' },
  { id: 'r14', code: 'REC-PRD-001', name: 'Laporan Produksi Harian', category: 'Produksi', classification: 'useful', retention: '3 tahun', media: 'digital', location: 'MES System', owner: 'Production Supervisor', nextReview: '2026-08-25', status: 'due_review' },
  { id: 'r15', code: 'REC-PRD-002', name: 'Certificate of Analysis (COA) Produk', category: 'Produksi', classification: 'important', retention: '5 tahun', media: 'digital', location: 'LIMS', owner: 'QC Manager', nextReview: '2026-10-01', status: 'aktif' },
  { id: 'r16', code: 'REC-LGL-001', name: 'Perjanjian Kerja Sama Vendor', category: 'Legal', classification: 'vital', retention: '10 tahun', media: 'hybrid', location: 'Legal Filing Room', owner: 'Legal Officer', nextReview: '2026-12-15', status: 'aktif' },
  { id: 'r17', code: 'REC-LGL-002', name: 'Izin Usaha & Sertifikat Perusahaan', category: 'Legal', classification: 'vital', retention: 'Permanen', media: 'hybrid', location: 'Brankas Direksi', owner: 'Legal Head', nextReview: '2026-09-30', status: 'aktif' },
  { id: 'r18', code: 'REC-IT-001', name: 'Log Backup System', category: 'IT', classification: 'important', retention: '2 tahun', media: 'digital', location: 'Backup Server', owner: 'IT Infrastructure', nextReview: '2026-08-05', status: 'due_review' },
  { id: 'r19', code: 'REC-IT-002', name: 'User Access Review Log', category: 'IT', classification: 'important', retention: '3 tahun', media: 'digital', location: 'IAM System', owner: 'IT Security', nextReview: '2026-11-15', status: 'aktif' },
  { id: 'r20', code: 'REC-QMS-004', name: 'Form Pengendalian Perubahan Dokumen', category: 'Mutu', classification: 'useful', retention: '3 tahun', media: 'digital', location: 'Server EDMS /change', owner: 'Document Controller', nextReview: '2026-07-30', status: 'overdue' },
]

function ClassChip({ c }: { c: Classification }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${CLASSIFICATION_TONE[c]}`}>
      {CLASSIFICATION_LABEL[c]}
    </span>
  )
}

function StatusChip({ s }: { s: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    aktif: { label: 'Aktif', cls: 'bg-[#e3f1ea] text-[#1d6e48] border-[#c4dfcf]' },
    due_review: { label: 'Due Review', cls: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]' },
    overdue: { label: 'Overdue', cls: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]' },
    archived: { label: 'Archived', cls: 'bg-[#f2f3ee] text-[#6b7268] border-[#e2e4dd]' },
  }
  const m = map[s]
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  )
}

export function RecordsRegisterPage() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [classification, setClassification] = useState<'' | Classification>('')

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return RECORDS.filter((r) => {
      if (category && r.category !== category) return false
      if (classification && r.classification !== classification) return false
      if (kw && !`${r.code} ${r.name} ${r.owner} ${r.location}`.toLowerCase().includes(kw)) return false
      return true
    })
  }, [q, category, classification])

  const counts = {
    total: RECORDS.length,
    vital: RECORDS.filter((r) => r.classification === 'vital').length,
    due: RECORDS.filter((r) => r.status === 'due_review').length,
    overdue: RECORDS.filter((r) => r.status === 'overdue').length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Manajemen Rekaman"
        title="Records Register"
        subtitle="Inventarisasi rekaman terintegrasi berbasis ISO 15489 — klasifikasi vital records, media penyimpanan, retensi, dan kepemilikan."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
            <FileText size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{counts.total}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Total Records</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbe7e6] text-[#b23b3a]">
            <AlertTriangle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{counts.vital}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Vital Records</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf1dc] text-[#b9791c]">
            <Clock size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{counts.due}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Due for Review</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbe7e6] text-[#b23b3a]">
            <Archive size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{counts.overdue}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Overdue</div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Filter dan cari records">Daftar Records</SectionTitle>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
            <input className={inputClass + ' pl-8'} placeholder="Cari kode, nama, owner…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value as Classification | '')}>
            <option value="">Semua Klasifikasi</option>
            {(Object.keys(CLASSIFICATION_LABEL) as Classification[]).map((c) => (
              <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada records yang cocok"
            description="Ubah filter atau kata kunci pencarian."
            icon={<FileText size={18} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Nomor</th>
                  <th className="py-2 pr-3 font-bold">Nama Record</th>
                  <th className="py-2 pr-3 font-bold">Kategori</th>
                  <th className="py-2 pr-3 font-bold">Klasifikasi</th>
                  <th className="py-2 pr-3 font-bold">Retensi</th>
                  <th className="py-2 pr-3 font-bold">Media</th>
                  <th className="py-2 pr-3 font-bold">Lokasi</th>
                  <th className="py-2 pr-3 font-bold">Owner</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-neutral-border)]">
                {filtered.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-[var(--color-neutral-bg-soft)]">
                    <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{r.code}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--color-neutral-dark)]">{r.name}</td>
                    <td className="py-2 pr-3">{r.category}</td>
                    <td className="py-2 pr-3"><ClassChip c={r.classification} /></td>
                    <td className="py-2 pr-3">{r.retention}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full border border-[var(--color-neutral-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                        {MEDIA_LABEL[r.media]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-[var(--color-neutral-medium)]">{r.location}</td>
                    <td className="py-2 pr-3">{r.owner}</td>
                    <td className="py-2 pr-3"><StatusChip s={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
          <CheckCircle2 size={13} className="text-[var(--color-brand-primary)]" />
          Menampilkan {filtered.length} dari {RECORDS.length} records. Klasifikasi vital records wajib direview per tahun.
        </div>
      </Card>
    </div>
  )
}
