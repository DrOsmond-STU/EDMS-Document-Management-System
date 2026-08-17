import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Presentation, Plus, X, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Button, Card, Chip, EmptyState, Field, PageHeader, inputClass } from '../components/ui'
import { StandardChip } from '../components/Badges'
import type { ManagementReview as ManagementReviewType, MgmtReviewInputCategory, MgmtReviewStatus } from '../types'
import { MGMT_REVIEW_INPUT_LABEL, MGMT_REVIEW_STATUS_LABEL } from '../types'
import { rolesHavePermission } from '../state/permissions'

const STATUS_TONE: Record<MgmtReviewStatus, 'neutral' | 'primary' | 'warning' | 'success' | 'danger'> = {
  planned: 'neutral',
  scheduled: 'primary',
  held: 'warning',
  closed: 'success',
}

export function ManagementReview() {
  const { state, currentUser, dispatch } = useApp()
  const { mgmtReviews } = state
  const canChair = rolesHavePermission(currentUser.roles, 'mgmt_review.chair')
  const [showForm, setShowForm] = useState(false)

  const stats = useMemo(() => {
    const scheduled = mgmtReviews.filter((r) => r.status === 'scheduled').length
    const held = mgmtReviews.filter((r) => r.status === 'held').length
    const closed = mgmtReviews.filter((r) => r.status === 'closed').length
    const openActions = mgmtReviews.flatMap((r) => r.actionItems).filter((a) => a.status !== 'completed').length
    return { scheduled, held, closed, openActions }
  }, [mgmtReviews])

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Review"
        title="Tinjauan Manajemen"
        subtitle="Rapat tinjauan manajemen (ISO 9001 §9.3 / 14001 §9.3 / 45001 §9.3 / 27001 §9.3 / 22301 §9.3) — agenda, inputs, keputusan, dan tindak lanjut hingga penutupan."
        actions={
          canChair && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Tinjauan Baru
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Terjadwal" value={stats.scheduled} accent="#378add" />
        <StatTile label="Dilaksanakan" value={stats.held} accent="#ef9f27" />
        <StatTile label="Ditutup" value={stats.closed} accent="#1d6e48" />
        <StatTile label="Tindak Lanjut Terbuka" value={stats.openActions} accent="#e24b4a" />
      </div>

      {mgmtReviews.length === 0 ? (
        <EmptyState title="Belum ada tinjauan manajemen" icon={<Presentation size={18} />} />
      ) : (
        <div className="flex flex-col gap-3">
          {mgmtReviews.map((r) => (
            <ReviewCard key={r.id} review={r} canChair={canChair} onStatusChange={(s) =>
              dispatch({ type: 'UPDATE_MGMT_REVIEW_STATUS', reviewId: r.id, status: s, actor: currentUser.name })
            } />
          ))}
        </div>
      )}

      {showForm && (
        <NewReviewModal onClose={() => setShowForm(false)} onSave={(input) => {
          dispatch({ type: 'CREATE_MGMT_REVIEW', input, actor: currentUser.name })
          setShowForm(false)
        }} />
      )}
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <Card>
      <div className="text-[24px] font-bold leading-none tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
    </Card>
  )
}

