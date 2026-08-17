import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardEdit, Plus, X, ChevronDown, ChevronUp, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Button, Card, Chip, EmptyState, Field, PageHeader, SectionTitle, inputClass } from '../components/ui'
import { FindingStatusBadge, FindingTypeBadge, StandardChip } from '../components/Badges'
import type { AuditFinding, FindingType } from '../types'
import { FINDING_STATUS_LABEL, FINDING_TYPE_LABEL } from '../types'
import { rolesHavePermission } from '../state/permissions'

export function Findings() {
  const { state, currentUser, dispatch } = useApp()
  const { findings, functions, internalAudits, externalAudits } = state
  const canManage = rolesHavePermission(currentUser.roles, 'finding.manage')
  const canClose = rolesHavePermission(currentUser.roles, 'finding.close')

  const [q, setQ] = useState('')
  const [source, setSource] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [functionId, setFunctionId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return findings.filter((f) => {
      if (source && f.auditSource !== source) return false
      if (type && f.type !== type) return false
      if (status && f.status !== status) return false
      if (functionId && f.functionId !== functionId) return false
      if (kw) {
        const hay = `${f.title} ${f.code} ${f.description} ${f.owner}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [findings, source, type, status, functionId, q])

  const funcName = (id: string) => functions.find((fn) => fn.id === id)?.name ?? id
  const auditRef = (f: AuditFinding) => {
    const list = f.auditSource === 'internal' ? internalAudits : externalAudits
    return list.find((a) => a.id === f.auditId)?.code ?? f.auditId
  }

  // Aging analysis
  const today = new Date().toISOString().slice(0, 10)
  const open = findings.filter((f) => f.status !== 'closed' && f.status !== 'rejected').length
  const overdue = findings.filter((f) => f.status !== 'closed' && f.status !== 'rejected' && f.dueDate < today).length
  const closed = findings.filter((f) => f.status === 'closed').length

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Review"
        title="Register Temuan & CAPA"
        subtitle="Ketidaksesuaian, OFI, observasi, dan strength dari audit internal maupun eksternal — lengkap dengan akar masalah (RCA), tindakan koreksi/preventif, verifikasi efektivitas, sampai penutupan."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Temuan Baru
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<AlertCircle size={17} />} label="Terbuka" value={open} accent="#e24b4a" />
        <StatTile icon={<AlertCircle size={17} />} label="Terlambat" value={overdue} accent="#ef9f27" />
        <StatTile icon={<ShieldCheck size={17} />} label="Verifikasi Berjalan" value={findings.filter((f) => f.status === 'verification' || f.status === 'capa_in_progress').length} accent="#7f77df" />
        <StatTile icon={<CheckCircle2 size={17} />} label="Tertutup" value={closed} accent="#1d6e48" />
      </div>

      <Card>
        <SectionTitle hint="Filter temuan lintas audit">Daftar Temuan</SectionTitle>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Semua Sumber</option>
            <option value="internal">Audit Internal</option>
            <option value="external">Audit Eksternal</option>
          </select>
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua Jenis</option>
            {Object.entries(FINDING_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(FINDING_STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
          </select>
          <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
            <option value="">Semua Fungsi</option>
            {functions.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Tidak ada temuan yang cocok" icon={<ClipboardEdit size={18} />} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((f) => (
              <FindingCard
                key={f.id}
                finding={f}
                auditRef={auditRef(f)}
                functionLabel={funcName(f.functionId)}
                canManage={canManage}
                canClose={canClose}
              />
            ))}
          </div>
        )}
      </Card>

      {showForm && (
        <NewFindingModal onClose={() => setShowForm(false)} onSave={(input) => {
          dispatch({ type: 'ADD_FINDING', input, actor: currentUser.name })
          setShowForm(false)
        }} />
      )}
    </div>
  )
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: accent + '1a', color: accent }}>
        {icon}
      </div>
      <div>
        <div className="text-[22px] font-bold leading-none tabular-nums">{value}</div>
        <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
      </div>
    </Card>
  )
}

function FindingCard({
  finding,
  auditRef,
  functionLabel,
  canManage,
  canClose,
}: {
  finding: AuditFinding
  auditRef: string
  functionLabel: string
  canManage: boolean
  canClose: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const { currentUser, dispatch } = useApp()
  const today = new Date().toISOString().slice(0, 10)
  const overdue = finding.dueDate < today && finding.status !== 'closed' && finding.status !== 'rejected'
  const capaDone = finding.capa.length > 0 && finding.capa.every((c) => c.status === 'completed')
  const verified = finding.verifications.some((v) => v.effective)

  const [rootCause, setRootCause] = useState('')
  const [capaDesc, setCapaDesc] = useState('')
  const [capaKind, setCapaKind] = useState<'corrective' | 'preventive'>('corrective')
  const [capaOwner, setCapaOwner] = useState(currentUser.name)
  const [capaDue, setCapaDue] = useState('')
  const [verifyEffective, setVerifyEffective] = useState(true)
  const [verifyNote, setVerifyNote] = useState('')
  const [verifyMethod, setVerifyMethod] = useState<'document_review' | 'interview' | 'observation' | 'reperformance'>('document_review')
  const [closeNote, setCloseNote] = useState('')

  return (
    <div className={`rounded-xl border bg-white p-4 transition ${overdue ? 'border-[var(--color-brand-danger)]/40' : 'border-[var(--color-neutral-border)]'} hover:shadow-[var(--shadow-elevated)]`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{finding.code}</span>
            <FindingTypeBadge type={finding.type} />
            <FindingStatusBadge status={finding.status} />
            {overdue && <Chip tone="danger">Terlambat</Chip>}
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-soft)]">
              {finding.auditSource === 'internal' ? 'Audit Internal' : 'Audit Eksternal'} · {auditRef}
            </span>
          </div>
          <h3 className="text-[14.5px] font-bold tracking-tight text-[var(--color-neutral-dark)]">{finding.title}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">{finding.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {finding.standards.map((s) => (<StandardChip key={s} code={s} />))}
            <Chip tone="neutral">{finding.clauseReference}</Chip>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-1 rounded-md border border-[var(--color-neutral-border)] px-2 py-1 text-[11.5px] font-semibold hover:bg-[var(--color-neutral-bg-soft)]"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Tutup' : 'Rincian & CAPA'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px]">
        <MetaBox label="Fungsi">{functionLabel}</MetaBox>
        <MetaBox label="Owner Tindak Lanjut">{finding.owner}</MetaBox>
        <MetaBox label="Diangkat Oleh">{finding.raisedBy}</MetaBox>
        <MetaBox label="Tenggat">
          <span className={overdue ? 'font-bold text-[var(--color-brand-danger)]' : ''}>{finding.dueDate}</span>
        </MetaBox>
      </div>

      {/* Progress meter */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-neutral-medium)]">
          <span>Progres Tindak Lanjut</span>
          <span className="tabular-nums">
            {finding.capa.filter((c) => c.status === 'completed').length} / {Math.max(1, finding.capa.length)} CAPA · {finding.verifications.length} verifikasi
          </span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-bg)]">
          <Segment done={finding.rootCause != null} label="RCA" color="#6b93b0" />
          <Segment done={capaDone} label="CAPA" color="#c98a3e" />
          <Segment done={verified} label="Verify" color="#7f77df" />
          <Segment done={finding.status === 'closed'} label="Close" color="#1d6e48" />
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-dashed border-[var(--color-neutral-border)] pt-4">
          {/* Evidence */}
          <Detail title="Bukti">
            <p className="text-[12.5px] leading-relaxed">{finding.evidence}</p>
          </Detail>

          {/* Root cause */}
          <Detail title="Akar Masalah (Root Cause)">
            {finding.rootCause ? (
              <p className="text-[12.5px] leading-relaxed">{finding.rootCause}</p>
            ) : (
              <p className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada akar masalah tercatat.</p>
            )}
            {canManage && !finding.rootCause && (
              <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                <input className={inputClass} placeholder="Ringkas akar masalah (5-Why / Fishbone / Pareto)…" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
                <Button
                  variant="primary" size="sm" disabled={!rootCause.trim()}
                  onClick={() => {
                    dispatch({ type: 'SET_ROOT_CAUSE', findingId: finding.id, rootCause: rootCause.trim(), actor: currentUser.name })
                    setRootCause('')
                  }}
                >Simpan RCA</Button>
              </div>
            )}
          </Detail>

          {/* CAPA */}
          <Detail title={`CAPA (${finding.capa.length})`}>
            <ul className="mb-2 space-y-1.5">
              {finding.capa.map((c) => (
                <li key={c.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Chip tone={c.kind === 'corrective' ? 'warning' : 'primary'}>
                        {c.kind === 'corrective' ? 'Koreksi' : 'Preventif'}
                      </Chip>
                      <span className="font-medium">{c.description}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-neutral-medium)]">
                      <span>Owner: <strong className="text-[var(--color-neutral-dark)]">{c.owner}</strong></span>
                      <span>Tenggat: <strong className="tabular-nums text-[var(--color-neutral-dark)]">{c.dueDate}</strong></span>
                      <Chip tone={c.status === 'completed' ? 'success' : c.status === 'overdue' ? 'danger' : 'warning'}>
                        {c.status}
                      </Chip>
                    </div>
                  </div>
                  {c.status !== 'completed' && canManage && (
                    <div className="mt-1.5 flex justify-end">
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => dispatch({ type: 'COMPLETE_CAPA', findingId: finding.id, capaId: c.id, actor: currentUser.name })}
                      >Tandai Selesai</Button>
                    </div>
                  )}
                </li>
              ))}
              {finding.capa.length === 0 && <li className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada CAPA tercatat.</li>}
            </ul>

            {canManage && (
              <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] p-2">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah CAPA</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4">
                  <select className={inputClass} value={capaKind} onChange={(e) => setCapaKind(e.target.value as 'corrective' | 'preventive')}>
                    <option value="corrective">Koreksi</option>
                    <option value="preventive">Preventif</option>
                  </select>
                  <input className={inputClass + ' sm:col-span-2'} placeholder="Deskripsi tindakan…" value={capaDesc} onChange={(e) => setCapaDesc(e.target.value)} />
                  <input className={inputClass} type="date" value={capaDue} onChange={(e) => setCapaDue(e.target.value)} />
                  <input className={inputClass + ' sm:col-span-3'} placeholder="Owner" value={capaOwner} onChange={(e) => setCapaOwner(e.target.value)} />
                  <Button
                    variant="primary" size="sm"
                    disabled={!capaDesc.trim() || !capaOwner || !capaDue}
                    onClick={() => {
                      dispatch({ type: 'ADD_CAPA', input: { findingId: finding.id, kind: capaKind, description: capaDesc.trim(), owner: capaOwner, dueDate: capaDue }, actor: currentUser.name })
                      setCapaDesc(''); setCapaDue('')
                    }}
                  >Tambah CAPA</Button>
                </div>
              </div>
            )}
          </Detail>

          {/* Verifications */}
          <Detail title={`Verifikasi Efektivitas (${finding.verifications.length})`}>
            <ul className="mb-2 space-y-1.5">
              {finding.verifications.map((v) => (
                <li key={v.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Chip tone={v.effective ? 'success' : 'danger'}>{v.effective ? 'Efektif' : 'Belum Efektif'}</Chip>
                      <span className="font-medium">{v.method.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[11px] text-[var(--color-neutral-medium)]">{v.verifier} · {v.date}</div>
                  </div>
                  <p className="mt-1 leading-relaxed">{v.note}</p>
                </li>
              ))}
              {finding.verifications.length === 0 && <li className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada verifikasi.</li>}
            </ul>
            {canManage && (
              <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] p-2">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah Verifikasi</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4">
                  <select className={inputClass} value={verifyMethod} onChange={(e) => setVerifyMethod(e.target.value as typeof verifyMethod)}>
                    <option value="document_review">Document Review</option>
                    <option value="interview">Interview</option>
                    <option value="observation">Observation</option>
                    <option value="reperformance">Reperformance</option>
                  </select>
                  <select className={inputClass} value={String(verifyEffective)} onChange={(e) => setVerifyEffective(e.target.value === 'true')}>
                    <option value="true">Efektif</option>
                    <option value="false">Belum Efektif</option>
                  </select>
                  <input className={inputClass + ' sm:col-span-2'} placeholder="Catatan hasil verifikasi…" value={verifyNote} onChange={(e) => setVerifyNote(e.target.value)} />
                  <div className="sm:col-span-4 flex justify-end">
                    <Button
                      variant="primary" size="sm" disabled={!verifyNote.trim()}
                      onClick={() => {
                        dispatch({
                          type: 'ADD_VERIFICATION',
                          findingId: finding.id,
                          verification: { date: new Date().toISOString().slice(0, 10), verifier: currentUser.name, method: verifyMethod, effective: verifyEffective, note: verifyNote.trim() },
                          actor: currentUser.name,
                        })
                        setVerifyNote('')
                      }}
                    >Simpan Verifikasi</Button>
                  </div>
                </div>
              </div>
            )}
          </Detail>

          {/* Closure */}
          <Detail title="Penutupan">
            {finding.status === 'closed' ? (
              <div className="rounded-md bg-[var(--color-brand-success-bg)] px-3 py-2 text-[12.5px] text-[var(--color-brand-success-text)]">
                <div className="font-semibold">Ditutup {finding.closedAt}</div>
                {finding.closureNote && <div className="mt-1 leading-relaxed">{finding.closureNote}</div>}
              </div>
            ) : canClose ? (
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <input className={inputClass} placeholder="Catatan penutupan (evidence, keputusan)…" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
                <Button
                  variant="primary" size="sm"
                  disabled={!closeNote.trim() || !verified}
                  onClick={() => {
                    dispatch({ type: 'CLOSE_FINDING', findingId: finding.id, closureNote: closeNote.trim(), actor: currentUser.name })
                    setCloseNote('')
                  }}
                  title={!verified ? 'Belum ada verifikasi efektif' : undefined}
                >Tutup Temuan</Button>
              </div>
            ) : (
              <p className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Hanya Compliance Admin yang dapat menutup temuan.</p>
            )}
          </Detail>
        </div>
      )}
    </div>
  )
}

function Segment({ done, label, color }: { done: boolean; label: string; color: string }) {
  return (
    <div
      className="h-full flex-1 border-r border-white/50 last:border-r-0"
      style={{ backgroundColor: done ? color : 'transparent' }}
      title={`${label}: ${done ? 'selesai' : 'belum'}`}
    />
  )
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
        {title}
      </div>
      {children}
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

function NewFindingModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: {
    auditId: string; auditSource: 'internal' | 'external'; clauseReference: string; standards: string[];
    type: FindingType; title: string; description: string; evidence: string; functionId: string; owner: string;
    raisedBy: string; raisedDate: string; dueDate: string;
  }) => void
}) {
  const { state, currentUser } = useApp()
  const [auditSource, setAuditSource] = useState<'internal' | 'external'>('internal')
  const auditPool = auditSource === 'internal' ? state.internalAudits : state.externalAudits
  const [auditId, setAuditId] = useState(auditPool[0]?.id ?? '')
  const [type, setType] = useState<FindingType>('nc_minor')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [evidence, setEvidence] = useState('')
  const [clause, setClause] = useState('ISO 9001 §')
  const [standards, setStandards] = useState<string[]>(['ISO9001'])
  const [functionId, setFunctionId] = useState(currentUser.functionId)
  const [owner, setOwner] = useState(currentUser.name)
  const [dueDate, setDueDate] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      auditId,
      auditSource,
      clauseReference: clause.trim(),
      standards,
      type,
      title: title.trim(),
      description: description.trim(),
      evidence: evidence.trim(),
      functionId,
      owner,
      raisedBy: currentUser.name,
      raisedDate: new Date().toISOString().slice(0, 10),
      dueDate,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="edms-animate-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-[var(--shadow-popover)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Temuan Audit Baru</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">Non-Conformity (Major/Minor), OFI, Observasi, atau Strength.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--color-neutral-bg)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Sumber Audit">
            <select className={inputClass} value={auditSource} onChange={(e) => {
              const v = e.target.value as 'internal' | 'external'
              setAuditSource(v)
              const first = v === 'internal' ? state.internalAudits[0]?.id : state.externalAudits[0]?.id
              setAuditId(first ?? '')
            }}>
              <option value="internal">Audit Internal</option>
              <option value="external">Audit Eksternal</option>
            </select>
          </Field>
          <Field label="Audit">
            <select required className={inputClass} value={auditId} onChange={(e) => setAuditId(e.target.value)}>
              {auditPool.map((a) => (<option key={a.id} value={a.id}>{a.code} — {a.title}</option>))}
            </select>
          </Field>
          <Field label="Jenis Temuan">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as FindingType)}>
              {Object.entries(FINDING_TYPE_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </Field>
          <Field label="Klausul / Referensi"><input required className={inputClass} value={clause} onChange={(e) => setClause(e.target.value)} placeholder="Contoh: ISO 9001 §8.5.1" /></Field>
          <div className="sm:col-span-2"><Field label="Judul Temuan"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Deskripsi"><textarea required rows={2} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label="Bukti"><textarea required rows={2} className={inputClass} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></Field></div>

          <Field label="Fungsi Terdampak">
            <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
              {state.functions.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </Field>
          <Field label="Owner Tindak Lanjut">
            <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {state.users.filter((u) => u.active).map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>
          <Field label="Tenggat Tindak Lanjut"><input required type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
          <Field label="Standar (comma-separated)">
            <input className={inputClass} value={standards.join(', ')} onChange={(e) => setStandards(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={!auditId || !title || !description || !evidence || !dueDate}>Simpan Temuan</Button>
        </div>
      </form>
    </div>
  )
}
