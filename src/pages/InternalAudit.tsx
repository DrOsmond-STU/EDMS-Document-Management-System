import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardCheck, Plus, X } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Button, Card, EmptyState, Field, PageHeader, SectionTitle, inputClass } from '../components/ui'
import { AuditStatusBadge, StandardChip } from '../components/Badges'
import type { AuditStatus, InternalAudit as InternalAuditType } from '../types'
import { AUDIT_STATUS_LABEL } from '../types'
import { rolesHavePermission } from '../state/permissions'

export function InternalAudit() {
  const { state, currentUser, dispatch } = useApp()
  const { internalAudits, findings, functions } = state
  const canPlan = rolesHavePermission(currentUser.roles, 'audit.plan')
  const [showForm, setShowForm] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return internalAudits.filter((a) => {
      if (status && a.status !== status) return false
      if (kw) {
        const hay = `${a.title} ${a.code} ${a.scope} ${a.leadAuditor}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [internalAudits, status, q])

  const funcName = (id: string) => functions.find((f) => f.id === id)?.name ?? id
  const findingCount = (id: string) => findings.filter((f) => f.auditId === id && f.auditSource === 'internal').length

  // Timeline counts
  const counts: Record<AuditStatus, number> = { planned: 0, scheduled: 0, in_progress: 0, reporting: 0, closed: 0 }
  internalAudits.forEach((a) => { counts[a.status]++ })

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Review"
        title="Audit Internal"
        subtitle="Program audit internal berbasis ISO 19011 — jadwal, ruang lingkup, ceklis, dan tautan ke temuan / CAPA. Referensi standar: ISO 9001, 14001, 45001, 27001, 22301, 37001."
        actions={
          canPlan && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Audit Baru
            </Button>
          )
        }
      />

      {/* Status distribution */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['planned', 'scheduled', 'in_progress', 'reporting', 'closed'] as AuditStatus[]).map((s) => (
          <Card key={s} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
              <ClipboardCheck size={16} />
            </div>
            <div>
              <div className="text-[20px] font-bold leading-none tabular-nums">{counts[s]}</div>
              <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">{AUDIT_STATUS_LABEL[s]}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle hint="Filter berdasarkan status atau kata kunci">Daftar Audit Internal</SectionTitle>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {(['planned', 'scheduled', 'in_progress', 'reporting', 'closed'] as AuditStatus[]).map((s) => (
              <option key={s} value={s}>{AUDIT_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Tidak ada audit yang cocok" icon={<ClipboardCheck size={18} />} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((a) => (
              <AuditCard
                key={a.id}
                audit={a}
                auditeeLabels={a.auditeeFunctionIds.map(funcName)}
                findingCount={findingCount(a.id)}
                onStatusChange={(s) =>
                  dispatch({ type: 'UPDATE_AUDIT_STATUS', auditId: a.id, auditSource: 'internal', status: s, actor: currentUser.name })
                }
                canPlan={canPlan}
              />
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <NewAuditModal
          onClose={() => setShowForm(false)}
          onSave={(input) => {
            dispatch({ type: 'CREATE_INTERNAL_AUDIT', input, actor: currentUser.name })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function AuditCard({
  audit,
  auditeeLabels,
  findingCount,
  onStatusChange,
  canPlan,
}: {
  audit: InternalAuditType
  auditeeLabels: string[]
  findingCount: number
  onStatusChange: (s: AuditStatus) => void
  canPlan: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--color-neutral-border)] bg-white p-4 transition hover:shadow-[var(--shadow-elevated)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{audit.code}</span>
            <AuditStatusBadge status={audit.status} />
          </div>
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--color-neutral-dark)]">{audit.title}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">{audit.scope}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {audit.standards.map((s) => (<StandardChip key={s} code={s} />))}
          </div>
        </div>
        <div className="text-right text-[11.5px]">
          <div className="flex items-center justify-end gap-1 text-[var(--color-neutral-medium)]">
            <CalendarDays size={12} />
            {audit.plannedStartDate} → {audit.plannedEndDate}
          </div>
          <div className="mt-1 text-[var(--color-neutral-dark)]">
            <strong>Lead:</strong> {audit.leadAuditor}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px]">
        <MetaBox label="Auditee">{auditeeLabels.join(', ') || '—'}</MetaBox>
        <MetaBox label="Auditor">{audit.auditors.join(', ') || '—'}</MetaBox>
        <MetaBox label="Item Ceklis">{audit.checklist.length}</MetaBox>
        <MetaBox label="Temuan Terkait">
          <Link to="/findings" className="font-semibold text-[var(--color-brand-primary)] hover:underline">{findingCount}</Link>
        </MetaBox>
      </div>

      {audit.reportSummary && (
        <div className="mt-3 rounded-md bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--color-neutral-dark)]">
          <span className="mr-1 font-bold uppercase tracking-wide text-[10px] text-[var(--color-neutral-medium)]">Ringkasan:</span>
          {audit.reportSummary}
        </div>
      )}

      {audit.checklist.length > 0 && (
        <details className="mt-3 rounded-md border border-dashed border-[var(--color-neutral-border-strong)] px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-[var(--color-neutral-dark)]">
            Lihat Ceklis Audit ({audit.checklist.length})
          </summary>
          <table className="mt-2 w-full text-[12px]">
            <thead className="text-left text-[10px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <tr className="border-b border-[var(--color-neutral-border)]">
                <th className="py-1.5 pr-2 font-bold">Klausul</th>
                <th className="py-1.5 pr-2 font-bold">Pertanyaan</th>
                <th className="py-1.5 pr-2 font-bold">Hasil</th>
                <th className="py-1.5 pr-2 font-bold">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-border)]">
              {audit.checklist.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="py-1.5 pr-2 font-mono text-[11px] text-[var(--color-neutral-medium)]">{it.clauseReference}</td>
                  <td className="py-1.5 pr-2">{it.question}</td>
                  <td className="py-1.5 pr-2 uppercase text-[11px] font-bold">{it.result ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-[var(--color-neutral-medium)]">{it.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {canPlan && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
            Update Status:
          </span>
          {(['planned', 'scheduled', 'in_progress', 'reporting', 'closed'] as AuditStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`rounded-md border border-[var(--color-neutral-border)] px-2 py-0.5 text-[11px] transition-colors ${
                audit.status === s ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-[var(--color-neutral-bg)]'
              }`}
            >
              {AUDIT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-[var(--color-neutral-bg-soft)] px-2.5 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{label}</div>
      <div className="text-[12px] text-[var(--color-neutral-dark)]">{children}</div>
    </div>
  )
}

function NewAuditModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: {
    title: string; scope: string; standards: string[]; auditeeFunctionIds: string[];
    leadAuditor: string; auditors: string[]; plannedStartDate: string; plannedEndDate: string; objectives: string;
  }) => void
}) {
  const { state } = useApp()
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('')
  const [standards, setStandards] = useState<string[]>(['ISO9001'])
  const [auditees, setAuditees] = useState<string[]>([])
  const [lead, setLead] = useState('')
  const [auditors, setAuditors] = useState<string[]>([])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [objectives, setObjectives] = useState('')

  const auditorPool = state.users.filter((u) => u.active)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      title: title.trim(),
      scope: scope.trim(),
      standards,
      auditeeFunctionIds: auditees,
      leadAuditor: lead,
      auditors,
      plannedStartDate: start,
      plannedEndDate: end,
      objectives: objectives.trim(),
    })
  }

  function toggleArray<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="edms-animate-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-[var(--shadow-popover)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Jadwalkan Audit Internal</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">Program audit sesuai ISO 19011 — cakupan, tim, dan jadwal.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--color-neutral-bg)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Judul"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Audit Internal SMM Q2" /></Field></div>
          <div className="sm:col-span-2"><Field label="Ruang Lingkup"><textarea required rows={2} className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Objektif Audit"><textarea rows={2} className={inputClass} value={objectives} onChange={(e) => setObjectives(e.target.value)} /></Field></div>

          <Field label="Tanggal Mulai"><input required type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Tanggal Selesai"><input required type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>

          <Field label="Lead Auditor">
            <select required className={inputClass} value={lead} onChange={(e) => setLead(e.target.value)}>
              <option value="">— pilih —</option>
              {auditorPool.map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>
          <Field label="Anggota Auditor">
            <select multiple className={inputClass + ' h-24'} value={auditors} onChange={(e) => setAuditors(Array.from(e.target.selectedOptions).map((o) => o.value))}>
              {auditorPool.map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Auditee (fungsi)">
              <div className="flex flex-wrap gap-2">
                {state.functions.map((f) => (
                  <label key={f.id} className={`cursor-pointer rounded-md border border-[var(--color-neutral-border)] px-2.5 py-1 text-[12px] ${auditees.includes(f.id) ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-[var(--color-neutral-bg)]'}`}>
                    <input type="checkbox" className="sr-only" checked={auditees.includes(f.id)} onChange={() => setAuditees((cur) => toggleArray(cur, f.id))} />
                    {f.name}
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Standar Terkait (comma-separated)">
              <input className={inputClass} value={standards.join(', ')} onChange={(e) => setStandards(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={!title || !scope || !lead || !start || !end || auditees.length === 0}>Jadwalkan</Button>
        </div>
      </form>
    </div>
  )
}
