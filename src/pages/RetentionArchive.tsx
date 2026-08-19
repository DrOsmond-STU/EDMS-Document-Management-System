import { useMemo, useState } from 'react'
import { Archive, Calendar, Clock, FileText, Trash2 } from 'lucide-react'
import { Card, EmptyState, PageHeader, SectionTitle } from '../components/ui'

type Phase = 'aktif' | 'archive' | 'disposition'

type Item = {
  id: string
  code: string
  name: string
  category: string
  createdAt: string
  retentionYears: number
  ageMonths: number
  totalMonths: number
  location: string
  owner: string
  phase: Phase
  disposalDate?: string
  disposalMethod?: string
}

const ITEMS: Item[] = [
  { id: 'a1', code: 'REC-QMS-2024-021', name: 'Notulen Tinjauan Manajemen Q2 2024', category: 'Mutu', createdAt: '2024-06-15', retentionYears: 10, ageMonths: 26, totalMonths: 120, location: 'Server EDMS /qms', owner: 'Sekretariat ISO', phase: 'aktif' },
  { id: 'a2', code: 'REC-HSE-2024-014', name: 'Laporan Investigasi Kecelakaan Kerja - Bulan Maret', category: 'K3', createdAt: '2024-03-22', retentionYears: 10, ageMonths: 29, totalMonths: 120, location: 'Server EDMS /hse', owner: 'HSE Manager', phase: 'aktif' },
  { id: 'a3', code: 'REC-ENV-2025-008', name: 'Laporan RKL-RPL Semester 1 2025', category: 'Lingkungan', createdAt: '2025-07-30', retentionYears: 10, ageMonths: 13, totalMonths: 120, location: 'Arsip Lingkungan', owner: 'Environmental Officer', phase: 'aktif' },
  { id: 'a4', code: 'REC-HR-2025-114', name: 'Kontrak Kerja Karyawan Batch Juli 2025', category: 'HR', createdAt: '2025-07-01', retentionYears: 10, ageMonths: 13, totalMonths: 120, location: 'HR Filing Room', owner: 'HR Manager', phase: 'aktif' },
  { id: 'a5', code: 'REC-FIN-2024-088', name: 'Laporan Keuangan Audited FY2023', category: 'Keuangan', createdAt: '2024-04-30', retentionYears: 10, ageMonths: 28, totalMonths: 120, location: 'Finance Vault', owner: 'Finance Manager', phase: 'aktif' },
  { id: 'a6', code: 'REC-AUD-2025-005', name: 'Laporan Audit Internal Q1 2025', category: 'Mutu', createdAt: '2025-04-10', retentionYears: 7, ageMonths: 16, totalMonths: 84, location: 'Server EDMS /audit', owner: 'MR', phase: 'aktif' },
  { id: 'a7', code: 'REC-TRN-2026-012', name: 'Rekaman Pelatihan Awareness ISO 45001', category: 'HR', createdAt: '2026-02-14', retentionYears: 5, ageMonths: 6, totalMonths: 60, location: 'HRIS', owner: 'HR Learning', phase: 'aktif' },
  { id: 'a8', code: 'REC-PRD-2025-231', name: 'COA Batch Produksi Sirup Vitamin C', category: 'Produksi', createdAt: '2025-11-05', retentionYears: 5, ageMonths: 9, totalMonths: 60, location: 'LIMS', owner: 'QC Manager', phase: 'aktif' },

  { id: 'b1', code: 'REC-QMS-2019-041', name: 'Notulen Tinjauan Manajemen Q4 2019', category: 'Mutu', createdAt: '2019-12-20', retentionYears: 10, ageMonths: 80, totalMonths: 120, location: 'Cold Storage Arsip Rak C-4', owner: 'Arsiparis Pusat', phase: 'archive' },
  { id: 'b2', code: 'REC-HSE-2020-062', name: 'Laporan Investigasi Kebakaran Gudang B', category: 'K3', createdAt: '2020-08-14', retentionYears: 10, ageMonths: 72, totalMonths: 120, location: 'Cold Storage Arsip Rak B-2', owner: 'Arsiparis Pusat', phase: 'archive' },
  { id: 'b3', code: 'REC-ENV-2019-014', name: 'Manifest Limbah B3 Tahun 2019', category: 'Lingkungan', createdAt: '2019-12-31', retentionYears: 5, ageMonths: 80, totalMonths: 60, location: 'Cold Storage Arsip Rak D-1', owner: 'Arsiparis Pusat', phase: 'archive' },
  { id: 'b4', code: 'REC-FIN-2018-118', name: 'Laporan Keuangan Audited FY2018', category: 'Keuangan', createdAt: '2019-04-30', retentionYears: 10, ageMonths: 88, totalMonths: 120, location: 'Cold Storage Arsip Rak A-3', owner: 'Arsiparis Pusat', phase: 'archive' },
  { id: 'b5', code: 'REC-LGL-2020-004', name: 'PKS Vendor Chemical - PT XYZ 2020', category: 'Legal', createdAt: '2020-05-12', retentionYears: 10, ageMonths: 75, totalMonths: 120, location: 'Cold Storage Arsip Rak E-2', owner: 'Arsiparis Pusat', phase: 'archive' },

  { id: 'c1', code: 'REC-QMS-2014-032', name: 'Notulen Tinjauan Manajemen 2014', category: 'Mutu', createdAt: '2014-12-15', retentionYears: 10, ageMonths: 140, totalMonths: 120, location: 'Cold Storage Arsip Rak C-1', owner: 'Arsiparis Pusat', phase: 'disposition', disposalDate: '2026-09-01', disposalMethod: 'Shredding + Berita Acara Pemusnahan' },
  { id: 'c2', code: 'REC-FIN-2014-201', name: 'Faktur Pajak Q4 2014', category: 'Keuangan', createdAt: '2014-11-15', retentionYears: 10, ageMonths: 141, totalMonths: 120, location: 'Cold Storage Arsip Rak A-1', owner: 'Arsiparis Pusat', phase: 'disposition', disposalDate: '2026-08-30', disposalMethod: 'Shredding + Berita Acara Pemusnahan' },
  { id: 'c3', code: 'REC-HR-2013-018', name: 'Kontrak Kerja Karyawan (PHK 2013)', category: 'HR', createdAt: '2013-06-01', retentionYears: 10, ageMonths: 158, totalMonths: 120, location: 'Cold Storage Arsip Rak F-2', owner: 'Arsiparis Pusat', phase: 'disposition', disposalDate: '2026-09-15', disposalMethod: 'Shredding + Digital Wipe (NIST 800-88)' },
]

