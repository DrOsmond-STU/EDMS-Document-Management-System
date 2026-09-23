import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardEdit, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { BasePill, Button, Card, ConfirmDelete, Field, IconAction, inputClass, Modal, StandardChip, useConfirmDelete, ReadOnlyNotice } from '../components/ui'

// Label & warna diambil dari purwarupa lama (halaman Register Temuan & CAPA
// di dms.semestateknologiutama.com) — lihat catatan ekstraksi di riwayat
// commit. Status TIDAK bisa diubah bebas dari sini — hanya lewat aksi
// bertahap (isi RCA/tambah CAPA/tambah verifikasi/tutup/tolak) yang
// ditegakkan server (lihat FindingController).
const TYPE_LABEL = { nc_major: 'NC Major', nc_minor: 'NC Minor', ofi: 'OFI', observation: 'Observasi', strength: 'Strength' }
const TYPE_COLOR = {
  nc_major: { bg: '#fbe7e6', text: '#a53c3b' }, nc_minor: { bg: '#fdf1dc', text: '#a3691a' },
  ofi: { bg: '#e6f1fb', text: '#265f92' }, observation: { bg: '#eef0ea', text: '#5b6055' }, strength: { bg: '#dcefe1', text: '#1f6a45' },
}
const STATUS_LABEL = {
  open: 'Terbuka', root_cause_analysis: 'Analisis Akar Masalah', capa_in_progress: 'CAPA Berjalan',
  verification: 'Verifikasi', closed: 'Ditutup', rejected: 'Ditolak',
}
const STATUS_COLOR = {
  open: { bg: '#fbe7e6', text: '#a53c3b' }, root_cause_analysis: { bg: '#fdf1dc', text: '#b9791c' },
  capa_in_progress: { bg: '#fcecd6', text: '#a3691a' }, verification: { bg: '#e6dff7', text: '#4b3f9c' },
  closed: { bg: '#e3f1ea', text: '#1d6e48' }, rejected: { bg: '#e9eae4', text: '#4a4f45' },
}
const AUDIT_SOURCE_LABEL = { internal: 'Audit Internal', external: 'Audit Eksternal', other: 'Sumber Lain' }
const ACTION_TYPE_LABEL = { corrective: 'Korektif', preventive: 'Preventif' }
const ACTION_STATUS_LABEL = { open: 'Belum Mulai', in_progress: 'Berjalan', completed: 'Selesai' }
const VERIFICATION_METHOD_LABEL = { document_review: 'Tinjauan Dokumen', interview: 'Wawancara', observation: 'Observasi', sampling: 'Sampling' }

function isOverdue(finding) {
  return finding.due_date && finding.due_date.slice(0, 10) < new Date().toISOString().slice(0, 10) && !['closed', 'rejected'].includes(finding.status)
}

