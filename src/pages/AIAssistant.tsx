import { useMemo, useState } from 'react'
import { Bot, MessageSquare, Paperclip, Plus, Send, Sparkles, User } from 'lucide-react'
import { Button, Card, PageHeader, SectionTitle, inputClass } from '../components/ui'

type Message = { id: string; role: 'user' | 'assistant'; text: string; time: string }
type Thread = { id: string; title: string; updated: string; preview: string; messages: Message[] }

const THREADS: Thread[] = [
  {
    id: 't1',
    title: 'Draft SOP Penanganan NCP',
    updated: '2026-08-19 10:14',
    preview: 'Bantu susun draft SOP Penanganan Produk Tidak Sesuai berbasis ISO 9001 klausul 8.7…',
    messages: [
      { id: 'm1', role: 'user', text: 'Bantu susun draft SOP Penanganan Produk Tidak Sesuai (NCP) berbasis ISO 9001 klausul 8.7. Fokus untuk industri manufaktur consumer goods.', time: '10:02' },
      { id: 'm2', role: 'assistant', text: 'Tentu. Berikut kerangka draft SOP-NCP-001 yang saya sarankan:\n\n1. Tujuan — memastikan produk yang tidak memenuhi persyaratan tidak sampai ke pelanggan.\n2. Ruang Lingkup — mencakup incoming, in-process, dan outgoing quality.\n3. Definisi — NCP, karantina, disposisi.\n4. Tanggung Jawab — QC Inspector, QC Manager, Production, MR.\n5. Prosedur — identifikasi, isolasi, evaluasi, disposisi (rework/regrade/scrap), rekaman.\n6. Rekaman terkait — FM-QC-005 Laporan NCP, FM-QC-006 Disposisi.\n\nApakah Anda ingin saya elaborasi tahap disposisi?', time: '10:03' },
      { id: 'm3', role: 'user', text: 'Iya tolong elaborasi tahap disposisi dan tambahkan kriteria untuk rework vs scrap.', time: '10:08' },
      { id: 'm4', role: 'assistant', text: 'Tahap Disposisi (5.4):\n\na. QC Manager mengevaluasi NCP berdasarkan kriteria berikut:\n   - Rework: cacat minor, dapat diperbaiki tanpa mengubah spesifikasi (misal: label bengkok, isi kurang <2%).\n   - Regrade: cacat kosmetik yang masih memenuhi spec fungsional (misal: warna sedikit off, tapi safety OK).\n   - Scrap: cacat major/critical (misal: kontaminasi, cacat struktural, gagal uji safety).\n\nb. Keputusan disposisi didokumentasikan dalam FM-QC-006 dengan approval QC Manager (rework/regrade) atau MR (scrap >1M IDR).\n\nc. Untuk scrap, koordinasikan dengan HSE untuk pemusnahan sesuai kategori limbah.\n\nMau saya generate juga flowchart-nya?', time: '10:14' },
    ],
  },
  {
    id: 't2',
    title: 'Ringkasan Manual Mutu MM-01',
    updated: '2026-08-18 15:47',
    preview: 'Ringkas Manual Mutu Terintegrasi versi 5.0 dalam 5 poin utama untuk induksi karyawan baru.',
    messages: [
      { id: 'm5', role: 'user', text: 'Ringkas Manual Mutu Terintegrasi MM-01 versi 5.0 dalam 5 poin utama, target audience karyawan baru saat induksi.', time: '15:30' },
      { id: 'm6', role: 'assistant', text: '5 poin ringkasan Manual Mutu Terintegrasi (MM-01 v5.0):\n\n1. Ruang Lingkup: Sistem manajemen terintegrasi (Mutu-Lingkungan-K3) mencakup seluruh proses bisnis dari penerimaan bahan baku hingga distribusi produk jadi.\n\n2. Kebijakan Terintegrasi: Manajemen berkomitmen pada mutu produk, minimalisasi dampak lingkungan, dan keselamatan kerja (zero accident target).\n\n3. Struktur Proses: 4 klaster proses — Manajemen, Utama (Operasional), Pendukung, dan Pengukuran/Perbaikan.\n\n4. Peran & Tanggung Jawab: Direktur Utama sebagai Top Management, MR sebagai koordinator sistem, Kepala Departemen sebagai proses owner.\n\n5. Perbaikan Berkelanjutan: Siklus PDCA diterapkan lewat audit internal, tinjauan manajemen (2x/tahun), CAPA, dan analisis data KPI.\n\nMau saya buatkan handout PDF-nya?', time: '15:35' },
      { id: 'm7', role: 'user', text: 'Boleh. Format A4 landscape dengan 5 slide + logo perusahaan di header.', time: '15:47' },
      { id: 'm8', role: 'assistant', text: 'Baik, saya sudah generate draft handout di attachment (handout-mm-01-induksi.pdf, 5 halaman A4 landscape, siap diprint). Silakan review dan konfirmasi jika perlu revisi konten atau layout.', time: '15:47' },
    ],
  },
  { id: 't3', title: 'Analisis gap ISO 27001 vs SOP IT', updated: '2026-08-17 09:12', preview: 'Bandingkan klausul kontrol keamanan informasi ISO 27001…', messages: [] },
  { id: 't4', title: 'Format Berita Acara Pemusnahan', updated: '2026-08-15 14:03', preview: 'Susun format berita acara pemusnahan dokumen sesuai retention schedule…', messages: [] },
  { id: 't5', title: 'Root cause analysis kecelakaan kerja', updated: '2026-08-14 11:20', preview: 'Bantu identifikasi root cause insiden pada Line-3 dengan metode 5-Why…', messages: [] },
  { id: 't6', title: 'Cari dokumen tentang training K3', updated: '2026-08-12 08:45', preview: 'Cari semua SOP dan IK yang terkait dengan program training K3 tahunan.', messages: [] },
  { id: 't7', title: 'Draft kebijakan whistleblowing', updated: '2026-08-10 16:30', preview: 'Bantu susun draft kebijakan whistleblowing berbasis ISO 37001…', messages: [] },
]