function Progress({ pct, tone }: { pct: number; tone: 'ok' | 'warn' | 'danger' }) {
  const bg = tone === 'ok' ? '#1d6e48' : tone === 'warn' ? '#b9791c' : '#b23b3a'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-border)]">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: bg }} />
    </div>
  )
}

function ItemCard({ item }: { item: Item }) {
  const pct = Math.round((item.ageMonths / item.totalMonths) * 100)
  const remaining = Math.max(0, item.totalMonths - item.ageMonths)
  const tone: 'ok' | 'warn' | 'danger' = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok'

  return (
    <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3 transition hover:border-[var(--color-brand-primary)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{item.code}</div>
          <div className="truncate text-[13px] font-semibold text-[var(--color-neutral-dark)]">{item.name}</div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--color-neutral-border)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
          {item.category}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--color-neutral-medium)]">
        <div>
          <div className="font-semibold text-[var(--color-neutral-dark)]">{item.createdAt}</div>
          <div className="text-[10px] uppercase tracking-wide">Dibuat</div>
        </div>
        <div>
          <div className="font-semibold text-[var(--color-neutral-dark)]">{item.retentionYears} thn</div>
          <div className="text-[10px] uppercase tracking-wide">Retensi</div>
        </div>
        <div>
          <div className="font-semibold text-[var(--color-neutral-dark)]">{Math.floor(remaining / 12)}y {remaining % 12}m</div>
          <div className="text-[10px] uppercase tracking-wide">Tersisa</div>
        </div>
      </div>

      <Progress pct={pct} tone={tone} />
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-[var(--color-neutral-medium)]">
        <span>{pct}% masa retensi</span>
        <span>Umur {Math.floor(item.ageMonths / 12)}y {item.ageMonths % 12}m</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-neutral-medium)]">
        <span className="flex items-center gap-1"><Archive size={11} /> {item.location}</span>
        <span>·</span>
        <span>{item.owner}</span>
      </div>

      {item.phase === 'disposition' && (
        <div className="mt-2 rounded border border-[#f4c8c6] bg-[#fbe7e6] px-2 py-1.5 text-[11px] text-[#b23b3a]">
          <div className="flex items-center gap-1 font-semibold"><Trash2 size={11} /> Rencana Disposisi</div>
          <div className="mt-0.5">
            <strong>{item.disposalDate}</strong> — {item.disposalMethod}
          </div>
        </div>
      )}
    </div>
  )
}

