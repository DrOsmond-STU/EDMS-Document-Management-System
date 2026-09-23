import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck, ChevronDown, ChevronUp, ClipboardCheck, Check, Pencil, Plus, Presentation, ShieldAlert, Trash2, X } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, ConfirmDelete, Field, IconAction, inputClass, Modal, useConfirmDelete } from '../components/ui'

const STATUS_LABEL = { scheduled: 'Terjadwal', completed: 'Selesai', cancelled: 'Dibatalkan' }
const STATUS_COLOR = {
  scheduled: { bg: '#e4ecf7', text: '#2f5aa3' },
  completed: { bg: '#dcefe1', text: '#1f6a45' },
  cancelled: { bg: '#eceef1', text: '#5b6673' },
}
const ACTION_STATUS_LABEL = { open: 'Terbuka', in_progress: 'Berjalan', completed: 'Selesai' }

// Urutan & label mengikuti ISO 9001:2015 klausul 9.3.2 (input) dan 9.3.3 (output).
const INPUT_FIELDS = [
  ['previous_actions_status', 'a. Status tindak lanjut tinjauan sebelumnya'],
  ['internal_external_changes', 'b. Perubahan isu eksternal & internal yang relevan'],
  ['performance_summary', 'c. Kinerja & efektivitas SMM', 'Kepuasan pelanggan, sasaran mutu, kinerja proses, ketidaksesuaian & tindakan korektif, hasil pemantauan, hasil audit, kinerja penyedia eksternal'],
  ['resource_adequacy', 'd. Kecukupan sumber daya'],
  ['risk_opportunity_effectiveness', 'e. Efektivitas tindakan atas risiko & peluang'],
  ['improvement_opportunities', 'f. Peluang peningkatan'],
]
const OUTPUT_FIELDS = [
  ['decisions', 'Keputusan terkait peluang peningkatan'],
  ['resource_needs', 'Kebutuhan sumber daya'],
  ['system_changes', 'Kebutuhan perubahan pada SMM'],
]

function StatusBadge({ status, labels = STATUS_LABEL, colors = STATUS_COLOR }) {
  const c = colors[status] ?? { bg: '#eceef1', text: '#5b6673' }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {labels[status] ?? status}
    </span>
  )
}

function SnapshotCard({ icon: Icon, value, label, sub, tone }) {
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tone.bg, color: tone.text }}>
          <Icon size={17} strokeWidth={2.25} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{value}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
          {sub && <div className="text-[10.5px] text-[var(--color-neutral-soft)]">{sub}</div>}
        </div>
      </div>
    </Card>
  )
}