const SUGGESTIONS = [
  'Bantu susun SOP…',
  'Cari dokumen tentang…',
  'Ringkas manual mutu',
  'Analisis gap standar',
]

function MessageBubble({ m }: { m: Message }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]'
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-[var(--color-brand-primary)] text-white'
              : 'rounded-tl-sm border border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-dark)]'
          }`}
        >
          {m.text.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {line}
            </p>
          ))}
        </div>
        <div className="mt-1 text-[10.5px] text-[var(--color-neutral-soft)]">{m.time}</div>
      </div>
    </div>
  )
}

export function AIAssistantPage() {
  const [activeId, setActiveId] = useState<string>('t1')
  const [input, setInput] = useState('')
  const [draftMessages, setDraftMessages] = useState<Record<string, Message[]>>({})

  const active = useMemo(() => THREADS.find((t) => t.id === activeId)!, [activeId])
  const messages = useMemo(
    () => [...active.messages, ...(draftMessages[activeId] ?? [])],
    [active, draftMessages, activeId]
  )

  function send() {
    const text = input.trim()
    if (!text) return
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const user: Message = { id: `u${Date.now()}`, role: 'user', text, time }
    const ai: Message = { id: `a${Date.now() + 1}`, role: 'assistant', text: 'Baik, sedang saya proses berdasarkan konteks dokumen EDMS Anda…', time }
    setDraftMessages((d) => ({ ...d, [activeId]: [...(d[activeId] ?? []), user, ai] }))
    setInput('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="AI Assistant"
        title="Asisten AI EDMS"
        subtitle="Asisten berbasis AI untuk membantu penyusunan draft dokumen, pencarian pintar, ringkasan, dan analisis kepatuhan ISO."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="lg:sticky lg:top-4 lg:h-fit">
          <SectionTitle
            hint={`${THREADS.length} percakapan`}
            action={<Button size="sm" variant="primary"><Plus size={12} /> Baru</Button>}
          >
            Percakapan
          </SectionTitle>

          <ul className="space-y-1">
            {THREADS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActiveId(t.id)}
                  className={`flex w-full flex-col rounded-md px-2 py-2 text-left transition ${
                    t.id === activeId
                      ? 'bg-[var(--color-brand-primary-soft)]'
                      : 'hover:bg-[var(--color-neutral-bg-soft)]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-[12.5px] font-semibold ${t.id === activeId ? 'text-[var(--color-brand-primary-dark)]' : 'text-[var(--color-neutral-dark)]'}`}>
                      {t.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-neutral-soft)]">
                      {t.updated.split(' ')[0].slice(5)}
                    </span>
                  </div>
                  <span className="mt-0.5 line-clamp-2 text-[11px] text-[var(--color-neutral-medium)]">
                    {t.preview}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card padded={false} className="flex min-h-[540px] flex-col">
          <div className="flex items-center gap-3 border-b border-[var(--color-neutral-border)] px-5 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
              <MessageSquare size={16} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-[var(--color-neutral-dark)]">{active.title}</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Diperbarui {active.updated}</div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto bg-[var(--color-neutral-bg-soft)] px-5 py-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] shadow-[var(--shadow-card)]">
                  <Sparkles size={20} />
                </div>
                <p className="text-[13px] font-semibold text-[var(--color-neutral-dark)]">Mulai percakapan</p>
                <p className="mt-1 max-w-sm text-[11.5px] text-[var(--color-neutral-medium)]">
                  Tanyakan apa saja seputar dokumen EDMS, standar ISO, atau minta bantuan menyusun draft.
                </p>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} m={m} />)
            )}
          </div>

          <div className="border-t border-[var(--color-neutral-border)] px-5 py-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s + ' ')}
                  className="rounded-full border border-[var(--color-neutral-border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-neutral-dark)] transition hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-dark)]"
                >
                  <Sparkles size={10} className="mr-1 inline text-[var(--color-brand-primary)]" />
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg-soft)]">
                <Paperclip size={15} />
              </button>
              <textarea
                rows={2}
                className={inputClass + ' resize-none'}
                placeholder="Ketik pesan Anda… (Enter untuk kirim, Shift+Enter untuk baris baru)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <Button variant="primary" onClick={send} disabled={!input.trim()}>
                <Send size={14} /> Kirim
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