export function RetentionArchivePage() {
  const [tab, setTab] = useState<Phase>('aktif')

  const active = useMemo(() => ITEMS.filter((i) => i.phase === 'aktif'), [])
  const archived = useMemo(() => ITEMS.filter((i) => i.phase === 'archive'), [])
  const disposition = useMemo(() => ITEMS.filter((i) => i.phase === 'disposition'), [])

  const current = tab === 'aktif' ? active : tab === 'archive' ? archived : disposition

  const TABS: { key: Phase; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'aktif', label: 'Aktif', count: active.length, icon: <Clock size={14} /> },
    { key: 'archive', label: 'Archive', count: archived.length, icon: <Archive size={14} /> },
    { key: 'disposition', label: 'Disposition', count: disposition.length, icon: <Trash2 size={14} /> },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Retention Management"
        title="Retention & Archive"
        subtitle="Kelola siklus hidup records: pemantauan retensi aktif, migrasi ke archive, dan proses disposisi berbasis retention schedule."
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition ${
              tab === t.key
                ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]'
                : 'border-[var(--color-neutral-border)] bg-white hover:border-[var(--color-neutral-border-strong)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                tab === t.key ? 'bg-white text-[var(--color-brand-primary-dark)]' : 'bg-[var(--color-neutral-bg-soft)] text-[var(--color-neutral-medium)]'
              }`}>
                {t.icon}
              </div>
              <div>
                <div className="text-[13.5px] font-bold">{t.label}</div>
                <div className="text-[11px] text-[var(--color-neutral-medium)]">
                  {t.key === 'aktif' && 'Masih dalam masa retensi'}
                  {t.key === 'archive' && 'Sudah masuk arsip pasif'}
                  {t.key === 'disposition' && 'Siap dimusnahkan'}
                </div>
              </div>
            </div>
            <div className="text-[22px] font-bold tabular-nums">{t.count}</div>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle hint={`Total: ${current.length} record`}>
          {tab === 'aktif' && 'Records Aktif'}
          {tab === 'archive' && 'Records di Archive'}
          {tab === 'disposition' && 'Records Siap Disposisi'}
        </SectionTitle>

        {current.length === 0 ? (
          <EmptyState
            title="Belum ada record"
            description="Pindah tab untuk melihat record di fase lain."
            icon={<FileText size={18} />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {current.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
          <Calendar size={13} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" />
          <div>
            <strong className="text-[var(--color-neutral-dark)]">Retention Schedule aktif:</strong>{' '}
            Perhitungan retensi menggunakan tanggal pembuatan record. Sebelum disposisi, wajib
            membuat Berita Acara Pemusnahan yang ditandatangani MR dan Legal.
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle hint="Ringkasan lifecycle records">Legenda Fase</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e3f1ea] text-[#1d6e48]">
                <Clock size={14} />
              </div>
              <div className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">Aktif</div>
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">
              Records masih dalam masa retensi & bisa diakses tim operasional harian.
            </p>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fdf1dc] text-[#b9791c]">
                <Archive size={14} />
              </div>
              <div className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">Archive</div>
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">
              Records dipindah ke cold storage / arsip pasif — hanya diakses saat audit.
            </p>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#fbe7e6] text-[#b23b3a]">
                <Trash2 size={14} />
              </div>
              <div className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">Disposition</div>
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">
              Melewati masa retensi — dijadwalkan pemusnahan dengan Berita Acara.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