function TypeBadge({ type }) {
  const c = TYPE_COLOR[type] ?? TYPE_COLOR.observation
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{TYPE_LABEL[type] ?? type}</span>
}
function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.open
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>{STATUS_LABEL[status] ?? status}</span>
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1a`, color: accent }}>
          <Icon size={17} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{value}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
        </div>
      </div>
    </Card>
  )
}

function MiniField({ label, children }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-soft)]">{label}</div>
      <div className="mt-0.5 text-[12.5px] text-[var(--color-neutral-dark)]">{children}</div>
    </div>
  )
}

function ProgressBar({ finding }) {
  const rca = Boolean(finding.root_cause)
  const capaDone = finding.actions.length > 0 && finding.actions.every((a) => a.status === 'completed')
  const verified = finding.verifications.some((v) => v.effective)
  const closed = finding.status === 'closed'
  const segments = [
    { done: rca, color: '#6b93b0', label: 'RCA' },
    { done: capaDone, color: '#c98a3e', label: 'CAPA' },
    { done: verified, color: '#7f77df', label: 'Verify' },
    { done: closed, color: '#1d6e48', label: 'Close' },
  ]
  const completedActions = finding.actions.filter((a) => a.status === 'completed').length

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-neutral-medium)]">
        <span>Progres Tindak Lanjut</span>
        <span className="tabular-nums">{completedActions} / {Math.max(1, finding.actions.length)} CAPA · {finding.verifications.length} verifikasi</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-bg)]">
        {segments.map((s) => (
          <div key={s.label} className="h-full flex-1 border-r border-white/50 last:border-r-0" style={{ backgroundColor: s.done ? s.color : 'transparent' }} title={`${s.label}: ${s.done ? 'selesai' : 'belum'}`} />
        ))}
      </div>
    </div>
  )
}

function AddRootCauseForm({ finding, onSaved, initial = '', onCancel }) {
  const [text, setText] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api(`findings/${finding.id}/root-cause`, { method: 'POST', body: { root_cause: text } })
      setText('')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1.5 sm:flex-row">
      <input className={`${inputClass} flex-1`} placeholder="Isi akar masalah…" value={text} onChange={(e) => setText(e.target.value)} required />
      <Button type="submit" variant="secondary" size="sm" disabled={submitting}>{submitting ? '…' : 'Simpan'}</Button>
      {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Batal</Button>}
      {error && <p className="text-[11px] text-[#b23b3a]">{error}</p>}
    </form>
  )
}

function AddActionForm({ finding, onSaved }) {
  const [type, setType] = useState('corrective')
  const [description, setDescription] = useState('')
  const [pic, setPic] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api(`findings/${finding.id}/actions`, { method: 'POST', body: { type, description, pic, due_date: dueDate || null } })
      setDescription(''); setPic(''); setDueDate('')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-5">
      <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
        {Object.entries(ACTION_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input className={`${inputClass} col-span-2`} placeholder="Deskripsi tindakan…" value={description} onChange={(e) => setDescription(e.target.value)} required />
      <input className={inputClass} placeholder="PIC" value={pic} onChange={(e) => setPic(e.target.value)} required />
      <div className="flex gap-1.5">
        <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Button type="submit" variant="secondary" size="sm" disabled={submitting}>{submitting ? '…' : 'Tambah'}</Button>
      </div>
      {error && <p className="col-span-full text-[11px] text-[#b23b3a]">{error}</p>}
    </form>
  )
}

function AddVerificationForm({ finding, onSaved }) {
  const [method, setMethod] = useState('document_review')
  const [effective, setEffective] = useState(true)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api(`findings/${finding.id}/verifications`, { method: 'POST', body: { method, effective, notes } })
      setNotes('')
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid grid-cols-2 gap-1.5 md:grid-cols-5">
      <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
        {Object.entries(VERIFICATION_METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <label className="flex items-center gap-1.5 rounded-md border border-[var(--color-neutral-border)] px-2.5 text-[12.5px]">
        <input type="checkbox" checked={effective} onChange={(e) => setEffective(e.target.checked)} /> Efektif
      </label>
      <input className={`${inputClass} col-span-2`} placeholder="Catatan (opsional)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button type="submit" variant="secondary" size="sm" disabled={submitting}>{submitting ? '…' : 'Tambah'}</Button>
      {error && <p className="col-span-full text-[11px] text-[#b23b3a]">{error}</p>}
    </form>
  )
}

function FindingCard({ finding, functionLabel, canManage, canClose, onReload, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const overdue = isOverdue(finding)
  const finished = ['closed', 'rejected'].includes(finding.status)
  const [editingRoot, setEditingRoot] = useState(false)
  const [editingAction, setEditingAction] = useState(null)
  const [actionError, setActionError] = useState('')
  const delAction = useConfirmDelete()

  async function saveAction(e) {
    e?.preventDefault()
    setActionError('')
    try {
      const { id, ...body } = editingAction
      await api(`findings/${finding.id}/actions/${id}`, { method: 'PATCH', body: { ...body, due_date: body.due_date || null } })
      setEditingAction(null)
      onReload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Gagal mengubah tindakan.')
    }
  }

  async function handleClose() {
    setClosing(true)
    setCloseError('')
    try {
      await api(`findings/${finding.id}/close`, { method: 'POST' })
      onReload()
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : 'Gagal menutup temuan.')
    } finally {
      setClosing(false)
    }
  }

  async function handleReject(e) {
    e.preventDefault()
    setClosing(true)
    setCloseError('')
    try {
      await api(`findings/${finding.id}/reject`, { method: 'POST', body: { reason: rejectReason } })
      setShowReject(false)
      onReload()
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : 'Gagal menolak temuan.')
    } finally {
      setClosing(false)
    }
  }

  async function markActionStatus(actionId, status) {
    try {
      await api(`findings/${finding.id}/actions/${actionId}`, { method: 'PATCH', body: { status } })
      onReload()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal memperbarui tindakan.')
    }
  }

  return (
    <div className={`rounded-xl border bg-white p-4 transition ${overdue ? 'border-[#e24b4a]/40' : 'border-[var(--color-neutral-border)]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{finding.code}</span>
            <TypeBadge type={finding.type} />
            <StatusBadge status={finding.status} />
            {overdue && <BasePill bg="#fbe7e6" text="#a53c3b">Terlambat</BasePill>}
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-soft)]">
              {AUDIT_SOURCE_LABEL[finding.audit_source]}{finding.audit_reference ? ` · ${finding.audit_reference}` : ''}
            </span>
          </div>
          <h3 className="text-[14.5px] font-bold tracking-tight text-[var(--color-neutral-dark)]">{finding.title}</h3>
          {finding.description && <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">{finding.description}</p>}
          {(finding.standards?.length > 0 || finding.clause_reference) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {finding.standards?.map((s) => <StandardChip key={s.code} code={s.code} />)}
              {finding.clause_reference && <BasePill bg="#eef0ea" text="#5b6055">{finding.clause_reference}</BasePill>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
        {canManage && !finished && <IconAction icon={Pencil} label="Ubah temuan" onClick={() => onEdit(finding)} />}
        {canManage && finding.status !== 'closed' && finding.verifications.length === 0 && <IconAction icon={Trash2} label="Hapus temuan" danger onClick={() => onDelete(finding)} />}
        <button
          type="button" onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-[var(--color-neutral-border)] px-2 py-1 text-[11.5px] font-semibold hover:bg-[var(--color-neutral-bg-soft)]"
        >
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {open ? 'Tutup' : 'Rincian & CAPA'}
        </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-4">
        <MiniField label="Fungsi">{functionLabel}</MiniField>
        <MiniField label="Owner Tindak Lanjut">{finding.owner || '—'}</MiniField>
        <MiniField label="Diangkat Oleh">{finding.raised_by || '—'}</MiniField>
        <MiniField label="Tenggat"><span className={overdue ? 'font-bold text-[#e24b4a]' : ''}>{finding.due_date?.slice(0, 10) ?? '—'}</span></MiniField>
      </div>

      <ProgressBar finding={finding} />

      {open && (
        <div className="mt-4 space-y-4 border-t border-dashed border-[var(--color-neutral-border)] pt-4">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Bukti</div>
            <p className="text-[12.5px] leading-relaxed">{finding.evidence || '—'}</p>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Akar Masalah (Root Cause)</div>
            {editingRoot ? (
              <AddRootCauseForm finding={finding} initial={finding.root_cause} onCancel={() => setEditingRoot(false)} onSaved={() => { setEditingRoot(false); onReload() }} />
            ) : finding.root_cause ? (
              <div className="flex items-start gap-2">
                <p className="flex-1 text-[12.5px] leading-relaxed">{finding.root_cause}</p>
                {canManage && !finished && <IconAction icon={Pencil} label="Ubah akar masalah" onClick={() => setEditingRoot(true)} />}
              </div>
            ) : <p className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada akar masalah tercatat.</p>}
            {canManage && !finding.root_cause && !finished && <AddRootCauseForm finding={finding} onSaved={onReload} />}
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tindakan CAPA ({finding.actions.length})</div>
            {finding.actions.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {finding.actions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                    {editingAction?.id === a.id ? (
                      <form onSubmit={saveAction} className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-[130px_1fr_130px_130px_auto]">
                        <select className={inputClass} value={editingAction.type} onChange={(e) => setEditingAction({ ...editingAction, type: e.target.value })}>
                          {Object.entries(ACTION_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <input className={inputClass} value={editingAction.description} onChange={(e) => setEditingAction({ ...editingAction, description: e.target.value })} required autoFocus />
                        <input className={inputClass} placeholder="PIC" value={editingAction.pic} onChange={(e) => setEditingAction({ ...editingAction, pic: e.target.value })} required />
                        <input type="date" className={inputClass} value={editingAction.due_date} onChange={(e) => setEditingAction({ ...editingAction, due_date: e.target.value })} />
                        <span className="flex"><IconAction icon={Check} label="Simpan" onClick={saveAction} /><IconAction icon={X} label="Batal" onClick={() => setEditingAction(null)} /></span>
                      </form>
                    ) : (<>
                    <div className="min-w-0">
                      <span className="mr-1.5 font-semibold">{ACTION_TYPE_LABEL[a.type]}</span>{a.description}
                      <div className="text-[10.5px] text-[var(--color-neutral-medium)]">PIC: {a.pic}{a.due_date ? ` · Tenggat ${a.due_date.slice(0, 10)}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-1">
                    {canManage && !finished ? (
                      <select className={`${inputClass} w-auto`} value={a.status} onChange={(e) => markActionStatus(a.id, e.target.value)}>
                        {Object.entries(ACTION_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    ) : (
                      <BasePill bg="#eef0ea" text="#5b6055">{ACTION_STATUS_LABEL[a.status]}</BasePill>
                    )}
                    {canManage && !finished && (
                      <>
                        <IconAction icon={Pencil} label="Ubah tindakan" onClick={() => setEditingAction({ id: a.id, type: a.type, description: a.description, pic: a.pic, due_date: a.due_date?.slice(0, 10) ?? '' })} />
                        {a.status !== 'completed' && <IconAction icon={Trash2} label="Hapus tindakan" danger onClick={() => delAction.ask(a)} />}
                      </>
                    )}
                    </div>
                    </>)}
                  </li>
                ))}
              </ul>
            )}
            {actionError && <p className="mb-1.5 text-[11.5px] text-[#b23b3a]">{actionError}</p>}
            {canManage && !finished && <AddActionForm finding={finding} onSaved={onReload} />}
            <ConfirmDelete
              open={delAction.open} onClose={delAction.close} title="Hapus tindakan CAPA?" what={delAction.target?.description}
              onConfirm={() => api(`findings/${finding.id}/actions/${delAction.target.id}`, { method: 'DELETE' })} onDone={onReload}
            />
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Verifikasi Efektivitas ({finding.verifications.length})</div>
            {finding.verifications.length > 0 && (
              <ul className="mb-2 space-y-1.5">
                {finding.verifications.map((v) => (
                  <li key={v.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                    <span className="font-semibold">{VERIFICATION_METHOD_LABEL[v.method]}</span>{' — '}
                    <span className={v.effective ? 'text-[#1d6e48]' : 'text-[#a53c3b]'}>{v.effective ? 'Efektif' : 'Belum efektif'}</span>
                    {v.notes && <div className="mt-0.5 text-[11.5px] text-[var(--color-neutral-medium)]">{v.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
            {canManage && !finished && <AddVerificationForm finding={finding} onSaved={onReload} />}
          </div>

          {canClose && !finished && (
            <div className="border-t border-dashed border-[var(--color-neutral-border)] pt-3">
              {closeError && <p className="mb-2 text-[11.5px] text-[#b23b3a]">{closeError}</p>}
              {!showReject ? (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" disabled={closing} onClick={handleClose}>{closing ? 'Menutup…' : 'Tutup Temuan'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowReject(true)}>Tolak Temuan</Button>
                </div>
              ) : (
                <form onSubmit={handleReject} className="flex gap-1.5">
                  <input className={`${inputClass} flex-1`} placeholder="Alasan penolakan…" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required />
                  <Button type="submit" variant="danger" size="sm" disabled={closing}>{closing ? '…' : 'Konfirmasi Tolak'}</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowReject(false)}>Batal</Button>
                </form>
              )}
            </div>
          )}
          {finding.status === 'rejected' && finding.rejection_reason && (
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12px] text-[var(--color-neutral-medium)]">
              <span className="font-semibold text-[var(--color-neutral-dark)]">Alasan ditolak:</span> {finding.rejection_reason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FindingFormModal({ open, onClose, functions, standards, onSaved, prefill, finding = null }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (finding) {
      setForm({
        type: finding.type, audit_source: finding.audit_source, audit_id: finding.audit_id ?? null,
        audit_reference: finding.audit_reference ?? '', clause_reference: finding.clause_reference ?? '',
        title: finding.title, description: finding.description ?? '', evidence: finding.evidence ?? '', function_id: finding.function_id ?? '',
        owner: finding.owner ?? '', raised_by: finding.raised_by ?? '', due_date: finding.due_date?.slice(0, 10) ?? '',
        standards: (finding.standards ?? []).map((st) => st.code),
      })
      setError('')
      return
    }
    setForm({
      type: prefill?.type ?? 'nc_minor', audit_source: prefill?.auditSource ?? 'internal', audit_id: prefill?.auditId ?? null,
      audit_reference: prefill?.auditReference ?? '', clause_reference: prefill?.clauseReference ?? '',
      title: prefill?.title ?? '', description: prefill?.description ?? '', evidence: '', function_id: '', owner: '', raised_by: '', due_date: '', standards: [],
    })
    setError('')
  }, [open, prefill, finding])

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
      const body = { ...form, function_id: form.function_id || null, due_date: form.due_date || null }
      const result = finding
        ? await api(`findings/${finding.id}`, { method: 'PATCH', body })
        : await api('findings', { method: 'POST', body })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={finding ? `Ubah Temuan ${finding.code}` : 'Temuan Baru'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jenis">
            <select className={inputClass} value={form.type} onChange={(e) => set('type')(e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Sumber">
            <select className={inputClass} value={form.audit_source} onChange={(e) => set('audit_source')(e.target.value)}>
              {Object.entries(AUDIT_SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Referensi Audit" hint="Opsional — mis. &quot;Audit Internal QA — September 2026&quot;">
          <input className={inputClass} value={form.audit_reference} onChange={(e) => set('audit_reference')(e.target.value)} />
        </Field>
        <Field label="Judul Temuan"><input className={inputClass} value={form.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="Deskripsi" hint="Opsional"><textarea className={inputClass} rows={2} value={form.description} onChange={(e) => set('description')(e.target.value)} /></Field>
        <Field label="Bukti" hint="Opsional"><textarea className={inputClass} rows={2} value={form.evidence} onChange={(e) => set('evidence')(e.target.value)} /></Field>
        <Field label="Referensi Klausul" hint="Opsional — mis. &quot;ISO 9001 Klausul 8.5.1&quot;"><input className={inputClass} value={form.clause_reference} onChange={(e) => set('clause_reference')(e.target.value)} /></Field>

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

        <div className="grid grid-cols-2 gap-2">
          <Field label="Fungsi/Departemen" hint="Opsional">
            <select className={inputClass} value={form.function_id} onChange={(e) => set('function_id')(e.target.value)}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Tenggat" hint="Opsional"><input type="date" className={inputClass} value={form.due_date} onChange={(e) => set('due_date')(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Owner Tindak Lanjut" hint="Opsional"><input className={inputClass} value={form.owner} onChange={(e) => set('owner')(e.target.value)} /></Field>
          <Field label="Diangkat Oleh" hint="Opsional"><input className={inputClass} value={form.raised_by} onChange={(e) => set('raised_by')(e.target.value)} /></Field>
        </div>

        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : finding ? 'Simpan Perubahan' : 'Simpan Temuan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function RegisterTemuanCapaPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('audit.view') || hasPermission('finding.manage') || hasPermission('finding.close')
  const canManage = hasPermission('finding.manage')
  const canClose = hasPermission('finding.close')

  const [findings, setFindings] = useState(null)
  const [functions, setFunctions] = useState([])
  const [standards, setStandards] = useState([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [prefill, setPrefill] = useState(null)
  const [editing, setEditing] = useState(null)
  const del = useConfirmDelete()

  // Datang dari tombol "Buat Temuan" di Compliance Matrix (gap/partial pada
  // sebuah sel) — buka modal Temuan Baru langsung terisi, lalu bersihkan
  // query string supaya refresh halaman tidak membuka modal berulang.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const title = searchParams.get('prefillTitle')
    const auditId = searchParams.get('prefillAuditId')
    if (!title && !auditId) return
    setPrefill({
      title: title ?? '',
      description: searchParams.get('prefillDescription') ?? '',
      clauseReference: searchParams.get('prefillClause') ?? '',
      type: searchParams.get('prefillType') ?? 'nc_minor',
      auditId: auditId ? Number(auditId) : null,
      auditSource: searchParams.get('prefillAuditSource') ?? 'internal',
      auditReference: searchParams.get('prefillAuditReference') ?? '',
    })
    setFormOpen(true)
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [source, setSource] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [functionId, setFunctionId] = useState('')

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (source) qs.set('audit_source', source)
    if (type) qs.set('type', type)
    if (status) qs.set('status', status)
    if (functionId) qs.set('function_id', functionId)
    api(`findings?${qs.toString()}`)
      .then((r) => setFindings(r.findings))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat register temuan.'))
  }, [canView, q, source, type, status, functionId])

  useEffect(() => {
    if (!canView) return
    api('master-data').then((m) => { setFunctions(m.functions); setStandards(m.standards) }).catch(() => {})
  }, [canView])

  useEffect(() => {
    const handle = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(handle)
  }, [load, q])

  const functionLabel = useCallback((id) => functions.find((f) => f.id === id)?.name ?? '—', [functions])

  const stats = useMemo(() => {
    const list = findings ?? []
    return {
      open: list.filter((f) => f.status === 'open').length,
      overdue: list.filter(isOverdue).length,
      verifying: list.filter((f) => ['verification', 'capa_in_progress'].includes(f.status)).length,
      closed: list.filter((f) => f.status === 'closed').length,
    }
  }, [findings])

  if (!canView) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang melihat Register Temuan & CAPA.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Audit & Review</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            <ClipboardEdit size={18} /> Register Temuan &amp; CAPA
          </h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Ketidaksesuaian, OFI, observasi, dan strength dari audit internal maupun eksternal — lengkap dengan akar masalah (RCA), tindakan koreksi/preventif, verifikasi efektivitas, sampai penutupan.
          </p>
        </div>
        {canManage && <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={14} /> Temuan Baru</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {!canManage && <ReadOnlyNotice roles="Document Controller, Function/Department Head, Compliance & Risk Admin, atau Auditor" />}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={AlertTriangle} label="Terbuka" value={stats.open} accent="#e24b4a" />
        <StatCard icon={AlertTriangle} label="Terlambat" value={stats.overdue} accent="#ef9f27" />
        <StatCard icon={ClipboardEdit} label="Verifikasi Berjalan" value={stats.verifying} accent="#7f77df" />
        <StatCard icon={ClipboardEdit} label="Tertutup" value={stats.closed} accent="#1d6e48" />
      </div>

      <Card>
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Temuan</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Filter temuan lintas audit</p>

        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Semua Sumber</option>
            {Object.entries(AUDIT_SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua Jenis</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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

        {!findings ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : findings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <ClipboardEdit size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada temuan yang cocok dengan filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f} functionLabel={functionLabel(f.function_id)} canManage={canManage} canClose={canClose} onReload={load}
                onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={del.ask} />
            ))}
          </div>
        )}
      </Card>

      <FindingFormModal
        open={formOpen}
        finding={editing}
        onClose={() => { setFormOpen(false); setPrefill(null); setEditing(null) }}
        functions={functions}
        standards={standards}
        prefill={prefill}
        onSaved={() => { setFormOpen(false); setPrefill(null); setEditing(null); load() }}
      />
      <ConfirmDelete
        open={del.open} onClose={del.close} title="Hapus temuan?" what={del.target && `${del.target.code} — ${del.target.title}`}
        note="Temuan yang sudah diverifikasi/ditutup adalah rekaman CAPA dan tidak bisa dihapus — gunakan Tolak bila temuan tidak valid. Tindakan CAPA-nya ikut terhapus."
        onConfirm={() => api(`findings/${del.target.id}`, { method: 'DELETE' })} onDone={load}
      />
    </Layout>
  )
}
