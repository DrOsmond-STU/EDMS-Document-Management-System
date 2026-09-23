import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Pencil, Plus, Shield, Trash2, X } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, ConfirmDelete, Field, IconAction, inputClass, Modal, StandardChip, useConfirmDelete, ReadOnlyNotice } from '../components/ui'

// Label & warna diambil dari purwarupa lama (halaman Register Risiko di
// dms.semestateknologiutama.com) supaya istilah & tampilan konsisten —
// lihat catatan ekstraksi di riwayat commit. Level DIHITUNG di backend
// (App\Services\RiskScoring, matriks ISO 31000 5×5) dan dikirim sudah jadi;
// tabel di sini cuma memetakan kunci ke label/warna.
const CATEGORY_LABEL = {
  strategic: 'Strategis', operational: 'Operasional', compliance: 'Kepatuhan', financial: 'Keuangan',
  safety: 'Keselamatan (K3)', security: 'Keamanan Informasi', environmental: 'Lingkungan', reputational: 'Reputasi',
}
const TREATMENT_LABEL = {
  avoid: 'Avoid — Hindari', reduce: 'Reduce — Mitigasi', transfer: 'Transfer — Alihkan', accept: 'Accept — Terima',
}
const STATUS_LABEL = {
  identified: 'Teridentifikasi', assessed: 'Telah Dinilai', treated: 'Dalam Perlakuan', monitored: 'Dipantau', closed: 'Ditutup',
}
const LEVEL_LABEL = { low: 'Rendah', moderate: 'Sedang', high: 'Tinggi', extreme: 'Ekstrem' }
const LEVEL_COLOR = {
  low: { bg: '#dcefe1', text: '#1f6a45' },
  moderate: { bg: '#fef1cf', text: '#8a5a10' },
  high: { bg: '#fbd8c3', text: '#a3480d' },
  extreme: { bg: '#f3c2c1', text: '#7d2726' },
}
const LEVELS = ['extreme', 'high', 'moderate', 'low']
const LI_OPTIONS = [1, 2, 3, 4, 5]

function LevelBadge({ level }) {
  const c = LEVEL_COLOR[level] ?? LEVEL_COLOR.low
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {LEVEL_LABEL[level] ?? level}
    </span>
  )
}

function StatCard({ level, count }) {
  const c = LEVEL_COLOR[level]
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg, color: c.text }}>
          <AlertTriangle size={17} strokeWidth={2.25} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{count}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">Residual {LEVEL_LABEL[level]}</div>
        </div>
      </div>
    </Card>
  )
}

