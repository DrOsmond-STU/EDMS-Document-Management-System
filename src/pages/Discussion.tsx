import { useMemo, useState } from 'react'
import { CornerDownRight, MessageCircle, Send, Users } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, SectionTitle, inputClass } from '../components/ui'

type Comment = {
  id: string
  author: string
  role: string
  time: string
  text: string
  replies?: Comment[]
}

type DocDiscussion = {
  id: string
  docCode: string
  title: string
  category: string
  lastActivity: string
  participants: { name: string; color: string }[]
  totalComments: number
  thread: Comment[]
}

const COLORS = ['#378add', '#0e7c86', '#7f77df', '#ef9f27', '#1d6e48', '#b23b3a']

const DISCUSSIONS: DocDiscussion[] = [
  {
    id: 'd1',
    docCode: 'SOP-OP-011',
    title: 'Prosedur Penanganan Produk Tidak Sesuai (NCP)',
    category: 'Operasional',
    lastActivity: '2026-08-19 10:20',
    totalComments: 5,
    participants: [
      { name: 'Andi P', color: COLORS[0] },
      { name: 'Sri M', color: COLORS[1] },
      { name: 'Budi S', color: COLORS[2] },
      { name: 'Rina H', color: COLORS[3] },
    ],
    thread: [
      { id: 'c1', author: 'Andi Pratama', role: 'QC Manager', time: '2 hari lalu', text: 'Menurut saya kriteria disposisi di section 5.4 masih terlalu subjektif. Bisakah kita tambahkan matriks keputusan?', replies: [
        { id: 'c1r1', author: 'Sri Mulyani', role: 'MR', time: '2 hari lalu', text: 'Setuju. Saya usulkan tabel keputusan berdasarkan tingkat cacat (minor/major/critical) × biaya rework.' },
        { id: 'c1r2', author: 'Budi Setiawan', role: 'QC Lead', time: '1 hari lalu', text: 'Bisa juga dilengkapi flowchart supaya operator lapangan mudah paham.' },
      ] },
      { id: 'c2', author: 'Rina Hasanah', role: 'Production Head', time: '1 hari lalu', text: 'Bagaimana handling untuk produk rework yang sudah melalui QC kedua? Perlu ada tagging khusus supaya tidak tercampur.' },
      { id: 'c3', author: 'Andi Pratama', role: 'QC Manager', time: '3 jam lalu', text: 'Draft revisi v3.3 sudah saya upload dengan matriks disposisi + flowchart. Mohon review Bu Sri.' },
    ],
  },
  {
    id: 'd2',
    docCode: 'KEB-001',
    title: 'Kebijakan Mutu, Lingkungan, dan K3',
    category: 'Manajemen',
    lastActivity: '2026-08-18 14:12',
    totalComments: 8,
    participants: [
      { name: 'Direktur', color: COLORS[0] },
      { name: 'Sri M', color: COLORS[1] },
      { name: 'HSE Mgr', color: COLORS[3] },
    ],
    thread: [
      { id: 'c4', author: 'Direktur Operasional', role: 'Direksi', time: '1 minggu lalu', text: 'Kebijakan perlu memuat komitmen net-zero 2030 sesuai visi baru perusahaan.' },
      { id: 'c5', author: 'HSE Manager', role: 'HSE', time: '5 hari lalu', text: 'Setuju. Saya usulkan menambahkan poin: "Berupaya mencapai emisi net-zero pada 2030 melalui efisiensi energi dan energi terbarukan."', replies: [
        { id: 'c5r1', author: 'Sri Mulyani', role: 'MR', time: '4 hari lalu', text: 'Kalimat itu sudah bagus. Saya masukkan sebagai poin ke-5 di draft revisi v4.1.' },
      ] },
      { id: 'c6', author: 'Environmental Officer', role: 'HSE', time: '3 hari lalu', text: 'Bagaimana dengan target reduksi limbah B3? Perlu ditambahkan juga?' },
    ],
  },
  {
    id: 'd3',
    docCode: 'SOP-HSE-006',
    title: 'SOP JSA (Job Safety Analysis) & HIRADC',
    category: 'K3',
    lastActivity: '2026-08-17 08:30',
    totalComments: 4,
    participants: [
      { name: 'HSE Off', color: COLORS[3] },
      { name: 'Sup Prod', color: COLORS[2] },
    ],
    thread: [
      { id: 'c7', author: 'HSE Officer', role: 'HSE', time: '4 hari lalu', text: 'Format JSA saat ini masih menggunakan spreadsheet. Bisa digantikan dengan template digital?' },
      { id: 'c8', author: 'Supervisor Produksi', role: 'Produksi', time: '3 hari lalu', text: 'Digital lebih baik. Bisa terintegrasi dengan permit-to-work di lapangan.' },
    ],
  },
  {
    id: 'd4',
    docCode: 'SOP-IT-010',
    title: 'SOP Keamanan Informasi & ISMS',
    category: 'IT',
    lastActivity: '2026-08-16 16:22',
    totalComments: 6,
    participants: [
      { name: 'IT Sec', color: COLORS[0] },
      { name: 'Legal', color: COLORS[5] },
      { name: 'MR', color: COLORS[1] },
    ],
    thread: [
      { id: 'c9', author: 'IT Security', role: 'IT', time: '5 hari lalu', text: 'ISO 27001 klausul A.5.34 tentang privasi data personal perlu diselaraskan dengan UU PDP.' },
      { id: 'c10', author: 'Legal Officer', role: 'Legal', time: '4 hari lalu', text: 'Betul. Saya bantu susun mapping antara kontrol ISO 27001:2022 dengan pasal UU PDP.' },
    ],
  },
  {
    id: 'd5',
    docCode: 'IK-LAB-002',
    title: 'IK Uji Kadar Air Metode Oven',
    category: 'Laboratorium',
    lastActivity: '2026-08-15 09:45',
    totalComments: 3,
    participants: [
      { name: 'QC Lab', color: COLORS[1] },
      { name: 'QA', color: COLORS[3] },
    ],
    thread: [
      { id: 'c11', author: 'QC Lab Analyst', role: 'QC', time: '6 hari lalu', text: 'Toleransi ±0.05% pada penimbangan sample perlu ditegaskan. Saat ini beberapa analis pakai ±0.1%.' },
      { id: 'c12', author: 'QA Supervisor', role: 'QA', time: '5 hari lalu', text: 'Setuju, saya sinkronkan dengan spec di ISO 17025 clause 7.6. Revisi menyusul.' },
    ],
  },
  {
    id: 'd6',
    docCode: 'SOP-HR-002',
    title: 'Prosedur Rekrutmen Karyawan',
    category: 'HR',
    lastActivity: '2026-08-14 11:00',
    totalComments: 5,
    participants: [
      { name: 'HR Mgr', color: COLORS[2] },
      { name: 'HR Ops', color: COLORS[0] },
      { name: 'User Ops', color: COLORS[4] },
    ],
    thread: [
      { id: 'c13', author: 'HR Manager', role: 'HR', time: '1 minggu lalu', text: 'Tahap MCU perlu ditambahkan sebelum offering letter, terutama untuk posisi produksi.' },
      { id: 'c14', author: 'HR Operations', role: 'HR', time: '5 hari lalu', text: 'Saya set MCU sebagai gate #4 sebelum offering. Ada pertimbangan waktu tunggu ±3 hari.' },
    ],
  },
  {
    id: 'd7',
    docCode: 'FM-HSE-002',
    title: 'Form Laporan Nearmiss',
    category: 'K3',
    lastActivity: '2026-08-13 15:20',
    totalComments: 4,
    participants: [
      { name: 'HSE Off', color: COLORS[3] },
      { name: 'Sup', color: COLORS[0] },
    ],
    thread: [
      { id: 'c15', author: 'HSE Officer', role: 'HSE', time: '2 minggu lalu', text: 'Form perlu tambahan kolom "tindakan pencegahan sementara" agar segera dieksekusi Supervisor.' },
    ],
  },
  {
    id: 'd8',
    docCode: 'REC-AUD-2026-014',
    title: 'Laporan Audit Internal Q2 2026',
    category: 'Audit',
    lastActivity: '2026-08-12 08:15',
    totalComments: 7,
    participants: [
      { name: 'Lead Aud', color: COLORS[0] },
      { name: 'MR', color: COLORS[1] },
      { name: 'HoD', color: COLORS[2] },
      { name: 'HoD', color: COLORS[3] },
    ],
    thread: [
      { id: 'c16', author: 'Lead Auditor', role: 'Auditor', time: '3 minggu lalu', text: 'Ditemukan 3 major dan 8 minor. Perlu diskusi target closing bersama HoD terkait.' },
      { id: 'c17', author: 'MR', role: 'MR', time: '2 minggu lalu', text: 'Saya jadwalkan CAPA meeting minggu depan. Semua PIC major finding wajib hadir.' },
    ],
  },
]

