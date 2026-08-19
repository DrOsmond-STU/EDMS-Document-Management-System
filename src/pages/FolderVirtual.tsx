import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Search,
  User,
} from 'lucide-react'
import { Card, EmptyState, PageHeader, SectionTitle, inputClass } from '../components/ui'

type FolderNode = {
  id: string
  name: string
  owner: string
  tags: string[]
  count: number
  children?: FolderNode[]
  docs?: { id: string; code: string; title: string; version: string; updated: string }[]
}

const TREE: FolderNode[] = [
  {
    id: 'prosedur',
    name: 'Prosedur',
    owner: 'Manajemen Mutu',
    tags: ['ISO 9001'],
    count: 42,
    children: [
      {
        id: 'prosedur-op',
        name: 'SOP Operasional',
        owner: 'Operasional',
        tags: ['ISO 9001', 'SNI'],
        count: 18,
        docs: [
          { id: 'd1', code: 'SOP-OP-001', title: 'Prosedur Penerimaan Bahan Baku', version: 'v3.2', updated: '2026-06-14' },
          { id: 'd2', code: 'SOP-OP-004', title: 'Prosedur Kontrol Kualitas Produksi', version: 'v2.8', updated: '2026-05-27' },
          { id: 'd3', code: 'SOP-OP-011', title: 'Prosedur Penanganan NCP', version: 'v4.1', updated: '2026-07-02' },
          { id: 'd4', code: 'SOP-OP-014', title: 'Prosedur Pengelolaan Gudang', version: 'v2.4', updated: '2026-04-19' },
        ],
      },
      {
        id: 'prosedur-support',
        name: 'SOP Support',
        owner: 'HR & GA',
        tags: ['ISO 9001'],
        count: 14,
        docs: [
          { id: 'd5', code: 'SOP-HR-002', title: 'Prosedur Rekrutmen Karyawan', version: 'v2.1', updated: '2026-05-11' },
          { id: 'd6', code: 'SOP-IT-005', title: 'Prosedur Backup & Recovery', version: 'v1.8', updated: '2026-06-30' },
          { id: 'd7', code: 'SOP-FN-003', title: 'Prosedur Pembayaran Vendor', version: 'v3.0', updated: '2026-03-21' },
        ],
      },
      {
        id: 'prosedur-hse',
        name: 'SOP K3L (HSE)',
        owner: 'HSE Manager',
        tags: ['ISO 45001', 'SMK3'],
        count: 10,
        docs: [
          { id: 'd8', code: 'SOP-HSE-001', title: 'Prosedur Investigasi Kecelakaan Kerja', version: 'v2.5', updated: '2026-06-08' },
          { id: 'd9', code: 'SOP-HSE-006', title: 'Prosedur JSA (Job Safety Analysis)', version: 'v1.9', updated: '2026-04-27' },
        ],
      },
    ],
  },
  {
    id: 'ik',
    name: 'Instruksi Kerja',
    owner: 'Manajer Departemen',
    tags: ['ISO 9001'],
    count: 27,
    children: [
      {
        id: 'ik-produksi',
        name: 'IK Produksi',
        owner: 'Supervisor Produksi',
        tags: ['ISO 9001'],
        count: 15,
        docs: [
          { id: 'd10', code: 'IK-PRD-003', title: 'IK Setup Mesin Injection', version: 'v1.4', updated: '2026-05-02' },
          { id: 'd11', code: 'IK-PRD-007', title: 'IK Inspeksi Visual Produk Jadi', version: 'v2.0', updated: '2026-06-19' },
          { id: 'd12', code: 'IK-PRD-012', title: 'IK Kalibrasi Timbangan Digital', version: 'v1.1', updated: '2026-03-14' },
        ],
      },
      {
        id: 'ik-lab',
        name: 'IK Laboratorium',
        owner: 'QC Lab',
        tags: ['ISO 17025'],
        count: 12,
        docs: [
          { id: 'd13', code: 'IK-LAB-002', title: 'IK Uji Kadar Air Metode Oven', version: 'v3.1', updated: '2026-06-12' },
          { id: 'd14', code: 'IK-LAB-009', title: 'IK Uji pH Sample Air', version: 'v2.2', updated: '2026-05-08' },
        ],
      },
    ],
  },
  {
    id: 'formulir',
    name: 'Formulir',
    owner: 'Semua Fungsi',
    tags: ['ISO 9001'],
    count: 68,
    children: [
      {
        id: 'formulir-produksi',
        name: 'Formulir Produksi',
        owner: 'Produksi',
        tags: ['ISO 9001'],
        count: 22,
        docs: [
          { id: 'd15', code: 'FM-PRD-001', title: 'Form Laporan Produksi Harian', version: 'v2.0', updated: '2026-01-05' },
          { id: 'd16', code: 'FM-PRD-004', title: 'Form Penerimaan Bahan Baku', version: 'v1.8', updated: '2026-02-14' },
        ],
      },
      {
        id: 'formulir-hse',
        name: 'Formulir K3L',
        owner: 'HSE',
        tags: ['ISO 45001'],
        count: 18,
        docs: [
          { id: 'd17', code: 'FM-HSE-002', title: 'Form Laporan Nearmiss', version: 'v1.3', updated: '2026-04-11' },
          { id: 'd18', code: 'FM-HSE-005', title: 'Form Investigasi Insiden', version: 'v2.1', updated: '2026-05-30' },
        ],
      },
      {
        id: 'formulir-hr',
        name: 'Formulir HR',
        owner: 'HR',
        tags: ['ISO 9001'],
        count: 14,
        docs: [
          { id: 'd19', code: 'FM-HR-001', title: 'Form Lembur Karyawan', version: 'v1.6', updated: '2026-03-19' },
        ],
      },
    ],
  },
  {
    id: 'rekaman',
    name: 'Rekaman',
    owner: 'Semua Fungsi',
    tags: ['ISO 9001'],
    count: 156,
    children: [
      {
        id: 'rekaman-audit',
        name: 'Rekaman Audit',
        owner: 'MR / Sekretariat ISO',
        tags: ['ISO 9001', 'ISO 45001'],
        count: 32,
        docs: [
          { id: 'd20', code: 'REC-AUD-2026-014', title: 'Laporan Audit Internal Q2 2026', version: 'v1.0', updated: '2026-07-15' },
          { id: 'd21', code: 'REC-AUD-2026-010', title: 'Ceklis Audit Departemen Produksi', version: 'v1.0', updated: '2026-05-22' },
        ],
      },
      {
        id: 'rekaman-training',
        name: 'Rekaman Pelatihan',
        owner: 'HR',
        tags: ['ISO 9001'],
        count: 41,
        docs: [
          { id: 'd22', code: 'REC-TRN-2026-08', title: 'Absensi Training K3 Batch Juli', version: 'v1.0', updated: '2026-07-20' },
        ],
      },
    ],
  },
  {
    id: 'manual',
    name: 'Manual',
    owner: 'Management Representative',
    tags: ['ISO 9001', 'ISO 14001', 'ISO 45001'],
    count: 6,
    docs: [
      { id: 'd23', code: 'MM-01', title: 'Manual Mutu Terintegrasi (IMS)', version: 'v5.0', updated: '2026-02-01' },
      { id: 'd24', code: 'MM-02', title: 'Manual Lingkungan', version: 'v3.2', updated: '2026-03-11' },
      { id: 'd25', code: 'MM-03', title: 'Manual K3', version: 'v3.0', updated: '2026-03-11' },
    ],
  },
  {
    id: 'kebijakan',
    name: 'Kebijakan',
    owner: 'Direksi',
    tags: ['ISO 9001', 'ISO 37001'],
    count: 12,
    docs: [
      { id: 'd26', code: 'KEB-001', title: 'Kebijakan Mutu, Lingkungan, dan K3', version: 'v4.0', updated: '2026-01-15' },
      { id: 'd27', code: 'KEB-005', title: 'Kebijakan Anti Penyuapan', version: 'v2.0', updated: '2026-02-22' },
      { id: 'd28', code: 'KEB-007', title: 'Kebijakan Whistleblowing', version: 'v1.3', updated: '2026-01-30' },
    ],
  },
]

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-neutral-border)] bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
      {children}
    </span>
  )
}

