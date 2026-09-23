import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Plus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'
import { CLASSIFICATION_LABEL, STATUS, StatusBadge, errorText } from './drafting/shared'

function RequestModal({ open, onClose, meta, onSaved }) {
  const [form, setForm] = useState(null)
  const [functions, setFunctions] = useState([])
  const [standards, setStandards] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ title: '', doc_type: 'SOP', function_id: '', classification: 'internal', reason: '', standards: [] })
    setError('')
    api('master-data').then((m) => { setFunctions(m.functions); setStandards(m.standards) }).catch(() => {})
  }, [open])

  if (!open || !form) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      onSaved(await api('drafting-projects', { method: 'POST', body: form }))
    } catch (err) {
      setError(errorText(err, 'Gagal mengajukan permintaan.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Permintaan Dokumen Baru">
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label="Judul Dokumen yang Diminta"><input className={inputClass} value={form.title} onChange={set('title')} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jenis Dokumen">
            <select className={inputClass} value={form.doc_type} onChange={set('doc_type')}>
              {(meta?.doc_types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Klasifikasi Awal">
            <select className={inputClass} value={form.classification} onChange={set('classification')}>
              {(meta?.classifications ?? []).map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c] ?? c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Fungsi/Departemen Pengaju">
          <select className={inputClass} value={form.function_id} onChange={set('function_id')} required>
            <option value="">— Pilih —</option>
            {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        {standards.length > 0 && (
          <Field label="Standar Terkait" hint="Opsional, boleh lebih dari satu">
            <div className="flex flex-wrap gap-1.5">
              {standards.map((s) => {
                const on = form.standards.includes(s.code)
                return (
                  <button type="button" key={s.code} onClick={() => setForm({ ...form, standards: on ? form.standards.filter((c) => c !== s.code) : [...form.standards, s.code] })}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white' : 'border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)]'}`}>
                    {s.code}
                  </button>
                )
              })}
            </div>
          </Field>
        )}
        <Field label="Alasan Kebutuhan"><textarea className={inputClass} rows={3} value={form.reason} onChange={set('reason')} placeholder="mis. temuan audit, regulasi baru, perubahan proses…" required /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Mengirim…' : 'Ajukan Permintaan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function DraftingListPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [mine, setMine] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(() => {
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    if (mine) qs.set('mine', '1')
    api(`drafting-projects?${qs.toString()}`).then(setData).catch((err) => setError(errorText(err, 'Gagal memuat proyek penyusunan.')))
  }, [status, mine])
  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c = Object.fromEntries(Object.keys(STATUS).map((k) => [k, 0]))
    ;(data?.projects ?? []).forEach((p) => { c[p.status] = (c[p.status] ?? 0) + 1 })
    return c
  }, [data])

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Document Lifecycle</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><GitBranch size={18} /> Tracking Penyusunan Dokumen</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Jejak penyusunan dokumen baru dalam 8 tahap — permintaan, rapat pembahasan beserta notulen & daftar hadir bertanda tangan, finalisasi, hingga pengesahan masuk register utama.
          </p>
        </div>
        {data?.can?.request && <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={14} /> Permintaan Baru</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {Object.entries(STATUS).map(([k, c]) => (
          <button type="button" key={k} onClick={() => setStatus((s) => (s === k ? '' : k))} className="text-left">
            <Card className={`!p-3.5 transition-shadow hover:shadow-md ${status === k ? 'ring-2 ring-[var(--color-brand-primary)]' : ''}`}>
              <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{data ? counts[k] : '…'}</div>
              <div className="mt-1.5"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{c.label}</span></div>
            </Card>
          </button>
        ))}
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Proyek Penyusunan</h2>
            <p className="text-[11.5px] text-[var(--color-neutral-medium)]">Klik baris untuk membuka detail & tahapan</p>
          </div>
          <label className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Hanya milik/tugas saya</label>
        </div>
        {!data ? <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p> : data.projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <GitBranch size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada proyek penyusunan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">No. Permintaan</th>
                  <th className="py-2 pr-3 font-bold">Dokumen</th>
                  <th className="py-2 pr-3 font-bold">Pemohon</th>
                  <th className="py-2 pr-3 font-bold">Penyusun</th>
                  <th className="py-2 pr-3 font-bold">Progres</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.map((p) => {
                  const done = p.stages.filter(Boolean).length
                  return (
                    <tr key={p.id} onClick={() => navigate(`/drafting/${p.id}`)} className="cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)]">
                      <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{p.code}</td>
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-[var(--color-neutral-dark)]">{p.title}</div>
                        <div className="text-[11px] text-[var(--color-neutral-medium)]">{p.doc_type} · {p.org_function?.name}</div>
                      </td>
                      <td className="py-2 pr-3">{p.requester?.name ?? '—'}</td>
                      <td className="py-2 pr-3">{p.drafter?.name ?? <span className="text-[var(--color-neutral-soft)]">belum ada</span>}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-neutral-bg)]">
                            <div className="h-full rounded-full bg-[#1d6e48]" style={{ width: `${(done / 8) * 100}%` }} />
                          </div>
                          <span className="text-[11px] tabular-nums text-[var(--color-neutral-medium)]">{done}/8</span>
                        </div>
                        <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-medium)]">{done < 8 ? `Berikutnya: ${data.stage_labels[done]}` : 'Selesai'}</div>
                      </td>
                      <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RequestModal open={formOpen} onClose={() => setFormOpen(false)} meta={data?.meta} onSaved={(p) => { setFormOpen(false); navigate(`/drafting/${p.id}`) }} />
    </Layout>
  )
}