function HeatMap({ risks }) {
  // Baris = Impact 5 (atas) → 1 (bawah), kolom = Likelihood 1 → 5 — konvensi
  // matriks risiko standar. Tiap sel dihitung dari data risiko SUNGGUHAN
  // (residual_likelihood/residual_impact), bukan dummy.
  const counts = useMemo(() => {
    const grid = {}
    for (const r of risks) {
      const key = `${r.residual_likelihood}:${r.residual_impact}`
      grid[key] = (grid[key] ?? 0) + 1
    }
    return grid
  }, [risks])

  return (
    <div>
      <div className="grid grid-cols-6 gap-1">
        <div />
        {LI_OPTIONS.map((l) => (
          <div key={l} className="text-center text-[10px] font-bold text-[var(--color-neutral-medium)]">L{l}</div>
        ))}
        {[5, 4, 3, 2, 1].map((impact) => (
          <Fragment key={impact}>
            <div className="flex items-center justify-end pr-1 text-[10px] font-bold text-[var(--color-neutral-medium)]">I{impact}</div>
            {LI_OPTIONS.map((likelihood) => {
              const level = likelihood * impact >= 20 ? 'extreme' : likelihood * impact >= 12 ? 'high' : likelihood * impact >= 6 ? 'moderate' : 'low'
              const c = LEVEL_COLOR[level]
              const n = counts[`${likelihood}:${impact}`] ?? 0
              return (
                <div
                  key={`${likelihood}-${impact}`}
                  className="flex aspect-square items-center justify-center rounded text-[11px] font-bold"
                  style={{ backgroundColor: c.bg, color: c.text, opacity: n > 0 ? 1 : 0.35 }}
                  title={`Likelihood ${likelihood} × Impact ${impact} = ${LEVEL_LABEL[level]}${n ? ` — ${n} risiko` : ''}`}
                >
                  {n > 0 ? n : ''}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function ControlsPanel({ risk, canManage, onControlAdded }) {
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // { id, description }
  const del = useConfirmDelete()

  async function saveEdit(e) {
    e.preventDefault()
    setError('')
    try {
      await api(`risks/${risk.id}/controls/${editing.id}`, { method: 'PATCH', body: { description: editing.description } })
      setEditing(null)
      onControlAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah kontrol.')
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api(`risks/${risk.id}/controls`, { method: 'POST', body: { description } })
      setDescription('')
      onControlAdded()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah kontrol.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
        Kontrol Aktif ({risk.controls?.length ?? 0})
      </div>
      {risk.controls?.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {risk.controls.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
              {editing?.id === c.id ? (
                <form onSubmit={saveEdit} className="flex flex-1 gap-1.5">
                  <input className={`${inputClass} flex-1`} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required autoFocus />
                  <IconAction icon={Check} label="Simpan" onClick={saveEdit} />
                  <IconAction icon={X} label="Batal" onClick={() => setEditing(null)} />
                </form>
              ) : (
                <>
                  <span className="flex-1">{c.description}</span>
                  {canManage && (
                    <span className="-my-1 flex shrink-0">
                      <IconAction icon={Pencil} label="Ubah kontrol" onClick={() => setEditing({ id: c.id, description: c.description })} />
                      <IconAction icon={Trash2} label="Hapus kontrol" danger onClick={() => del.ask(c)} />
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <form onSubmit={handleAdd} className="flex gap-1.5">
          <input className={`${inputClass} flex-1`} placeholder="Tambah kontrol…" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <Button type="submit" variant="secondary" size="sm" disabled={submitting}>{submitting ? '…' : 'Tambah'}</Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
      <ConfirmDelete
        open={del.open} onClose={del.close} title="Hapus kontrol?" what={del.target?.description}
        onConfirm={() => api(`risks/${risk.id}/controls/${del.target.id}`, { method: 'DELETE' })} onDone={onControlAdded}
      />
    </div>
  )
}

function RiskRow({ risk, functionLabel, canManage, onReload, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr className="cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)]" onClick={() => setOpen((v) => !v)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{risk.code}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1 font-semibold text-[var(--color-neutral-dark)]">
            {open ? <ChevronUp size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
            {risk.title}
          </div>
          {risk.standards?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 pl-[19px]">
              {risk.standards.map((s) => <StandardChip key={s.code} code={s.code} />)}
            </div>
          )}
        </td>
        <td className="py-2 pr-3">
          <div>{functionLabel}</div>
          {risk.owner && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{risk.owner}</div>}
        </td>
        <td className="py-2 pr-3">{CATEGORY_LABEL[risk.category] ?? risk.category}</td>
        <td className="py-2 pr-3 text-center">
          <div className="text-[11.5px] tabular-nums text-[var(--color-neutral-medium)]">L{risk.inherent_likelihood} × I{risk.inherent_impact}</div>
          <LevelBadge level={risk.inherent_level} />
        </td>
        <td className="py-2 pr-3 text-center">
          <div className="text-[11.5px] tabular-nums text-[var(--color-neutral-medium)]">L{risk.residual_likelihood} × I{risk.residual_impact}</div>
          <LevelBadge level={risk.residual_level} />
        </td>
        <td className="py-2 pr-3">{(TREATMENT_LABEL[risk.treatment] ?? risk.treatment).split('—')[0].trim()}</td>
        <td className="py-2 pr-3">{STATUS_LABEL[risk.status] ?? risk.status}</td>
        {canManage && (
          <td className="whitespace-nowrap py-1.5 text-right">
            <IconAction icon={Pencil} label="Ubah risiko" onClick={() => onEdit(risk)} />
            <IconAction icon={Trash2} label="Hapus risiko" danger onClick={() => onDelete(risk)} />
          </td>
        )}
      </tr>
      {open && (
        <tr className="border-b border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
          <td colSpan={canManage ? 9 : 8} className="px-3 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Deskripsi</div>
                <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{risk.description || '—'}</p>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  Rencana Perlakuan ({TREATMENT_LABEL[risk.treatment] ?? risk.treatment})
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{risk.treatment_plan || '—'}</p>
              </div>
              <ControlsPanel risk={risk} canManage={canManage} onControlAdded={onReload} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RiskFormModal({ open, onClose, functions, standards, onSaved, risk = null }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(risk ? {
      title: risk.title, description: risk.description ?? '', category: risk.category, function_id: risk.function_id ?? '',
      owner: risk.owner ?? '', standards: (risk.standards ?? []).map((st) => st.code),
      inherent_likelihood: risk.inherent_likelihood, inherent_impact: risk.inherent_impact,
      residual_likelihood: risk.residual_likelihood, residual_impact: risk.residual_impact,
      treatment: risk.treatment, treatment_plan: risk.treatment_plan ?? '', status: risk.status,
    } : {
      title: '', description: '', category: 'operational', function_id: '', owner: '',
      standards: [], inherent_likelihood: 3, inherent_impact: 3, residual_likelihood: 2, residual_impact: 2,
      treatment: 'reduce', treatment_plan: '',
    })
    setError('')
  }, [open, risk])

  if (!form) return null

  function set(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleStandard(code) {
    setForm((f) => ({ ...f, standards: f.standards.includes(code) ? f.standards.filter((c) => c !== code) : [...f.standards, code] }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = { ...form, function_id: form.function_id || null }
      const result = risk
        ? await api(`risks/${risk.id}`, { method: 'PATCH', body })
        : await api('risks', { method: 'POST', body })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={risk ? `Ubah Risiko ${risk.code}` : 'Risiko Baru'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Judul Risiko"><input className={inputClass} value={form.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="Deskripsi"><textarea className={inputClass} rows={2} value={form.description} onChange={(e) => set('description')(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kategori">
            <select className={inputClass} value={form.category} onChange={(e) => set('category')(e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Fungsi/Departemen" hint="Opsional">
            <select className={inputClass} value={form.function_id} onChange={(e) => set('function_id')(e.target.value)}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Pemilik Risiko (Owner)" hint="Opsional — nama/jabatan penanggung jawab"><input className={inputClass} value={form.owner} onChange={(e) => set('owner')(e.target.value)} /></Field>

        {standards.length > 0 && (
          <Field label="Standar Terkait" hint="Opsional">
            <div className="flex flex-wrap gap-1.5">
              {standards.map((s) => (
                <button
                  type="button" key={s.code} onClick={() => toggleStandard(s.code)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    form.standards.includes(s.code)
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white'
                      : 'border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)]'
                  }`}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="rounded-md border border-[var(--color-neutral-border)] p-2.5">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Risiko Inheren (sebelum kontrol)</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Likelihood">
              <select className={inputClass} value={form.inherent_likelihood} onChange={(e) => set('inherent_likelihood')(Number(e.target.value))}>
                {LI_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Impact">
              <select className={inputClass} value={form.inherent_impact} onChange={(e) => set('inherent_impact')(Number(e.target.value))}>
                {LI_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div className="rounded-md border border-[var(--color-neutral-border)] p-2.5">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Risiko Residual (setelah kontrol)</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Likelihood">
              <select className={inputClass} value={form.residual_likelihood} onChange={(e) => set('residual_likelihood')(Number(e.target.value))}>
                {LI_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Impact">
              <select className={inputClass} value={form.residual_impact} onChange={(e) => set('residual_impact')(Number(e.target.value))}>
                {LI_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <Field label="Perlakuan Risiko">
          <select className={inputClass} value={form.treatment} onChange={(e) => set('treatment')(e.target.value)}>
            {Object.entries(TREATMENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Rencana Perlakuan" hint="Opsional"><textarea className={inputClass} rows={2} value={form.treatment_plan} onChange={(e) => set('treatment_plan')(e.target.value)} /></Field>
        {risk && (
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => set('status')(e.target.value)}>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        )}

        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : risk ? 'Simpan Perubahan' : 'Simpan Risiko'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function RegisterRisikoPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('risk.view')
  const canManage = hasPermission('risk.manage')

  const [risks, setRisks] = useState(null)
  const [functions, setFunctions] = useState([])
  const [standards, setStandards] = useState([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const del = useConfirmDelete()

  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('')
  const [functionId, setFunctionId] = useState('')

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (category) qs.set('category', category)
    if (level) qs.set('residual_level', level)
    if (status) qs.set('status', status)
    if (functionId) qs.set('function_id', functionId)
    api(`risks?${qs.toString()}`)
      .then((r) => setRisks(r.risks))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat register risiko.'))
  }, [canView, q, category, level, status, functionId])

  useEffect(() => {
    if (!canView) return
    api('master-data').then((m) => { setFunctions(m.functions); setStandards(m.standards) }).catch(() => {})
  }, [canView])

  useEffect(() => {
    const handle = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(handle)
  }, [load, q])

  const functionLabel = useCallback((id) => functions.find((f) => f.id === id)?.name ?? '—', [functions])

  const levelCounts = useMemo(() => {
    const counts = { low: 0, moderate: 0, high: 0, extreme: 0 }
    ;(risks ?? []).forEach((r) => { if (counts[r.residual_level] !== undefined) counts[r.residual_level]++ })
    return counts
  }, [risks])

  if (!canView) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang melihat Register Risiko.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Governance</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            <Shield size={18} /> Register Risiko
          </h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Manajemen risiko berbasis ISO 31000 & ISO 9001 klausul 6.1 — identifikasi, analisis, evaluasi, perlakuan, dan pemantauan risiko lintas fungsi.
          </p>
        </div>
        {canManage && <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={14} /> Risiko Baru</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {!canManage && <ReadOnlyNotice roles="Function/Department Head atau Compliance & Risk Admin" />}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LEVELS.map((l) => <StatCard key={l} level={l} count={levelCounts[l]} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Risiko</h2>
          <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Filter & pencarian</p>

          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Semua Kategori</option>
              {Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Semua Level Residual</option>
              {['low', 'moderate', 'high', 'extreme'].map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
            </select>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua Status</option>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
              <option value="">Semua Fungsi</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {!risks ? (
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
          ) : risks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <AlertTriangle size={28} className="text-[var(--color-neutral-soft)]" />
              <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada risiko yang cocok dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-[12.5px]">
                <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <tr className="border-b border-[var(--color-neutral-border)]">
                    <th className="py-2 pr-3 font-bold">Kode</th>
                    <th className="py-2 pr-3 font-bold">Risiko</th>
                    <th className="py-2 pr-3 font-bold">Fungsi / Owner</th>
                    <th className="py-2 pr-3 font-bold">Kategori</th>
                    <th className="py-2 pr-3 text-center font-bold">Inherent</th>
                    <th className="py-2 pr-3 text-center font-bold">Residual</th>
                    <th className="py-2 pr-3 font-bold">Perlakuan</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                    {canManage && <th className="py-2 text-right font-bold">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-neutral-border)]">
                  {risks.map((r) => (
                    <RiskRow key={r.id} risk={r} functionLabel={functionLabel(r.function_id)} canManage={canManage} onReload={load}
                      onEdit={(risk) => { setEditing(risk); setFormOpen(true) }} onDelete={del.ask} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Peta Panas Risiko</h2>
          <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Distribusi Likelihood × Impact (residual)</p>
          <HeatMap risks={risks ?? []} />
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-neutral-medium)]">
            Kuadran kanan-atas (Likelihood &amp; Impact tinggi) memerlukan perlakuan prioritas. Warna menunjukkan level residual berdasarkan skor L × I.
          </p>
        </Card>
      </div>

      <RiskFormModal
        open={formOpen}
        risk={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        functions={functions}
        standards={standards}
        onSaved={() => { setFormOpen(false); setEditing(null); load() }}
      />
      <ConfirmDelete
        open={del.open} onClose={del.close} title="Hapus risiko?"
        what={del.target && `${del.target.code} — ${del.target.title}`}
        onConfirm={() => api(`risks/${del.target.id}`, { method: 'DELETE' })} onDone={load}
      />
    </Layout>
  )
}