export function FolderVirtualPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ prosedur: true, formulir: true })
  const [selected, setSelected] = useState<FolderNode>(TREE[0].children![0])
  const [q, setQ] = useState('')

  const totals = useMemo(() => {
    let folders = 0
    let docs = 0
    const walk = (nodes: FolderNode[]) => {
      for (const n of nodes) {
        folders++
        docs += n.count
        if (n.children) walk(n.children)
      }
    }
    walk(TREE)
    return { folders, docs }
  }, [])

  function toggle(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  function renderNode(node: FolderNode, depth = 0) {
    const isOpen = expanded[node.id]
    const hasChild = !!node.children?.length
    const isSelected = selected.id === node.id
    const kw = q.trim().toLowerCase()
    const match = !kw || node.name.toLowerCase().includes(kw) || node.owner.toLowerCase().includes(kw)
    if (kw && !match && !hasChild) return null
    return (
      <div key={node.id}>
        <button
          onClick={() => {
            setSelected(node)
            if (hasChild) toggle(node.id)
          }}
          style={{ paddingLeft: 8 + depth * 16 }}
          className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12.5px] transition-colors hover:bg-[var(--color-neutral-bg-soft)] ${
            isSelected ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]' : ''
          }`}
        >
          <span className="text-[var(--color-neutral-medium)]">
            {hasChild ? (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="inline-block w-3" />}
          </span>
          <span className="text-[var(--color-brand-primary)]">
            {isOpen && hasChild ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
          <span className="flex-1 truncate font-semibold">{node.name}</span>
          <span className="tabular-nums text-[11px] text-[var(--color-neutral-medium)]">{node.count}</span>
        </button>
        {hasChild && isOpen && (
          <div className="mt-0.5">{node.children!.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Struktur Dokumen"
        title="Folder Virtual & Kategori"
        subtitle="Struktur folder virtual berbasis hirarki dokumen ISO — Prosedur, Instruksi Kerja, Formulir, Rekaman, Manual, dan Kebijakan."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
            <Folder size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{totals.folders}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Total Folder</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3fb] text-[#2a6fb3]">
            <FileText size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{totals.docs}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Total Dokumen</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1ea] text-[#1d6e48]">
            <User size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">7</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Kategori Utama</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf1dc] text-[#b9791c]">
            <FileText size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">12</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Sub-folder</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle hint="Klik untuk expand & pilih">Pohon Kategori</SectionTitle>
          <div className="relative mb-3">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
            <input
              className={inputClass + ' pl-8'}
              placeholder="Cari folder…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="space-y-0.5">{TREE.map((n) => renderNode(n))}</div>
        </Card>

        <Card className="lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                Preview Folder
              </div>
              <h3 className="text-[16px] font-bold text-[var(--color-neutral-dark)]">{selected.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-[var(--color-neutral-medium)]">
                <User size={12} /> {selected.owner}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {selected.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-2 text-center">
              <div className="text-[16px] font-bold tabular-nums">{selected.count}</div>
              <div className="text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">Dokumen</div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-2 text-center">
              <div className="text-[16px] font-bold tabular-nums">{selected.children?.length ?? 0}</div>
              <div className="text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">Sub-folder</div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-2 text-center">
              <div className="text-[16px] font-bold tabular-nums">{selected.tags.length}</div>
              <div className="text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">Standar</div>
            </div>
          </div>

          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
            Contoh Dokumen ({(selected.docs ?? []).length})
          </div>
          {(selected.docs ?? []).length === 0 ? (
            <EmptyState
              title="Belum ada preview dokumen"
              description="Pilih sub-folder untuk melihat contoh dokumen di dalamnya."
              icon={<FileText size={18} />}
            />
          ) : (
            <ul className="space-y-2">
              {selected.docs!.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start gap-3 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 transition hover:border-[var(--color-brand-primary)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{d.code}</span>
                      <span className="text-[10.5px] text-[var(--color-neutral-soft)]">Update {d.updated}</span>
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--color-neutral-dark)]">{d.title}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--color-neutral-medium)]">Versi {d.version}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