function ActionItems({ review, canChair, onReload }) {
  const [description, setDescription] = useState('')
  const [pic, setPic] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`mgmt-reviews/${review.id}/actions`, { method: 'POST', body: { description, pic: pic || null, due_date: dueDate || null } })
      setDescription(''); setPic(''); setDueDate('')
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah tindak lanjut.')
    } finally {
      setBusy(false)
    }
  }

  const [editing, setEditing] = useState(null) // { id, description, pic, due_date }
  const delAction = useConfirmDelete()

  async function saveEdit(e) {
    e?.preventDefault()
    setError('')
    try {
      await api(`mgmt-reviews/${review.id}/actions/${editing.id}`, { method: 'PATCH', body: { description: editing.description, pic: editing.pic || null, due_date: editing.due_date || null } })
      setEditing(null)
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah tindak lanjut.')
    }
  }

  async function setStatus(action, status) {
    try {
      await api(`mgmt-reviews/${review.id}/actions/${action.id}`, { method: 'PATCH', body: { status } })
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui status.')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
        Tindak Lanjut ({review.actions?.length ?? 0})
      </div>
      {review.actions?.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {review.actions.map((a) => {
            const overdue = a.due_date && a.due_date.slice(0, 10) < today && a.status !== 'completed'
            return (
              <li key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                {editing?.id === a.id ? (
                  <form onSubmit={saveEdit} className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-[1fr_120px_130px_auto]">
                    <input className={inputClass} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} required autoFocus />
                    <input className={inputClass} placeholder="PIC" value={editing.pic} onChange={(e) => setEditing({ ...editing, pic: e.target.value })} />
                    <input type="date" className={inputClass} value={editing.due_date} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
                    <span className="flex"><IconAction icon={Check} label="Simpan" onClick={saveEdit} /><IconAction icon={X} label="Batal" onClick={() => setEditing(null)} /></span>
                  </form>
                ) : (<>
                <div>
                  <div className="text-[var(--color-neutral-dark)]">{a.description}</div>
                  <div className="text-[10.5px] text-[var(--color-neutral-medium)]">
                    {a.pic ? `PIC: ${a.pic}` : 'PIC belum ditentukan'}
                    {a.due_date && <span className={overdue ? 'font-bold text-[#b23b3a]' : ''}> · Tenggat {a.due_date.slice(0, 10)}{overdue ? ' (lewat)' : ''}</span>}
                  </div>
                </div>
                {canChair ? (
                  <select className="rounded border border-[var(--color-neutral-border)] bg-white px-1.5 py-1 text-[11px]" value={a.status} onChange={(e) => setStatus(a, e.target.value)}>
                    {Object.entries(ACTION_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                ) : (
                  <span className="text-[11px] font-semibold text-[var(--color-neutral-medium)]">{ACTION_STATUS_LABEL[a.status]}</span>
                )}
                </>)}
                {canChair && editing?.id !== a.id && (
                  <span className="-my-1 flex shrink-0">
                    <IconAction icon={Pencil} label="Ubah tindak lanjut" onClick={() => setEditing({ id: a.id, description: a.description, pic: a.pic ?? '', due_date: a.due_date?.slice(0, 10) ?? '' })} />
                    {a.status !== 'completed' && <IconAction icon={Trash2} label="Hapus tindak lanjut" danger onClick={() => delAction.ask(a)} />}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mb-3 text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada tindak lanjut.</p>
      )}
      {canChair && review.status !== 'cancelled' && (
        <form onSubmit={add} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_140px_140px_auto]">
          <input className={inputClass} placeholder="Tindak lanjut…" value={description} onChange={(e) => setDescription(e.target.value)} required />
          <input className={inputClass} placeholder="PIC" value={pic} onChange={(e) => setPic(e.target.value)} />
          <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Button type="submit" variant="secondary" size="sm" disabled={busy}>{busy ? '…' : 'Tambah'}</Button>
        </form>
      )}
      {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
      <ConfirmDelete
        open={delAction.open} onClose={delAction.close} title="Hapus tindak lanjut?" what={delAction.target?.description}
        onConfirm={() => api(`mgmt-reviews/${review.id}/actions/${delAction.target.id}`, { method: 'DELETE' })} onDone={onReload}
      />
    </div>
  )
}

function MinutesSection({ title, fields, review, editable, form, setForm }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">{title}</div>
      <div className="space-y-2.5">
        {fields.map(([key, label, hint]) => (
          <div key={key}>
            <div className="mb-0.5 text-[12px] font-semibold text-[var(--color-neutral-dark)]">{label}</div>
            {hint && <div className="mb-1 text-[10.5px] text-[var(--color-neutral-medium)]">{hint}</div>}
            {editable ? (
              <textarea className={inputClass} rows={2} value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            ) : (
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--color-neutral-dark)]">{review[key] || '—'}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewRow({ review, canChair, onReload, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const editable = canChair && review.status === 'scheduled'

  useEffect(() => {
    if (!open) return
    const initial = {}
    ;[...INPUT_FIELDS, ...OUTPUT_FIELDS].forEach(([k]) => { initial[k] = review[k] ?? '' })
    setForm(initial)
  }, [open, review])

  async function save() {
    setBusy(true); setError(''); setSaved(false)
    try {
      await api(`mgmt-reviews/${review.id}`, { method: 'PATCH', body: form })
      setSaved(true)
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan notulen.')
    } finally {
      setBusy(false)
    }
  }

  async function transition(action) {
    setBusy(true); setError('')
    try {
      if (action === 'complete') await api(`mgmt-reviews/${review.id}`, { method: 'PATCH', body: form })
      await api(`mgmt-reviews/${review.id}/transition`, { method: 'POST', body: { action } })
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui status.')
    } finally {
      setBusy(false)
    }
  }

  const openActions = (review.actions ?? []).filter((a) => a.status !== 'completed').length

  return (
    <>
      <tr className="cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)]" onClick={() => setOpen((v) => !v)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{review.code}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1 font-semibold text-[var(--color-neutral-dark)]">
            {open ? <ChevronUp size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
            {review.title}
          </div>
          {review.attendees && <div className="pl-[19px] text-[10.5px] text-[var(--color-neutral-medium)]">Peserta: {review.attendees}</div>}
        </td>
        <td className="py-2 pr-3 tabular-nums">{review.meeting_date?.slice(0, 10)}</td>
        <td className="py-2 pr-3">{review.chair?.name ?? '—'}</td>
        <td className="py-2 pr-3 text-center tabular-nums">
          {review.actions?.length ?? 0}
          {openActions > 0 && <span className="ml-1 text-[10.5px] text-[#b9791c]">({openActions} terbuka)</span>}
        </td>
        <td className="py-2 pr-3"><StatusBadge status={review.status} /></td>
        {canChair && (
          <td className="whitespace-nowrap py-1.5 text-right">
            {review.status === 'scheduled' && <IconAction icon={Pencil} label="Ubah jadwal rapat" onClick={() => onEdit(review)} />}
            {review.status !== 'completed' && <IconAction icon={Trash2} label="Hapus rapat" danger onClick={() => onDelete(review)} />}
          </td>
        )}
      </tr>
      {open && (
        <tr className="border-b border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
          <td colSpan={canChair ? 7 : 6} className="px-3 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <MinutesSection title="Input Tinjauan (Klausul 9.3.2)" fields={INPUT_FIELDS} review={review} editable={editable} form={form} setForm={setForm} />
              <div className="space-y-5">
                <MinutesSection title="Output Tinjauan (Klausul 9.3.3)" fields={OUTPUT_FIELDS} review={review} editable={editable} form={form} setForm={setForm} />
                <ActionItems review={review} canChair={canChair} onReload={onReload} />
              </div>
            </div>
            {editable && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-neutral-border)] pt-3">
                <Button size="sm" variant="secondary" disabled={busy} onClick={save}>Simpan Notulen</Button>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => { if (window.confirm('Tutup rapat? Notulen akan dikunci.')) transition('complete') }}>Selesaikan Rapat</Button>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm('Batalkan rapat ini?')) transition('cancel') }}>Batalkan</Button>
                {saved && <span className="text-[11.5px] text-[#1d6e48]">Tersimpan.</span>}
              </div>
            )}
            {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function ReviewFormModal({ open, onClose, users, onSaved, review = null }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(review
      ? { title: review.title, meeting_date: review.meeting_date?.slice(0, 10) ?? '', chair_id: review.chair_id ?? '', attendees: review.attendees ?? '' }
      : { title: '', meeting_date: '', chair_id: '', attendees: '' })
    setError('')
  }, [open, review])

  if (!form) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const body = { ...form, chair_id: form.chair_id || null }
      const result = review
        ? await api(`mgmt-reviews/${review.id}`, { method: 'PATCH', body })
        : await api('mgmt-reviews', { method: 'POST', body })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={review ? `Ubah Rapat ${review.code}` : 'Jadwalkan Tinjauan Manajemen'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Judul Rapat"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="mis. Tinjauan Manajemen Semester 1 2026" required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tanggal Rapat"><input type="date" className={inputClass} value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} required /></Field>
          <Field label="Pimpinan Rapat" hint="Opsional">
            <select className={inputClass} value={form.chair_id} onChange={(e) => setForm({ ...form, chair_id: e.target.value })}>
              <option value="">— Tidak ditentukan —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Peserta" hint="Opsional — nama/jabatan, pisahkan dengan koma"><input className={inputClass} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : review ? 'Simpan Perubahan' : 'Jadwalkan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function MgmtReviewPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('mgmt_review.view')
  const canChair = hasPermission('mgmt_review.chair')

  const [reviews, setReviews] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const del = useConfirmDelete()

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    api(`mgmt-reviews?${qs.toString()}`)
      .then((r) => { setReviews(r.reviews); setSnapshot(r.snapshot) })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat tinjauan manajemen.'))
  }, [canView, status])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!canView) return
    api('master-data').then((m) => setUsers(m.users ?? [])).catch(() => {})
  }, [canView])

  const openActionsTotal = useMemo(
    () => (reviews ?? []).reduce((n, r) => n + (r.actions ?? []).filter((a) => a.status !== 'completed').length, 0),
    [reviews],
  )

  if (!canView) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Anda tidak berwenang melihat Tinjauan Manajemen.</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Audit & Review</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            <Presentation size={18} /> Tinjauan Manajemen
          </h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Rapat tinjauan manajemen sesuai ISO 9001 klausul 9.3 — input, notulen, keputusan, dan tindak lanjut hingga tuntas.
          </p>
        </div>
        {canChair && <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={14} /> Jadwalkan Rapat</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {snapshot && (
        <>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Data Terkini sebagai Bahan Input Rapat</div>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SnapshotCard icon={AlertTriangle} value={snapshot.findings_open} label="Temuan Terbuka" sub={`${snapshot.findings_nc_major_open} NC Mayor · ${snapshot.findings_closed} ditutup`} tone={{ bg: '#fbe7e6', text: '#b23b3a' }} />
            <SnapshotCard icon={ShieldAlert} value={snapshot.risks_high_extreme} label="Risiko Tinggi/Ekstrem" sub={`dari ${snapshot.risks_total_open} risiko aktif`} tone={{ bg: '#fbd8c3', text: '#a3480d' }} />
            <SnapshotCard icon={ClipboardCheck} value={snapshot.audits_completed} label="Audit Selesai" sub={`${snapshot.audits_planned} terjadwal/berjalan`} tone={{ bg: '#dcefe1', text: '#1f6a45' }} />
            <SnapshotCard icon={CalendarCheck} value={openActionsTotal} label="Tindak Lanjut Terbuka" sub="dari seluruh rapat" tone={{ bg: '#fef1cf', text: '#8a5a10' }} />
          </div>
        </>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Rapat</h2>
            <p className="text-[11.5px] text-[var(--color-neutral-medium)]">Klik baris untuk membuka notulen & tindak lanjut</p>
          </div>
          <select className={`${inputClass} !w-48`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {!reviews ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Presentation size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada rapat tinjauan manajemen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Kode</th>
                  <th className="py-2 pr-3 font-bold">Rapat</th>
                  <th className="py-2 pr-3 font-bold">Tanggal</th>
                  <th className="py-2 pr-3 font-bold">Pimpinan</th>
                  <th className="py-2 pr-3 text-center font-bold">Tindak Lanjut</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  {canChair && <th className="py-2 text-right font-bold">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => <ReviewRow key={r.id} review={r} canChair={canChair} onReload={load} onEdit={(x) => { setEditing(x); setFormOpen(true) }} onDelete={del.ask} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReviewFormModal open={formOpen} review={editing} onClose={() => { setFormOpen(false); setEditing(null) }} users={users} onSaved={() => { setFormOpen(false); setEditing(null); load() }} />
      <ConfirmDelete
        open={del.open} onClose={del.close} title="Hapus rapat tinjauan?" what={del.target && `${del.target.code} — ${del.target.title}`}
        note="Tinjauan yang sudah selesai adalah rekaman wajib klausul 9.3 dan tidak bisa dihapus. Tindak lanjutnya ikut terhapus."
        onConfirm={() => api(`mgmt-reviews/${del.target.id}`, { method: 'DELETE' })} onDone={load}
      />
    </Layout>
  )
}