function ReviewCard({ review, canChair, onStatusChange }: { review: ManagementReviewType; canChair: boolean; onStatusChange: (s: MgmtReviewStatus) => void }) {
  const [expanded, setExpanded] = useState(review.status === 'held' || review.status === 'closed')
  const { currentUser, dispatch } = useApp()

  // action form state
  const [actDesc, setActDesc] = useState('')
  const [actOwner, setActOwner] = useState(currentUser.name)
  const [actDue, setActDue] = useState('')
  // decision form state
  const [decTopic, setDecTopic] = useState('')
  const [decText, setDecText] = useState('')

  const openActions = review.actionItems.filter((a) => a.status !== 'completed').length
  const doneActions = review.actionItems.filter((a) => a.status === 'completed').length

  return (
    <div className="rounded-xl border border-[var(--color-neutral-border)] bg-white p-4 transition hover:shadow-[var(--shadow-elevated)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{review.code}</span>
            <Chip tone={STATUS_TONE[review.status]}>{MGMT_REVIEW_STATUS_LABEL[review.status]}</Chip>
          </div>
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--color-neutral-dark)]">{review.title}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">{review.agenda}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {review.standards.map((s) => (<StandardChip key={s} code={s} />))}
          </div>
        </div>
        <div className="text-right text-[11.5px]">
          <div className="text-[var(--color-neutral-medium)]">Rapat: <strong className="tabular-nums text-[var(--color-brand-primary-dark)]">{review.meetingDate}</strong></div>
          <div className="mt-1"><strong>Ketua:</strong> {review.chairperson}</div>
          <div className="text-[var(--color-neutral-medium)]">{review.attendees.length} peserta</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px]">
        <MetaBox label="Inputs">{review.inputs.length}</MetaBox>
        <MetaBox label="Keputusan">{review.decisions.length}</MetaBox>
        <MetaBox label="Tindak Lanjut">{review.actionItems.length}</MetaBox>
        <MetaBox label="Terbuka / Selesai">{openActions} / {doneActions}</MetaBox>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="flex items-center gap-1 rounded-md border border-[var(--color-neutral-border)] px-2 py-1 text-[11.5px] font-semibold hover:bg-[var(--color-neutral-bg-soft)]"
        >
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {expanded ? 'Sembunyikan Detail' : 'Lihat Detail'}
        </button>
        {canChair && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Status:</span>
            {(['planned', 'scheduled', 'held', 'closed'] as MgmtReviewStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`rounded-md border border-[var(--color-neutral-border)] px-2 py-0.5 text-[11px] transition-colors ${
                  review.status === s ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-[var(--color-neutral-bg)]'
                }`}
              >{MGMT_REVIEW_STATUS_LABEL[s]}</button>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-dashed border-[var(--color-neutral-border)] pt-4">
          {/* Attendees */}
          <Detail title={`Peserta (${review.attendees.length})`}>
            <div className="flex flex-wrap gap-1.5">
              {review.attendees.map((a) => (
                <span key={a} className="rounded-full bg-[var(--color-brand-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand-primary-dark)]">
                  {a}
                </span>
              ))}
            </div>
          </Detail>

          {/* Inputs — ISO 9001 §9.3.2 */}
          <Detail title="Inputs Tinjauan Manajemen (ISO 9001 §9.3.2)">
            {review.inputs.length === 0 ? (
              <p className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada input tercatat.</p>
            ) : (
              <ul className="space-y-1.5">
                {review.inputs.map((it) => (
                  <li key={it.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                    <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-brand-teal)]">
                      {MGMT_REVIEW_INPUT_LABEL[it.category]}
                    </div>
                    <div>{it.summary}</div>
                    {it.reference && (
                      <div className="mt-0.5 font-mono text-[10.5px] text-[var(--color-neutral-medium)]">Ref: {it.reference}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Detail>

          {/* Decisions */}
          <Detail title="Keputusan (Outputs §9.3.3)">
            <ul className="mb-2 space-y-1.5">
              {review.decisions.map((d) => (
                <li key={d.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                  <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-brand-violet)]">{d.topic}</div>
                  <div className="font-medium">{d.decision}</div>
                  {d.rationale && <div className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-neutral-medium)]">{d.rationale}</div>}
                </li>
              ))}
              {review.decisions.length === 0 && <li className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada keputusan tercatat.</li>}
            </ul>
            {canChair && (
              <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] p-2">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah Keputusan</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                  <input className={inputClass} placeholder="Topik" value={decTopic} onChange={(e) => setDecTopic(e.target.value)} />
                  <input className={inputClass + ' sm:col-span-2'} placeholder="Keputusan" value={decText} onChange={(e) => setDecText(e.target.value)} />
                  <div className="sm:col-span-3 flex justify-end">
                    <Button
                      variant="primary" size="sm" disabled={!decTopic.trim() || !decText.trim()}
                      onClick={() => {
                        dispatch({ type: 'ADD_MGMT_DECISION', reviewId: review.id, decision: { topic: decTopic.trim(), decision: decText.trim() }, actor: currentUser.name })
                        setDecTopic(''); setDecText('')
                      }}
                    >Simpan Keputusan</Button>
                  </div>
                </div>
              </div>
            )}
          </Detail>

          {/* Action items */}
          <Detail title="Tindak Lanjut">
            <ul className="mb-2 space-y-1.5">
              {review.actionItems.map((a) => (
                <li key={a.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {a.status === 'completed' ? (
                        <Chip tone="success"><CheckCircle2 size={11} /> Selesai</Chip>
                      ) : (
                        <Chip tone={a.status === 'overdue' ? 'danger' : 'warning'}>{a.status}</Chip>
                      )}
                      <span className="font-medium">{a.description}</span>
                    </div>
                    <div className="text-[11px] text-[var(--color-neutral-medium)]">
                      Owner: <strong className="text-[var(--color-neutral-dark)]">{a.owner}</strong> · Tenggat: <strong className="tabular-nums text-[var(--color-neutral-dark)]">{a.dueDate}</strong>
                    </div>
                  </div>
                  {a.closureNote && <div className="mt-1 text-[11.5px] italic text-[var(--color-neutral-medium)]">{a.closureNote}</div>}
                  {a.status !== 'completed' && canChair && (
                    <div className="mt-1.5 flex justify-end">
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => {
                          const note = window.prompt('Catatan penutupan (opsional):') ?? ''
                          dispatch({ type: 'CLOSE_MGMT_ACTION', reviewId: review.id, itemId: a.id, closureNote: note, actor: currentUser.name })
                        }}
                      >Tutup Tindak Lanjut</Button>
                    </div>
                  )}
                </li>
              ))}
              {review.actionItems.length === 0 && <li className="text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada tindak lanjut.</li>}
            </ul>
            {canChair && (
              <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] p-2">
                <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah Tindak Lanjut</div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-4">
                  <input className={inputClass + ' sm:col-span-2'} placeholder="Deskripsi tindak lanjut" value={actDesc} onChange={(e) => setActDesc(e.target.value)} />
                  <input className={inputClass} placeholder="Owner" value={actOwner} onChange={(e) => setActOwner(e.target.value)} />
                  <input className={inputClass} type="date" value={actDue} onChange={(e) => setActDue(e.target.value)} />
                  <div className="sm:col-span-4 flex justify-end">
                    <Button
                      variant="primary" size="sm" disabled={!actDesc.trim() || !actOwner || !actDue}
                      onClick={() => {
                        dispatch({ type: 'ADD_MGMT_ACTION', reviewId: review.id, item: { description: actDesc.trim(), owner: actOwner, dueDate: actDue }, actor: currentUser.name })
                        setActDesc(''); setActDue('')
                      }}
                    >Tambah</Button>
                  </div>
                </div>
              </div>
            )}
          </Detail>

          {review.minutesUrl && (
            <div className="rounded-md bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12px]">
              <strong>Notulen:</strong> <span className="font-mono">{review.minutesUrl}</span>
              <span className="ml-2 text-[10.5px] italic text-[var(--color-neutral-soft)]">
                (attachment akan aktif setelah backend Digital Signature — lihat roadmap).
              </span>
            </div>
          )}
        </div>
      )}
    </div>
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

function NewReviewModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: {
    title: string; meetingDate: string; standards: string[]; chairperson: string; attendees: string[]; agenda: string;
    inputs: { category: MgmtReviewInputCategory; summary: string; reference?: string }[];
  }) => void
}) {
  const { state } = useApp()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [standards, setStandards] = useState<string[]>(['ISO9001'])
  const [chair, setChair] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [agenda, setAgenda] = useState('Tinjauan efektivitas sistem manajemen, evaluasi tindak lanjut, keputusan sumber daya.')
  const [inputs, setInputs] = useState<{ category: MgmtReviewInputCategory; summary: string; reference?: string }[]>([])
  const [inpCat, setInpCat] = useState<MgmtReviewInputCategory>('audit_results')
  const [inpSum, setInpSum] = useState('')
  const [inpRef, setInpRef] = useState('')

  const users = state.users.filter((u) => u.active)

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave({
      title: title.trim(),
      meetingDate: date,
      standards,
      chairperson: chair,
      attendees,
      agenda: agenda.trim(),
      inputs,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="edms-animate-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-[var(--shadow-popover)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Rencanakan Tinjauan Manajemen</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">Sesuai ISO 9001 §9.3 — agenda, peserta, dan inputs.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--color-neutral-bg)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Judul"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Tinjauan Manajemen Semester 1" /></Field></div>
          <Field label="Tanggal Rapat"><input required type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Ketua Rapat">
            <select required className={inputClass} value={chair} onChange={(e) => setChair(e.target.value)}>
              <option value="">— pilih —</option>
              {users.map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Agenda"><textarea rows={2} className={inputClass} value={agenda} onChange={(e) => setAgenda(e.target.value)} /></Field></div>
          <div className="sm:col-span-2">
            <Field label="Peserta">
              <select multiple className={inputClass + ' h-24'} value={attendees} onChange={(e) => setAttendees(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {users.map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Standar (comma-separated)">
              <input className={inputClass} value={standards.join(', ')} onChange={(e) => setStandards(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Inputs (opsional, bisa ditambah nanti)</div>
            <ul className="mb-2 space-y-1.5">
              {inputs.map((it, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-1.5 text-[12px]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-teal)]">{MGMT_REVIEW_INPUT_LABEL[it.category]}</div>
                    <div>{it.summary}</div>
                    {it.reference && <div className="mt-0.5 font-mono text-[10.5px] text-[var(--color-neutral-medium)]">Ref: {it.reference}</div>}
                  </div>
                  <button type="button" className="rounded p-0.5 hover:bg-[var(--color-neutral-bg)]" onClick={() => setInputs((cur) => cur.filter((_, idx) => idx !== i))}>
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] p-2">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <select className={inputClass} value={inpCat} onChange={(e) => setInpCat(e.target.value as MgmtReviewInputCategory)}>
                  {Object.entries(MGMT_REVIEW_INPUT_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
                <input className={inputClass + ' sm:col-span-2'} placeholder="Ringkasan input" value={inpSum} onChange={(e) => setInpSum(e.target.value)} />
                <input className={inputClass + ' sm:col-span-2'} placeholder="Referensi (opsional, e.g. IA-2026-001)" value={inpRef} onChange={(e) => setInpRef(e.target.value)} />
                <Button
                  variant="secondary" size="sm" disabled={!inpSum.trim()}
                  onClick={() => {
                    setInputs((cur) => [...cur, { category: inpCat, summary: inpSum.trim(), reference: inpRef.trim() || undefined }])
                    setInpSum(''); setInpRef('')
                  }}
                >Tambah</Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={!title || !date || !chair || attendees.length === 0}>Simpan</Button>
        </div>
      </form>
    </div>
  )
}
