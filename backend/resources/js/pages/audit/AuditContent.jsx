import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ClipboardList, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, ApiError } from '../../api'
import { Button, ConfirmDelete, Field, IconAction, inputClass, Modal, useConfirmDelete } from '../../components/ui'

export const RESULT_LABEL = {
  conform: 'Sesuai', nc_minor: 'NC Minor', nc_major: 'NC Mayor', ofi: 'OFI', observation: 'Observasi', na: 'N/A',
}
const RESULT_COLOR = {
  conform: { bg: '#dcefe1', text: '#1f6a45' }, nc_minor: { bg: '#fef1cf', text: '#8a5a10' }, nc_major: { bg: '#f3c2c1', text: '#7d2726' },
  ofi: { bg: '#e4ecf7', text: '#2f5aa3' }, observation: { bg: '#efe7fb', text: '#5b3f99' }, na: { bg: '#eceef1', text: '#5b6673' },
}

const errText = (err, fallback) => (err instanceof ApiError
  ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.message)
  : fallback)

/** Nilai ISO dari server → format <input type="datetime-local"> dalam zona waktu browser. */
function toLocalInput(v) {
  if (!v) return ''
  const d = new Date(v)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fmt = (v) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]"><Icon size={13} /> {children}</div>
      {action}
    </div>
  )
}

// ------------------------------------------------------------------ Jadwal / agenda

