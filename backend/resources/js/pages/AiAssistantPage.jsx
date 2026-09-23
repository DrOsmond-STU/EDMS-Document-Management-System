import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Copy, FileText, GitBranch, History, Loader2, PenLine, Scale, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Button, Card, ConfirmDelete, Field, IconAction, inputClass, Modal, StandardChip, useConfirmDelete } from '../components/ui'
import { CLASSIFICATION_LABEL, dt, errorText } from './drafting/shared'

const ACTION_LABEL = {
  buat_baru: 'Buat dokumen baru',
  revisi_dokumen_ada: 'Revisi dokumen yang sudah ada',
  gunakan_dokumen_ada: 'Gunakan dokumen yang sudah ada',
}
const CLASSIFICATIONS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret']
const DRAFT_STATUS = { requested: 'Permintaan', in_progress: 'Disusun', finalized: 'Menunggu pengesahan' }

function AiLabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf1dc] px-2.5 py-0.5 text-[10.5px] font-bold text-[#9a5b0b]">
      <Sparkles size={11} /> Rekomendasi AI — perlu tinjauan
    </span>
  )
}

function Thinking({ text }) {
  return (
    <Card>
      <div className="flex items-center gap-3 text-[13px] text-[var(--color-neutral-dark)]">
        <Loader2 size={18} className="animate-spin text-[var(--color-brand-primary)]" />
        <div>
          <div className="font-semibold">{text}</div>
          <div className="text-[11.5px] text-[var(--color-neutral-medium)]">Biasanya 10–60 detik. Jangan tutup halaman ini.</div>
        </div>
      </div>
    </Card>
  )
}

