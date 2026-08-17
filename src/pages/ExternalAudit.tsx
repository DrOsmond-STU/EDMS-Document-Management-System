import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CalendarDays, Plus, X } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Button, Card, EmptyState, Field, PageHeader, SectionTitle, inputClass } from '../components/ui'
import { AuditStatusBadge, StandardChip } from '../components/Badges'
import type { AuditStatus, ExternalAudit as ExternalAuditType, ExternalAuditKind } from '../types'
import { AUDIT_STATUS_LABEL, EXTERNAL_AUDIT_KIND_LABEL } from '../types'
import { rolesHavePermission } from '../state/permissions'

export function ExternalAudit() {
  const { state, currentUser, dispatch } = useApp()
  const { externalAudits, findings } = state
  const canPlan = rolesHavePermission(currentUser.roles, 'audit.plan')
  const [showForm, setShowForm] = useState(false)
  const [kind, setKind] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return externalAudits.filter((a) => {
      if (kind && a.kind !== kind) return false
      if (status && a.status !== status) return false
      if (kw) {
        const hay = `${a.title} ${a.code} ${a.scope} ${a.auditingBody}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [externalAudits, kind, status, q])

  const findingCount = (id: string) => findings.filter((f) => f.auditId === id && f.auditSource === 'external').length

  // Upcoming timeline
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = [...externalAudits]
    .filter((a) => a.plannedStartDate >= today && a.status !== 'closed')
    .sort((a, b) => (a.plannedStartDate < b.plannedStartDate ? -1 : 1))
    .slice(0, 5)

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Review"
        title="Audit Eksternal"
        subtitle="Jadwal audit sertifikasi, surveillance, regulator, customer, dan pihak kedua — beserta laporan, tenggat respons, dan tindak lanjut sampai penutupan temuan."
        actions={
          canPlan && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Audit Baru
            </Button>
          )
        }
      />

      {/* Timeline of upcoming audits */}
      <Card className="mb-5">
        <SectionTitle hint="5 audit eksternal terjadwal terdekat">Jadwal Terdekat</SectionTitle>
        {upcoming.length === 0 ? (
          <p className="text-[12.5px] text-[var(--color-neutral-medium)]">Tidak ada audit eksternal terjadwal.</p>
        ) : (
          <ol className="relative border-l border-[var(--color-neutral-border)] pl-4">
            {upcoming.map((a) => (
              <li key={a.id} className="mb-3 last:mb-0">
                <span className="absolute -left-[7px] mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-brand-primary)] ring-2 ring-white" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[12px] font-semibold tabular-nums text-[var(--color-brand-primary-dark)]">
                    {a.plannedStartDate}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-soft)]">
                    {EXTERNAL_AUDIT_KIND_LABEL[a.kind]}
                  </span>
                  <AuditStatusBadge status={a.status} />
                </div>
                <div className="mt-0.5 text-[13px] font-semibold">{a.title}</div>
                <div className="text-[11.5px] text-[var(--color-neutral-medium)]">
                  {a.auditingBody} · Kontak: {a.contactPerson}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <SectionTitle hint="Semua audit eksternal (aktif & tertutup)">Daftar Lengkap</SectionTitle>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Semua Jenis</option>
            {Object.entries(EXTERNAL_AUDIT_KIND_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {(['planned', 'scheduled', 'in_progress', 'reporting', 'closed'] as AuditStatus[]).map((s) => (
              <option key={s} value={s}>{AUDIT_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Tidak ada audit yang cocok" icon={<Building2 size={18} />} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((a) => (
              <ExternalAuditCard
                key={a.id}
                audit={a}
                findingCount={findingCount(a.id)}
                canPlan={canPlan}
                onStatusChange={(s) =>
                  dispatch({ type: 'UPDATE_AUDIT_STATUS', auditId: a.id, auditSource: 'external', status: s, actor: currentUser.name })
                }
              />
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <NewExternalAuditModal
          onClose={() => setShowForm(false)}
          onSave={(input) => {
            dispatch({ type: 'CREATE_EXTERNAL_AUDIT', input, actor: currentUser.name })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function ExternalAuditCard({
  audit,
  findingCount,
  canPlan,
  onStatusChange,
}: {
  audit: ExternalAuditType
  findingCount: number
  canPlan: boolean
  onStatusChange: (s: AuditStatus) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const overdue = audit.responseDueDate && audit.responseDueDate < today && audit.status !== 'closed'

  return (
    <div className="rounded-xl border border-[var(--color-neutral-border)] bg-white p-4 transition hover:shadow-[var(--shadow-elevated)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{audit.code}</span>
            <AuditStatusBadge status={audit.status} />
            <span className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-chip-text)]">
              {EXTERNAL_AUDIT_KIND_LABEL[audit.kind]}
            </span>
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
            <strong>{audit.auditingBody}</strong>
          </div>
          <div className="text-[var(--color-neutral-medium)]">Kontak: {audit.contactPerson}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px]">
        <MetaBox label="Laporan Diterima">{audit.reportReceivedDate ?? '—'}</MetaBox>
        <MetaBox label="Tenggat Respons">
          {audit.responseDueDate ? (
            <span className={overdue ? 'font-bold text-[var(--color-brand-danger)]' : ''}>
              {audit.responseDueDate}{overdue ? ' · terlambat' : ''}
            </span>
          ) : '—'}
        </MetaBox>
        <MetaBox label="Temuan">
          <Link to="/findings" className="font-semibold text-[var(--color-brand-primary)] hover:underline">
            {findingCount}
          </Link>
        </MetaBox>
        <MetaBox label="Sertifikat">{audit.certificateReference ?? '—'}</MetaBox>
      </div>

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

function NewExternalAuditModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: {
    title: string; kind: ExternalAuditKind; auditingBody: string; standards: string[];
    scope: string; contactPerson: string; plannedStartDate: string; plannedEndDate: string;
  }) => void
}) {
  const { state } = useApp()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ExternalAuditKind>('surveillance')
  const [body, setBody] = useState('')
  const [standards, setStandards] = useState<string[]>(['ISO9001'])
  const [scope, setScope] = useState('')
  const [contact, setContact] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      title: title.trim(),
      kind,
      auditingBody: body.trim(),
      standards,
      scope: scope.trim(),
      contactPerson: contact,
      plannedStartDate: start,
      plannedEndDate: end,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="edms-animate-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-[var(--shadow-popover)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Jadwalkan Audit Eksternal</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">Sertifikasi, surveillance, regulator, customer, atau second-party.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--color-neutral-bg)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Judul"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field></div>
          <Field label="Jenis Audit">
            <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ExternalAuditKind)}>
              {Object.entries(EXTERNAL_AUDIT_KIND_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </Field>
          <Field label="Badan / Regulator / Pelanggan">
            <input required className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contoh: PT SGS Indonesia" />
          </Field>
          <div className="sm:col-span-2"><Field label="Ruang Lingkup"><textarea required rows={2} className={inputClass} value={scope} onChange={(e) => setScope(e.target.value)} /></Field></div>
          <Field label="Kontak / PIC Internal">
            <select required className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)}>
              <option value="">— pilih —</option>
              {state.users.filter((u) => u.active).map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>
          <Field label="Standar (comma-separated)">
            <input className={inputClass} value={standards.join(', ')} onChange={(e) => setStandards(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          </Field>
          <Field label="Tanggal Mulai"><input required type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Tanggal Selesai"><input required type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={!title || !body || !scope || !contact || !start || !end}>Jadwalkan</Button>
        </div>
      </form>
    </div>
  )
}