function SessionModal({ audit, session, functions, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    starts_at: toLocalInput(session?.starts_at), ends_at: toLocalInput(session?.ends_at), topic: session?.topic ?? '',
    function_id: session?.function_id ?? audit.function_id ?? '', auditee: session?.auditee ?? '', auditor: session?.auditor ?? '',
    location: session?.location ?? '', notes: session?.notes ?? '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const body = { ...form, ends_at: form.ends_at || null, function_id: form.function_id || null }
    try {
      await api(session ? `audits/${audit.id}/sessions/${session.id}` : `audits/${audit.id}/sessions`, { method: session ? 'PATCH' : 'POST', body })
      onSaved()
    } catch (err) {
      setError(errText(err, 'Gagal menyimpan jadwal.'))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={session ? 'Ubah Jadwal Audit' : 'Tambah Jadwal Audit'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Proses / Klausul yang Diaudit"><input className={inputClass} value={form.topic} onChange={set('topic')} required maxLength={255} placeholder="mis. Pengendalian dokumen (7.5)" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mulai"><input type="datetime-local" className={inputClass} value={form.starts_at} onChange={set('starts_at')} required /></Field>
          <Field label="Selesai" hint="Opsional"><input type="datetime-local" className={inputClass} value={form.ends_at} onChange={set('ends_at')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fungsi Auditee">
            <select className={inputClass} value={form.function_id} onChange={set('function_id')}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Auditee" hint="Nama/jabatan"><input className={inputClass} value={form.auditee} onChange={set('auditee')} maxLength={255} /></Field>
          <Field label="Auditor"><input className={inputClass} value={form.auditor} onChange={set('auditor')} maxLength={255} /></Field>
          <Field label="Lokasi"><input className={inputClass} value={form.location} onChange={set('location')} maxLength={255} /></Field>
        </div>
        <Field label="Catatan" hint="Opsional"><textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function SessionsPanel({ audit, functions, canEdit, onChanged }) {
  const [editing, setEditing] = useState(null) // null | 'new' | session
  const del = useConfirmDelete()
  const sessions = audit.sessions ?? []

  return (
    <div>
      <SectionTitle icon={CalendarClock} action={canEdit && <Button size="sm" onClick={() => setEditing('new')}><Plus size={12} /> Jadwal</Button>}>
        Jadwal / Agenda Audit ({sessions.length})
      </SectionTitle>
      {sessions.length === 0 ? <p className="text-[12px] text-[var(--color-neutral-medium)]">Belum ada jadwal.</p> : (
        <div className="overflow-x-auto rounded-md border border-[var(--color-neutral-border)] bg-white">
          <table className="w-full text-[12px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <tr className="border-b border-[var(--color-neutral-border)]"><th className="px-2.5 py-1.5">Waktu</th><th className="px-2.5 py-1.5">Proses</th><th className="px-2.5 py-1.5">Auditee / Auditor</th>{canEdit && <th />}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-border)]">
              {sessions.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums">{fmt(s.starts_at)}{s.ends_at && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">s/d {fmt(s.ends_at)}</div>}</td>
                  <td className="px-2.5 py-1.5"><div className="font-semibold">{s.topic}</div>{s.location && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{s.location}</div>}</td>
                  <td className="px-2.5 py-1.5">
                    {s.org_function?.name ?? s.auditee ?? '—'}
                    {s.org_function && s.auditee && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{s.auditee}</div>}
                    {s.auditor && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">Auditor: {s.auditor}</div>}
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-1 py-0.5 text-right">
                      <IconAction icon={Pencil} label="Ubah jadwal" onClick={() => setEditing(s)} />
                      <IconAction icon={Trash2} label="Hapus jadwal" danger onClick={() => del.ask(s)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <SessionModal audit={audit} session={editing === 'new' ? null : editing} functions={functions}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />
      )}
      <ConfirmDelete open={del.open} onClose={del.close} title="Hapus jadwal audit?" what={del.target?.topic}
        onConfirm={() => api(`audits/${audit.id}/sessions/${del.target.id}`, { method: 'DELETE' })} onDone={onChanged} />
    </div>
  )
}

// ------------------------------------------------------------------ Checklist

function ChecklistModal({ audit, item, results, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    clause_ref: item?.clause_ref ?? '', question: item?.question ?? '', result: item?.result ?? '',
    evidence: item?.evidence ?? '', notes: item?.notes ?? '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const body = { ...form, result: form.result || null }
    try {
      await api(item ? `audits/${audit.id}/checklist/${item.id}` : `audits/${audit.id}/checklist`, { method: item ? 'PATCH' : 'POST', body })
      onSaved()
    } catch (err) {
      setError(errText(err, 'Gagal menyimpan butir checklist.'))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={item ? 'Ubah Butir Checklist' : 'Tambah Butir Checklist'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label="Klausul/Kriteria" hint="mis. ISO9001 7.5.3"><input className={inputClass} value={form.clause_ref} onChange={set('clause_ref')} maxLength={64} /></Field>
        <Field label="Pertanyaan / Hal yang Diperiksa"><textarea className={inputClass} rows={2} value={form.question} onChange={set('question')} required maxLength={2000} /></Field>
        <Field label="Hasil" hint="Kosongkan bila belum diperiksa">
          <select className={inputClass} value={form.result} onChange={set('result')}>
            <option value="">— Belum diperiksa —</option>
            {results.map((r) => <option key={r} value={r}>{RESULT_LABEL[r] ?? r}</option>)}
          </select>
        </Field>
        <Field label="Bukti Objektif" hint="Dokumen/rekaman/wawancara yang diperiksa"><textarea className={inputClass} rows={2} value={form.evidence} onChange={set('evidence')} maxLength={5000} /></Field>
        <Field label="Catatan Auditor" hint="Opsional"><textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function ChecklistPanel({ audit, results, canEdit, canRaiseFinding, onChanged }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const del = useConfirmDelete()
  const items = audit.checklist ?? []
  const done = items.filter((i) => i.result).length

  async function raise(item) {
    setError('')
    try {
      await api(`audits/${audit.id}/checklist/${item.id}/finding`, { method: 'POST' })
      onChanged()
    } catch (err) {
      setError(errText(err, 'Gagal membuat temuan.'))
    }
  }

  return (
    <div>
      <SectionTitle icon={ClipboardList} action={canEdit && <Button size="sm" onClick={() => setEditing('new')}><Plus size={12} /> Butir</Button>}>
        Checklist Audit ({done}/{items.length} diperiksa)
      </SectionTitle>
      {items.length === 0 ? <p className="text-[12px] text-[var(--color-neutral-medium)]">Belum ada butir checklist.</p> : (
        <ul className="space-y-1.5">
          {items.map((it) => {
            const c = RESULT_COLOR[it.result]
            const raisable = ['nc_minor', 'nc_major', 'ofi', 'observation'].includes(it.result) && !it.finding_id
            return (
              <li key={it.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {it.clause_ref && <span className="rounded bg-[var(--color-neutral-bg-soft)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--color-neutral-medium)]">{it.clause_ref}</span>}
                      {it.result
                        ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c?.bg, color: c?.text }}>{RESULT_LABEL[it.result]}</span>
                        : <span className="text-[10.5px] text-[var(--color-neutral-soft)]">belum diperiksa</span>}
                      {it.finding && <Link to={`/findings?q=${encodeURIComponent(it.finding.code)}`} className="font-mono text-[10.5px] font-semibold text-[var(--color-brand-primary)] hover:underline">→ {it.finding.code}</Link>}
                    </div>
                    <div className="mt-0.5 font-semibold text-[var(--color-neutral-dark)]">{it.question}</div>
                    {it.evidence && <div className="text-[11.5px] text-[var(--color-neutral-medium)]">Bukti: {it.evidence}</div>}
                    {it.notes && <div className="text-[11.5px] text-[var(--color-neutral-medium)]">Catatan: {it.notes}</div>}
                  </div>
                  <div className="flex shrink-0 items-center">
                    {canRaiseFinding && raisable && <IconAction icon={FilePlus2} label="Jadikan temuan" onClick={() => raise(it)} />}
                    {canEdit && <IconAction icon={Pencil} label="Ubah butir checklist" onClick={() => setEditing(it)} />}
                    {canEdit && !it.finding_id && <IconAction icon={Trash2} label="Hapus butir checklist" danger onClick={() => del.ask(it)} />}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
      {editing && (
        <ChecklistModal audit={audit} item={editing === 'new' ? null : editing} results={results}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged() }} />
      )}
      <ConfirmDelete open={del.open} onClose={del.close} title="Hapus butir checklist?" what={del.target?.question}
        onConfirm={() => api(`audits/${audit.id}/checklist/${del.target.id}`, { method: 'DELETE' })} onDone={onChanged} />
    </div>
  )
}
