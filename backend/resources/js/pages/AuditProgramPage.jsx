import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ClipboardCheck, Plus, Building2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, inputClass, Modal, StandardChip } from '../components/ui'

const STATUS_LABEL = { planned: 'Terjadwal', in_progress: 'Berlangsung', completed: 'Selesai', cancelled: 'Dibatalkan' }
const STATUS_COLOR = {
  planned: { bg: '#e4ecf7', text: '#2f5aa3' },
  in_progress: { bg: '#fef1cf', text: '#8a5a10' },
  completed: { bg: '#dcefe1', text: '#1f6a45' },
  cancelled: { bg: '#eceef1', text: '#5b6673' },
}

function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] ?? STATUS_COLOR.planned
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function StatCard({ status, count }) {
  const c = STATUS_COLOR[status]
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg, color: c.text }}>
          <ClipboardCheck size={17} strokeWidth={2.25} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{count}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{STATUS_LABEL[status]}</div>
        </div>
      </div>
    </Card>
  )
}

function AuditRow({ audit, functionLabel, canConduct, canPlan, onReload }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function transition(action, extra = {}) {
    setBusy(true)
    setError('')
    try {
      await api(`audits/${audit.id}/transition`, { method: 'POST', body: { action, ...extra } })
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui status.')
    } finally {
      setBusy(false)
    }
  }

  const findingsUrl = `/findings?prefillAuditId=${audit.id}&prefillAuditSource=${audit.type}&prefillAuditReference=${encodeURIComponent(audit.code)}`

  return (
    <>
      <tr className="cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)]" onClick={() => setOpen((v) => !v)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{audit.code}</td>
        <td className="py-2 pr-3">
          <div className="flex items-center gap-1 font-semibold text-[var(--color-neutral-dark)]">
            {open ? <ChevronUp size={13} className="shrink-0" /> : <ChevronDown size={13} className="shrink-0" />}
            {audit.title}
          </div>
          {audit.standards?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 pl-[19px]">
              {audit.standards.map((s) => <StandardChip key={s.code} code={s.code} />)}
            </div>
          )}
        </td>
        <td className="py-2 pr-3">{functionLabel}</td>
        <td className="py-2 pr-3">{audit.lead_auditor?.name ?? '—'}</td>
        <td className="py-2 pr-3 text-[11.5px] tabular-nums text-[var(--color-neutral-medium)]">
          {audit.planned_start?.slice(0, 10)} s/d {audit.planned_end?.slice(0, 10)}
        </td>
        <td className="py-2 pr-3 text-center">{audit.findings?.length ?? 0}</td>
        <td className="py-2 pr-3"><StatusBadge status={audit.status} /></td>
      </tr>
      {open && (
        <tr className="border-b border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
          <td colSpan={7} className="px-3 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tujuan</div>
                <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{audit.objective || '—'}</p>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Ruang Lingkup</div>
                <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{audit.scope || '—'}</p>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tim Audit</div>
                <p className="text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{audit.audit_team || '—'}</p>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  Temuan Terkait ({audit.findings?.length ?? 0})
                </div>
                {audit.findings?.length > 0 ? (
                  <ul className="mb-3 space-y-1.5">
                    {audit.findings.map((f) => (
                      <li key={f.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                        <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{f.code}</span> — {f.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada temuan tercatat.</p>
                )}
                {audit.status !== 'cancelled' && (
                  <Link to={findingsUrl} className="text-[12px] font-semibold text-[var(--color-brand-primary)] hover:underline">
                    + Catat Temuan dari Audit Ini
                  </Link>
                )}

                {audit.summary && (
                  <>
                    <div className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Kesimpulan</div>
                    <p className="text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{audit.summary}</p>
                  </>
                )}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {audit.status === 'planned' && canConduct && (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => transition('start')}>Mulai Pelaksanaan</Button>
                  )}
                  {audit.status === 'in_progress' && canConduct && (
                    <Button size="sm" variant="primary" disabled={busy} onClick={() => {
                      const summary = window.prompt('Kesimpulan audit (opsional):', audit.summary || '')
                      if (summary !== null) transition('complete', { summary })
                    }}>Selesaikan Audit</Button>
                  )}
                  {['planned', 'in_progress'].includes(audit.status) && canPlan && (
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => { if (window.confirm('Batalkan audit ini?')) transition('cancel') }}>Batalkan</Button>
                  )}
                </div>
                {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AuditFormModal({ open, onClose, type, functions, standards, users, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      title: '', objective: '', scope: '', function_id: '', lead_auditor_id: '', audit_team: '',
      planned_start: '', planned_end: '', standards: [],
    })
    setError('')
  }, [open])

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
      const result = await api('audits', { method: 'POST', body: { ...form, type, lead_auditor_id: form.lead_auditor_id || null } })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={type === 'external' ? 'Jadwalkan Audit Eksternal' : 'Jadwalkan Audit Internal'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Judul Audit"><input className={inputClass} value={form.title} onChange={(e) => set('title')(e.target.value)} required /></Field>
        <Field label="Tujuan" hint="Opsional"><textarea className={inputClass} rows={2} value={form.objective} onChange={(e) => set('objective')(e.target.value)} /></Field>
        <Field label="Ruang Lingkup" hint="Opsional"><textarea className={inputClass} rows={2} value={form.scope} onChange={(e) => set('scope')(e.target.value)} /></Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Fungsi/Departemen Diaudit" hint="Opsional">
            <select className={inputClass} value={form.function_id} onChange={(e) => set('function_id')(e.target.value)}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Ketua Tim Audit" hint="Opsional">
            <select className={inputClass} value={form.lead_auditor_id} onChange={(e) => set('lead_auditor_id')(e.target.value)}>
              <option value="">— Tidak ditentukan —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Anggota Tim Audit" hint="Opsional — nama, pisahkan dengan koma"><input className={inputClass} value={form.audit_team} onChange={(e) => set('audit_team')(e.target.value)} /></Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Rencana Mulai"><input type="date" className={inputClass} value={form.planned_start} onChange={(e) => set('planned_start')(e.target.value)} required /></Field>
          <Field label="Rencana Selesai"><input type="date" className={inputClass} value={form.planned_end} onChange={(e) => set('planned_end')(e.target.value)} required /></Field>
        </div>

        {standards.length > 0 && (
          <Field label="Standar/Kriteria Audit" hint="Opsional">
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

        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Jadwalkan Audit'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function AuditProgramPage({ type }) {
  const { hasPermission } = useAuth()
  const canView = hasPermission('audit_program.view')
  const canPlan = hasPermission('audit.plan')
  const canConduct = hasPermission('audit.conduct')

  const [audits, setAudits] = useState(null)
  const [functions, setFunctions] = useState([])
  const [standards, setStandards] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [status, setStatus] = useState('')
  const [functionId, setFunctionId] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams({ type })
    if (status) qs.set('status', status)
    if (functionId) qs.set('function_id', functionId)
    if (q.trim()) qs.set('q', q.trim())
    api(`audits?${qs.toString()}`)
      .then((r) => setAudits(r.audits))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat program audit.'))
  }, [canView, type, status, functionId, q])

  useEffect(() => {
    if (!canView) return
    api('master-data').then((m) => { setFunctions(m.functions); setStandards(m.standards); setUsers(m.users ?? []) }).catch(() => {})
  }, [canView])

  useEffect(() => {
    const handle = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(handle)
  }, [load, q])

  const functionLabel = useCallback((id) => functions.find((f) => f.id === id)?.name ?? '—', [functions])

  const statusCounts = useMemo(() => {
    const counts = { planned: 0, in_progress: 0, completed: 0, cancelled: 0 }
    ;(audits ?? []).forEach((a) => { if (counts[a.status] !== undefined) counts[a.status]++ })
    return counts
  }, [audits])

  if (!canView) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang melihat program audit.
        </div>
      </Layout>
    )
  }

  const isExternal = type === 'external'

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Audit & Review</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            {isExternal ? <Building2 size={18} /> : <ClipboardCheck size={18} />}
            {isExternal ? 'Audit Eksternal' : 'Audit Internal'}
          </h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            {isExternal
              ? 'Rencana & pelaksanaan audit oleh badan sertifikasi atau pihak eksternal lain, sampai temuan yang diangkat.'
              : 'Program audit mutu internal — perencanaan, pelaksanaan, sampai temuan yang diangkat ke Register Temuan & CAPA.'}
          </p>
        </div>
        {canPlan && <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={14} /> Jadwalkan Audit</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.keys(STATUS_LABEL).map((s) => <StatCard key={s} status={s} count={statusCounts[s]} />)}
      </div>

      <Card>
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Audit</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Filter & pencarian</p>

        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
            <option value="">Semua Fungsi</option>
            {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {!audits ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <ClipboardCheck size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada audit yang cocok dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Kode</th>
                  <th className="py-2 pr-3 font-bold">Audit</th>
                  <th className="py-2 pr-3 font-bold">Auditee</th>
                  <th className="py-2 pr-3 font-bold">Ketua Tim</th>
                  <th className="py-2 pr-3 font-bold">Rencana</th>
                  <th className="py-2 pr-3 text-center font-bold">Temuan</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-neutral-border)]">
                {audits.map((a) => (
                  <AuditRow key={a.id} audit={a} functionLabel={functionLabel(a.function_id)} canConduct={canConduct} canPlan={canPlan} onReload={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AuditFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        type={type}
        functions={functions}
        standards={standards}
        users={users}
        onSaved={() => { setFormOpen(false); load() }}
      />
    </Layout>
  )
}