function Avatar({ p, size = 26 }: { p: { name: string; color: string }; size?: number }) {
  const initials = p.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-white ring-2 ring-white"
      style={{ width: size, height: size, backgroundColor: p.color, fontSize: size * 0.42, fontWeight: 700 }}
      title={p.name}
    >
      {initials}
    </div>
  )
}

function CommentNode({ c, depth = 0 }: { c: Comment; depth?: number }) {
  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <div className="flex items-start gap-2.5">
        {depth > 0 && <CornerDownRight size={12} className="mt-2 shrink-0 text-[var(--color-neutral-soft)]" />}
        <div className="flex-1 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <span className="text-[12.5px] font-bold text-[var(--color-neutral-dark)]">{c.author}</span>
              <span className="ml-1.5 rounded-full border border-[var(--color-neutral-border)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                {c.role}
              </span>
            </div>
            <span className="text-[10.5px] text-[var(--color-neutral-soft)]">{c.time}</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">{c.text}</p>
        </div>
      </div>
      {c.replies?.length ? (
        <div className="mt-2 space-y-2">
          {c.replies.map((r) => <CommentNode key={r.id} c={r} depth={depth + 1} />)}
        </div>
      ) : null}
    </div>
  )
}

export function DiscussionPage() {
  const [selectedId, setSelectedId] = useState<string>(DISCUSSIONS[0].id)
  const [reply, setReply] = useState('')

  const selected = useMemo(() => DISCUSSIONS.find((d) => d.id === selectedId)!, [selectedId])

  const totals = {
    docs: DISCUSSIONS.length,
    comments: DISCUSSIONS.reduce((s, d) => s + d.totalComments, 0),
    participants: new Set(DISCUSSIONS.flatMap((d) => d.participants.map((p) => p.name))).size,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Kolaborasi"
        title="Comment & Discussion"
        subtitle="Diskusi kolaboratif seputar dokumen — usulan revisi, klarifikasi klausul, dan tindak lanjut audit dalam satu tempat."
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
            <MessageCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{totals.docs}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Diskusi Aktif</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1ea] text-[#1d6e48]">
            <MessageCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{totals.comments}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Total Komentar</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf1dc] text-[#b9791c]">
            <Users size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{totals.participants}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Kontributor</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionTitle hint="Klik untuk buka thread">Dokumen dengan Diskusi</SectionTitle>
          <ul className="space-y-2.5">
            {DISCUSSIONS.map((d) => {
              const isActive = d.id === selectedId
              return (
                <li key={d.id}>
                  <button
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isActive
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)]'
                        : 'border-[var(--color-neutral-border)] bg-white hover:border-[var(--color-neutral-border-strong)]'
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-[10.5px] text-[var(--color-neutral-medium)]">{d.docCode}</span>
                      <span className="rounded-full border border-[var(--color-neutral-border)] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                        {d.category}
                      </span>
                    </div>
                    <div className="mb-2 text-[13px] font-bold text-[var(--color-neutral-dark)]">{d.title}</div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex -space-x-1.5">
                        {d.participants.slice(0, 4).map((p, i) => <Avatar key={i} p={p} />)}
                        {d.participants.length > 4 && (
                          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--color-neutral-bg)] text-[10px] font-bold text-[var(--color-neutral-medium)] ring-2 ring-white">
                            +{d.participants.length - 4}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-neutral-medium)]">
                        <span className="flex items-center gap-1"><MessageCircle size={11} /> {d.totalComments}</span>
                        <span>{d.lastActivity.slice(5, 16)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <Card className="lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-neutral-border)] pb-3">
            <div>
              <div className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{selected.docCode}</div>
              <h3 className="text-[15px] font-bold text-[var(--color-neutral-dark)]">{selected.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-neutral-medium)]">
                <Users size={12} /> {selected.participants.length} kontributor · Update {selected.lastActivity}
              </div>
            </div>
            <div className="flex -space-x-1.5">
              {selected.participants.map((p, i) => <Avatar key={i} p={p} size={30} />)}
            </div>
          </div>

          {selected.thread.length === 0 ? (
            <EmptyState title="Belum ada komentar" description="Jadilah yang pertama memberi masukan." icon={<MessageCircle size={18} />} />
          ) : (
            <div className="mb-3 space-y-3">
              {selected.thread.map((c) => <CommentNode key={c.id} c={c} />)}
            </div>
          )}

          <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] bg-[var(--color-neutral-bg-soft)] p-3">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Tambah Komentar
            </div>
            <textarea
              rows={2}
              className={inputClass + ' resize-none bg-white'}
              placeholder="Tulis komentar atau masukan Anda…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="mt-2 flex justify-end">
              <Button variant="primary" size="sm" disabled={!reply.trim()} onClick={() => setReply('')}>
                <Send size={12} /> Kirim
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