function Section({ title, icon: Icon, children, right }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{Icon && <Icon size={12} />} {title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="text-[12px] text-[var(--color-neutral-medium)]">{children}</p>
}

function LegalList({ items }) {
  if (!items?.length) return <Empty>Tidak ada peraturan di Legal Register yang dinilai terkait.</Empty>
  return (
    <ul className="space-y-1.5">
      {items.map((l) => (
        <li key={l.code} className="text-[12.5px]">
          <Link to={`/legal-register?q=${encodeURIComponent(l.code)}`} className="font-semibold hover:text-[var(--color-brand-primary)]">
            <span className="font-mono text-[11px] text-[var(--color-brand-primary)]">{l.code}</span> {l.regulation_number} — {l.title}
          </Link>
          {l.why && <div className="text-[11.5px] text-[var(--color-neutral-medium)]">{l.why}</div>}
        </li>
      ))}
    </ul>
  )
}

function DroppedNote({ count }) {
  if (!count) return null
  return (
    <p className="flex items-start gap-1.5 rounded-md bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
      <ShieldCheck size={13} className="mt-0.5 shrink-0" />
      {count} referensi dari AI dibuang karena tidak cocok dengan master data (standar/klausul/Legal Register) — hanya referensi yang benar-benar ada yang ditampilkan.
    </p>
  )
}

/** Modal pengajuan permintaan penyusunan dari hasil AI — memakai alur Drafting biasa. */
function RequestModal({ open, onClose, initial, generationId, meta }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setForm({ classification: 'internal', ...initial }); setError('') }
  }, [open, initial])

  if (!open || !form) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const { hasDraft, ...body } = form // eslint-disable-line no-unused-vars
      const project = await api('drafting-projects', { method: 'POST', body: { ...body, ai_generation_id: generationId } })
      navigate(`/drafting/${project.id}`)
    } catch (err) {
      setError(errorText(err, 'Gagal mengajukan permintaan.'))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Ajukan Permintaan Penyusunan">
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
        <p className="rounded-md bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
          Permintaan masuk ke Tracking Penyusunan Dokumen dan mengikuti alur biasa (penugasan penyusun, rapat, finalisasi, pengesahan).
          {initial.hasDraft && ' Rancangan AI akan menjadi draf awal yang wajib ditinjau penyusun.'}
        </p>
        <Field label="Judul Dokumen"><input className={inputClass} value={form.title} onChange={set('title')} required maxLength={255} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jenis Dokumen">
            <select className={inputClass} value={form.doc_type} onChange={set('doc_type')}>
              {meta.doc_types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Klasifikasi Awal">
            <select className={inputClass} value={form.classification} onChange={set('classification')}>
              {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c] ?? c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Fungsi/Departemen">
          <select className={inputClass} value={form.function_id ?? ''} onChange={set('function_id')} required>
            <option value="">— Pilih —</option>
            {meta.functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Alasan / Kebutuhan"><textarea className={inputClass} rows={4} value={form.reason} onChange={set('reason')} required maxLength={5000} /></Field>
        {form.standards?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">Standar acuan: {form.standards.map((s) => <StandardChip key={s} code={s} />)}</div>
        )}
        {error && <p className="text-[12px] text-[var(--color-brand-danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Mengajukan…' : 'Ajukan Permintaan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ Pencarian & Regulasi

function DiscoverTab({ status, preset, onDraft, onRequest }) {
  const [form, setForm] = useState({ topic: '', context: '', function_id: '' })
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { if (preset) { setResult(preset.result); setForm((f) => ({ ...f, topic: preset.subject })) } }, [preset])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      setResult(await api('ai/discover', { method: 'POST', body: { ...form, function_id: form.function_id || null } }))
    } catch (err) {
      setError(errorText(err, 'Gagal memproses permintaan.'))
    } finally {
      setBusy(false)
    }
  }

  const ai = result?.ai
  const fnName = (id) => status.meta.functions.find((f) => f.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Dokumen apa yang Anda butuhkan?" hint="Contoh: prosedur tanggap darurat kebakaran di gudang bahan kimia">
            <textarea className={inputClass} rows={2} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required minLength={5} maxLength={500} />
          </Field>
          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <Field label="Konteks tambahan (opsional)">
              <textarea className={inputClass} rows={2} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} maxLength={2000} placeholder="Latar belakang, temuan audit, proses yang terlibat…" />
            </Field>
            <Field label="Fungsi pemohon (opsional)">
              <select className={inputClass} value={form.function_id} onChange={(e) => setForm({ ...form, function_id: e.target.value })}>
                <option value="">— Tidak ditentukan —</option>
                {status.meta.functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-[var(--color-neutral-medium)]">Dokumen yang sudah ada selalu dicek lebih dulu — tanpa AI pun tetap berjalan.</span>
            <Button type="submit" variant="primary" disabled={busy}><Search size={14} /> {busy ? 'Menganalisis…' : 'Cari & Rekomendasikan'}</Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-[12.5px] text-[var(--color-brand-danger)]">{error}</p>}
      {busy && <Thinking text="Mencocokkan dokumen yang ada & meminta rekomendasi AI…" />}

      {result && (
        <Card>
          <Section title="Dokumen yang sudah ada & mirip" icon={FileText}>
            {result.from_history ? <Empty>Hasil pencocokan dokumen tidak disimpan di riwayat — klik “Cari & Rekomendasikan” untuk memperbaruinya.</Empty> : result.matches.length === 0 ? <Empty>Tidak ditemukan dokumen serupa yang dapat Anda akses (kata kunci: {result.keywords.join(', ') || '—'}).</Empty> : (
              <ul className="divide-y divide-[var(--color-neutral-border)]">
                {result.matches.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-1.5">
                    <Link to={`/documents/${d.id}`} className="min-w-0 text-[12.5px] hover:text-[var(--color-brand-primary)]">
                      <span className="font-mono text-[11px] text-[var(--color-brand-primary)]">{d.code}</span> <span className="font-semibold">{d.title}</span>
                      <span className="text-[11px] text-[var(--color-neutral-medium)]"> · {d.type} · {d.function ?? '—'} · {d.status}</span>
                    </Link>
                    {d.likely_duplicate
                      ? <span className="shrink-0 rounded-full bg-[#fbe7e6] px-2 py-0.5 text-[10.5px] font-bold text-[#b23b3a]">Kemungkinan duplikat</span>
                      : <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-neutral-medium)]">{Math.round(d.score * 100)}% kata cocok</span>}
                  </li>
                ))}
              </ul>
            )}
            {result.drafts.length > 0 && (
              <div className="mt-3 rounded-md border border-[var(--color-neutral-border)] px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--color-neutral-dark)]"><GitBranch size={12} /> Permintaan penyusunan serupa yang sedang berjalan</div>
                {result.drafts.map((p) => (
                  <Link key={p.id} to={`/drafting/${p.id}`} className="block text-[12px] hover:text-[var(--color-brand-primary)]">
                    <span className="font-mono text-[11px]">{p.code}</span> {p.title} <span className="text-[var(--color-neutral-medium)]">· {DRAFT_STATUS[p.status] ?? p.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <div className="my-4 border-t border-[var(--color-neutral-border)]" />

          {result.ai_error && !ai && (
            <p className="flex items-start gap-2 rounded-md bg-[#fdf1dc] px-3 py-2 text-[12px] text-[#9a5b0b]"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {result.ai_error}</p>
          )}

          {ai && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AiLabel />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onDraft({ title: ai.proposed.title, doc_type: ai.proposed.doc_type, function_id: ai.proposed.function_id ?? '', standards: ai.proposed.standards.slice(0, 4), notes: form.topic })}>
                    <PenLine size={13} /> Rancang dengan AI
                  </Button>
                  {status.can_request && (
                    <Button size="sm" variant="primary" onClick={() => onRequest({
                      title: ai.proposed.title, doc_type: ai.proposed.doc_type, function_id: ai.proposed.function_id ?? form.function_id,
                      standards: ai.proposed.standards,
                      reason: [form.topic, ai.proposed.reason, ai.recommendation.reason].filter(Boolean).join('\n\n'),
                    }, ai.generation_id)}>
                      <GitBranch size={13} /> Ajukan Permintaan Penyusunan
                    </Button>
                  )}
                </div>
              </div>

              {ai.summary && <p className="text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{ai.summary}</p>}

              <div className="grid gap-4 md:grid-cols-2">
                <Section title="Rekomendasi tindakan">
                  <div className="text-[13px] font-bold text-[var(--color-neutral-dark)]">{ACTION_LABEL[ai.recommendation.action]}</div>
                  {ai.recommendation.document_id && (
                    <Link to={`/documents/${ai.recommendation.document_id}`} className="text-[12px] font-semibold text-[var(--color-brand-primary)]">{ai.recommendation.document_code} →</Link>
                  )}
                  <p className="mt-1 text-[12px] text-[var(--color-neutral-medium)]">{ai.recommendation.reason}</p>
                </Section>
                <Section title="Usulan dokumen">
                  <div className="text-[13px] font-bold text-[var(--color-neutral-dark)]">{ai.proposed.title || '—'}</div>
                  <div className="text-[12px] text-[var(--color-neutral-medium)]">{ai.proposed.doc_type} · {ai.proposed.function_id ? fnName(ai.proposed.function_id) : 'fungsi belum ditentukan'}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{ai.proposed.standards.map((s) => <StandardChip key={s} code={s} />)}</div>
                  {ai.proposed.reason && <p className="mt-1 text-[12px] text-[var(--color-neutral-medium)]">{ai.proposed.reason}</p>}
                </Section>
              </div>

              <Section title="Klausul standar terkait" icon={ShieldCheck}>
                {ai.clauses.length === 0 ? <Empty>Tidak ada klausul yang dinilai terkait.</Empty> : (
                  <table className="w-full text-[12.5px]">
                    <tbody className="divide-y divide-[var(--color-neutral-border)]">
                      {ai.clauses.map((c) => (
                        <tr key={`${c.standard}-${c.clause}`}>
                          <td className="w-[150px] py-1.5 align-top"><StandardChip code={c.standard} /> <span className="font-mono text-[11.5px] font-bold">{c.clause}</span></td>
                          <td className="py-1.5 align-top"><div className="font-semibold">{c.title}</div><div className="text-[11.5px] text-[var(--color-neutral-medium)]">{c.why}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              <Section title="Peraturan di Legal Register" icon={Scale}><LegalList items={ai.legal} /></Section>

              {ai.external_regulations.length > 0 && (
                <Section title="Regulasi lain yang mungkin relevan">
                  <p className="mb-1 text-[11.5px] text-[#9a5b0b]">Belum ada di Legal Register — verifikasi dulu keberlakuannya sebelum dijadikan acuan.</p>
                  <ul className="list-disc space-y-1 pl-5 text-[12.5px]">
                    {ai.external_regulations.map((r, i) => <li key={i}><span className="font-semibold">{r.name}</span>{r.why && <span className="text-[var(--color-neutral-medium)]"> — {r.why}</span>}</li>)}
                  </ul>
                </Section>
              )}

              {ai.notes.length > 0 && (
                <Section title="Catatan">
                  <ul className="list-disc space-y-1 pl-5 text-[12.5px]">{ai.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                </Section>
              )}
              <DroppedNote count={ai.dropped_references} />
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Rancang Dokumen Baru

function draftText(d) {
  const lines = [d.request.title.toUpperCase(), '', '1. TUJUAN', d.purpose, '', '2. RUANG LINGKUP', d.scope, '']
  d.sections.forEach((s, i) => {
    lines.push(`${i + 3}. ${s.heading.toUpperCase()}`, s.content)
    if (s.clause_refs.length) lines.push(`[Acuan: ${s.clause_refs.join('; ')}]`)
    lines.push('')
  })
  return lines.join('\n')
}

function DraftTab({ status, preset, prefill, onRequest }) {
  const empty = { title: '', doc_type: 'SOP', function_id: '', standards: [], notes: '' }
  const [form, setForm] = useState(empty)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (prefill) { setForm({ ...empty, ...prefill }); setResult(null) } }, [prefill]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (preset) { setResult({ generation_id: preset.id, ...preset.result }); setForm({ ...empty, ...preset.result.request, notes: '' }) }
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStd = (code) => setForm((f) => ({
    ...f, standards: f.standards.includes(code) ? f.standards.filter((s) => s !== code) : f.standards.length >= 4 ? f.standards : [...f.standards, code],
  }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      setResult(await api('ai/draft', { method: 'POST', body: form }))
    } catch (err) {
      setError(errorText(err, 'Gagal menyusun rancangan.'))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(draftText(result)); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard tidak tersedia */ }
  }

  const disabled = !status.configured

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Judul dokumen"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={5} maxLength={255} placeholder="mis. Prosedur Pengendalian Informasi Terdokumentasi" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jenis dokumen">
              <select className={inputClass} value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
                {status.meta.doc_types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Fungsi pemilik">
              <select className={inputClass} value={form.function_id} onChange={(e) => setForm({ ...form, function_id: e.target.value })} required>
                <option value="">— Pilih —</option>
                {status.meta.functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Standar acuan (maks. 4)">
            <div className="flex flex-wrap gap-1.5">
              {status.meta.standards.map((s) => {
                const on = form.standards.includes(s.code)
                return (
                  <button type="button" key={s.code} onClick={() => toggleStd(s.code)} title={s.name}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white' : 'border-[var(--color-neutral-border)] hover:border-[var(--color-brand-primary)]'}`}>
                    {s.code}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Catatan untuk penyusunan (opsional)">
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={3000} placeholder="Proses yang dicakup, pihak terlibat, persyaratan khusus…" />
          </Field>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] text-[var(--color-neutral-medium)]">Hasilnya rancangan awal — penyusun tetap wajib meninjau & menyesuaikan.</span>
            <Button type="submit" variant="primary" disabled={busy || disabled}><PenLine size={14} /> {busy ? 'Menyusun…' : 'Susun Rancangan'}</Button>
          </div>
        </form>
      </Card>

      {error && <p className="text-[12.5px] text-[var(--color-brand-danger)]">{error}</p>}
      {busy && <Thinking text="Asisten AI sedang menyusun kerangka & isi awal dokumen…" />}

      {result && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <AiLabel />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copy}>{copied ? <><Check size={13} /> Tersalin</> : <><Copy size={13} /> Salin teks</>}</Button>
              {status.can_request && (
                <Button size="sm" variant="primary" onClick={() => onRequest({
                  title: result.request.title, doc_type: result.request.doc_type, function_id: result.request.function_id,
                  standards: result.request.standards, reason: `Rancangan awal disusun dengan Asisten AI.\n\n${result.purpose}`, hasDraft: true,
                }, result.generation_id)}>
                  <GitBranch size={13} /> Ajukan sebagai Permintaan Penyusunan
                </Button>
              )}
            </div>
          </div>

          <article className="space-y-4 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">
            <h2 className="text-[16px] font-bold">{result.request.title}</h2>
            <div><h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">1. Tujuan</h3><p className="whitespace-pre-line">{result.purpose}</p></div>
            <div><h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">2. Ruang Lingkup</h3><p className="whitespace-pre-line">{result.scope}</p></div>
            {result.sections.map((s, i) => (
              <div key={i}>
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{i + 3}. {s.heading}</h3>
                <p className="whitespace-pre-line">{s.content}</p>
                {s.clause_refs.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{s.clause_refs.map((r) => <span key={r} className="rounded bg-[var(--color-neutral-bg-soft)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--color-neutral-medium)]">{r}</span>)}</div>}
              </div>
            ))}
          </article>

          <div className="my-4 border-t border-[var(--color-neutral-border)]" />

          <div className="space-y-4">
            <Section title="Pemetaan klausul → bagian dokumen" icon={ShieldCheck}>
              {result.clause_mapping.length === 0 ? <Empty>Belum ada klausul yang dipetakan.</Empty> : (
                <table className="w-full text-[12.5px]">
                  <tbody className="divide-y divide-[var(--color-neutral-border)]">
                    {result.clause_mapping.map((m) => (
                      <tr key={`${m.standard}-${m.clause}`}>
                        <td className="w-[150px] py-1.5 align-top"><StandardChip code={m.standard} /> <span className="font-mono text-[11.5px] font-bold">{m.clause}</span></td>
                        <td className="py-1.5 align-top"><div className="font-semibold">{m.title}</div><div className="text-[11.5px] text-[var(--color-neutral-medium)]">Dicakup di: {m.sections.join(', ')}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
            <Section title="Peraturan di Legal Register" icon={Scale}><LegalList items={result.legal} /></Section>
            {result.review_notes.length > 0 && (
              <Section title="Wajib diverifikasi penyusun" icon={AlertTriangle}>
                <ul className="list-disc space-y-1 pl-5 text-[12.5px]">{result.review_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </Section>
            )}
            <DroppedNote count={result.dropped_references} />
          </div>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Riwayat

function HistoryTab({ history, onOpen, onChanged }) {
  const del = useConfirmDelete()
  if (history.length === 0) return <Card><Empty>Belum ada riwayat pemakaian Asisten AI.</Empty></Card>
  return (
    <Card>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
            <th className="pb-2">Waktu</th><th className="pb-2">Jenis</th><th className="pb-2">Topik / Judul</th><th className="pb-2 text-right">Token</th><th className="pb-2">Tindak lanjut</th><th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-neutral-border)]">
          {history.map((h) => (
            <tr key={h.id} className="cursor-pointer hover:bg-[var(--color-neutral-bg-soft)]" onClick={() => onOpen(h)}>
              <td className="whitespace-nowrap py-2 pr-3 text-[var(--color-neutral-medium)]">{dt(h.created_at)}</td>
              <td className="whitespace-nowrap py-2 pr-3">{h.kind === 'draft' ? 'Rancangan' : 'Rekomendasi'}</td>
              <td className="py-2 pr-3 font-semibold">{h.subject}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums text-[var(--color-neutral-medium)]">{(h.input_tokens + h.output_tokens).toLocaleString('id-ID')}</td>
              <td className="whitespace-nowrap py-2">{h.followed_up_ref ? <span className="font-mono text-[11.5px] text-[#1e8e5a]">{h.followed_up_ref}</span> : <span className="text-[var(--color-neutral-medium)]">—</span>}</td>
              <td className="py-1 text-right"><IconAction icon={Trash2} label="Hapus riwayat" danger onClick={() => del.ask(h)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDelete
        open={del.open} onClose={del.close} title="Hapus riwayat AI?" what={del.target?.subject}
        onConfirm={() => api(`ai/generations/${del.target.id}`, { method: 'DELETE' })} onDone={onChanged}
      />
    </Card>
  )
}

// ------------------------------------------------------------------ Halaman

const TABS = [
  { key: 'discover', label: 'Pencarian & Regulasi', icon: Search },
  { key: 'draft', label: 'Rancang Dokumen Baru', icon: PenLine },
  { key: 'history', label: 'Riwayat', icon: History },
]

export default function AiAssistantPage() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('discover')
  const [draftPrefill, setDraftPrefill] = useState(null)
  const [preset, setPreset] = useState({ discover: null, draft: null })
  const [request, setRequest] = useState(null)

  const load = () => api('ai/status').then(setStatus).catch((err) => setError(errorText(err, 'Gagal memuat Asisten AI.')))
  useEffect(() => { load() }, [])

  async function openHistory(h) {
    try {
      const { generation } = await api(`ai/generations/${h.id}`)
      if (!generation.result) return
      if (generation.kind === 'draft') { setPreset((p) => ({ ...p, draft: generation })); setTab('draft') } else {
        setPreset((p) => ({ ...p, discover: { subject: generation.subject, result: { from_history: true, keywords: [], matches: [], drafts: [], ai: { generation_id: generation.id, ...generation.result }, ai_error: null } } }))
        setTab('discover')
      }
    } catch (err) {
      setError(errorText(err, 'Gagal membuka riwayat.'))
    }
  }

  return (
    <Layout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Sparkles size={18} /> Asisten AI</h1>
          <p className="text-[12.5px] text-[var(--color-neutral-medium)]">Cek dokumen yang sudah ada, rekomendasi standar/klausul/regulasi, dan rancangan awal dokumen baru.</p>
        </div>
        {status && (
          <div className="text-right text-[11.5px] text-[var(--color-neutral-medium)]">
            {status.configured ? <>Model: <span className="font-semibold text-[var(--color-neutral-dark)]">{status.model}</span> · sisa kuota jam ini: {status.remaining}</> : 'AI belum aktif'}
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-[12.5px] text-[var(--color-brand-danger)]">{error}</p>}

      {status && !status.configured && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f3d9a7] bg-[#fdf6e9] px-4 py-3 text-[12.5px] text-[#7a4a0a]">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <div>
            <b>Layanan AI belum dikonfigurasi.</b> Administrator perlu mengisi Anthropic API Key dan mengaktifkan integrasi “Asisten AI (Claude)” di menu Integration & API.
            Sampai saat itu, Pencarian & Regulasi tetap menampilkan dokumen serupa (tanpa rekomendasi AI) dan Rancang Dokumen belum bisa dipakai.
          </div>
        </div>
      )}

      {status && (
        <>
          <div className="mb-4 flex gap-1 border-b border-[var(--color-neutral-border)]">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'history') load() }}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-semibold ${tab === t.key ? 'border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]' : 'border-transparent text-[var(--color-neutral-medium)] hover:text-[var(--color-neutral-dark)]'}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          <div className={tab === 'discover' ? '' : 'hidden'}>
            <DiscoverTab status={status} preset={preset.discover} onDraft={(p) => { setDraftPrefill(p); setTab('draft') }} onRequest={(initial, id) => setRequest({ initial, id })} />
          </div>
          <div className={tab === 'draft' ? '' : 'hidden'}>
            <DraftTab status={status} preset={preset.draft} prefill={draftPrefill} onRequest={(initial, id) => setRequest({ initial, id })} />
          </div>
          {tab === 'history' && <HistoryTab history={status.history} onOpen={openHistory} onChanged={load} />}

          <RequestModal open={!!request} onClose={() => setRequest(null)} initial={request?.initial ?? {}} generationId={request?.id} meta={status.meta} />
        </>
      )}
    </Layout>
  )
}
