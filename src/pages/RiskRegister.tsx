import { Fragment, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Plus, Shield, X } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Button, Card, EmptyState, Field, PageHeader, SectionTitle, inputClass } from '../components/ui'
import { RiskLevelBadge, StandardChip } from '../components/Badges'
import type {
  Impact,
  Likelihood,
  Risk,
  RiskCategory,
  RiskLevel,
  RiskStatus,
  RiskTreatment,
} from '../types'
import {
  RISK_CATEGORY_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
  RISK_STATUS_LABEL,
  RISK_TREATMENT_LABEL,
  riskLevelFor,
} from '../types'
import { rolesHavePermission } from '../state/permissions'

const LIKELIHOOD_SCALE: Likelihood[] = [1, 2, 3, 4, 5]
const IMPACT_SCALE: Impact[] = [1, 2, 3, 4, 5]
const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  1: 'Sangat Kecil', 2: 'Kecil', 3: 'Sedang', 4: 'Besar', 5: 'Sangat Besar',
}
const IMPACT_LABEL: Record<Impact, string> = {
  1: 'Sangat Ringan', 2: 'Ringan', 3: 'Sedang', 4: 'Berat', 5: 'Sangat Berat',
}

export function RiskRegister() {
  const { state, currentUser, dispatch } = useApp()
  const { risks, functions } = state
  const canManage = rolesHavePermission(currentUser.roles, 'risk.manage') ||
    rolesHavePermission(currentUser.roles, 'compliance.manage')

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [functionId, setFunctionId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return risks.filter((r) => {
      if (category && r.category !== category) return false
      if (level && r.residualLevel !== level) return false
      if (status && r.status !== status) return false
      if (functionId && r.functionId !== functionId) return false
      if (kw) {
        const hay = `${r.title} ${r.code} ${r.description} ${r.owner}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [risks, category, level, status, functionId, q])

  const funcName = (id: string) => functions.find((f) => f.id === id)?.name ?? id

  // Compact metrics
  const counts: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0, extreme: 0 }
  risks.forEach((r) => { counts[r.residualLevel]++ })

  return (
    <div>
      <PageHeader
        eyebrow="Governance & Compliance"
        title="Register Risiko"
        subtitle="Manajemen risiko berbasis ISO 31000 & ISO 9001 klausul 6.1 — identifikasi, analisis, evaluasi, perlakuan, dan pemantauan risiko lintas fungsi."
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Risiko Baru
            </Button>
          )
        }
      />

      {/* Level distribution */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['extreme', 'high', 'moderate', 'low'] as RiskLevel[]).map((lv) => (
          <Card key={lv} className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: RISK_LEVEL_COLOR[lv].bg, color: RISK_LEVEL_COLOR[lv].text }}
            >
              <AlertTriangle size={17} strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-[24px] font-bold leading-none tabular-nums">{counts[lv]}</div>
              <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">
                Residual {RISK_LEVEL_LABEL[lv]}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle hint="Filter & pencarian">Daftar Risiko</SectionTitle>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <input className={inputClass} placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Semua Kategori</option>
              {Object.entries(RISK_CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Semua Level Residual</option>
              {(['low', 'moderate', 'high', 'extreme'] as RiskLevel[]).map((lv) => (
                <option key={lv} value={lv}>{RISK_LEVEL_LABEL[lv]}</option>
              ))}
            </select>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua Status</option>
              {Object.entries(RISK_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
              <option value="">Semua Fungsi</option>
              {functions.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Tidak ada risiko yang cocok" description="Ubah filter atau tambahkan risiko baru." icon={<AlertTriangle size={18} />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-[12.5px]">
                <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <tr className="border-b border-[var(--color-neutral-border)]">
                    <th className="py-2 pr-3 font-bold">Kode</th>
                    <th className="py-2 pr-3 font-bold">Risiko</th>
                    <th className="py-2 pr-3 font-bold">Fungsi / Owner</th>
                    <th className="py-2 pr-3 font-bold">Kategori</th>
                    <th className="py-2 pr-3 font-bold text-center">Inherent</th>
                    <th className="py-2 pr-3 font-bold text-center">Residual</th>
                    <th className="py-2 pr-3 font-bold">Perlakuan</th>
                    <th className="py-2 pr-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-neutral-border)]">
                  {filtered.map((r) => (
                    <RiskRow key={r.id} risk={r} functionLabel={funcName(r.functionId)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <SectionTitle hint="Distribusi Likelihood × Impact (residual)">Peta Panas Risiko</SectionTitle>
          <RiskHeatmap risks={risks} />
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-neutral-medium)]">
            Kuadran kanan-atas (Likelihood & Impact tinggi) memerlukan perlakuan prioritas.
            Warna menunjukkan level residual berdasarkan skor L × I.
          </p>
        </Card>
      </div>

      {showForm && (
        <NewRiskModal
          onClose={() => setShowForm(false)}
          onSave={(input) => {
            dispatch({ type: 'CREATE_RISK', input, actor: currentUser.name })
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function RiskRow({ risk, functionLabel }: { risk: Risk; functionLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr className="cursor-pointer align-top transition-colors hover:bg-[var(--color-neutral-bg-soft)]" onClick={() => setOpen((o) => !o)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{risk.code}</td>
        <td className="py-2 pr-3">
          <div className="font-semibold text-[var(--color-neutral-dark)]">{risk.title}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {risk.standards.map((s) => (<StandardChip key={s} code={s} />))}
          </div>
        </td>
        <td className="py-2 pr-3">
          <div>{functionLabel}</div>
          <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{risk.owner}</div>
        </td>
        <td className="py-2 pr-3">{RISK_CATEGORY_LABEL[risk.category]}</td>
        <td className="py-2 pr-3 text-center">
          <div className="text-[11.5px] tabular-nums text-[var(--color-neutral-medium)]">
            L{risk.inherentLikelihood} × I{risk.inherentImpact}
          </div>
          <RiskLevelBadge level={risk.inherentLevel} />
        </td>
        <td className="py-2 pr-3 text-center">
          <div className="text-[11.5px] tabular-nums text-[var(--color-neutral-medium)]">
            L{risk.residualLikelihood} × I{risk.residualImpact}
          </div>
          <RiskLevelBadge level={risk.residualLevel} />
        </td>
        <td className="py-2 pr-3">{RISK_TREATMENT_LABEL[risk.treatment].split('—')[0].trim()}</td>
        <td className="py-2 pr-3">{RISK_STATUS_LABEL[risk.status]}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="border-t border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 pb-4 pt-3">
            <RiskDetailInline risk={risk} />
          </td>
        </tr>
      )}
    </>
  )
}

function RiskDetailInline({ risk }: { risk: Risk }) {
  const { currentUser, dispatch, state } = useApp()
  const canManage = rolesHavePermission(currentUser.roles, 'risk.manage') || rolesHavePermission(currentUser.roles, 'compliance.manage')
  const [reviewNote, setReviewNote] = useState('')
  const [controlDesc, setControlDesc] = useState('')
  const [controlOwner, setControlOwner] = useState('')

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
          Deskripsi
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{risk.description}</p>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
          Rencana Perlakuan ({RISK_TREATMENT_LABEL[risk.treatment]})
        </div>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-neutral-dark)]">{risk.treatmentPlan}</p>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
          Kontrol Aktif ({risk.controls.length})
        </div>
        <ul className="mb-3 space-y-1.5">
          {risk.controls.map((c) => (
            <li key={c.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.description}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    backgroundColor: c.effectiveness === 'strong' ? '#dcefe1' : c.effectiveness === 'moderate' ? '#fef1cf' : '#fbe7e6',
                    color: c.effectiveness === 'strong' ? '#1f6a45' : c.effectiveness === 'moderate' ? '#8a5a10' : '#a53c3b',
                  }}
                >
                  {c.effectiveness}
                </span>
              </div>
              <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-medium)]">
                Owner: {c.owner}{c.lastTestedAt ? ` · Diuji ${c.lastTestedAt}` : ''}
              </div>
            </li>
          ))}
          {risk.controls.length === 0 && <li className="text-[11.5px] text-[var(--color-neutral-soft)]">Belum ada kontrol tercatat.</li>}
        </ul>

        {canManage && (
          <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] bg-white p-2">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah Kontrol</div>
            <div className="flex flex-col gap-1.5 sm:flex-row">
              <input className={inputClass} placeholder="Deskripsi kontrol" value={controlDesc} onChange={(e) => setControlDesc(e.target.value)} />
              <select className={inputClass + ' sm:w-40'} value={controlOwner} onChange={(e) => setControlOwner(e.target.value)}>
                <option value="">Owner…</option>
                {state.users.filter((u) => u.active).map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
              </select>
              <Button
                variant="primary"
                size="sm"
                disabled={!controlDesc || !controlOwner}
                onClick={() => {
                  dispatch({
                    type: 'ADD_RISK_CONTROL',
                    riskId: risk.id,
                    control: { description: controlDesc, owner: controlOwner, effectiveness: 'moderate' },
                    actor: currentUser.name,
                  })
                  setControlDesc(''); setControlOwner('')
                }}
              >
                <Shield size={12} /> Simpan
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
          Riwayat Tinjauan
        </div>
        <ul className="mb-3 space-y-1.5">
          {risk.reviews.map((rv) => (
            <li key={rv.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12.5px]">
              <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--color-neutral-medium)]">
                <span className="font-semibold text-[var(--color-neutral-dark)]">{rv.reviewer}</span>
                <span>{rv.date}</span>
              </div>
              <p className="mt-1 leading-relaxed">{rv.note}</p>
            </li>
          ))}
          {risk.reviews.length === 0 && <li className="text-[11.5px] text-[var(--color-neutral-soft)]">Belum ada tinjauan.</li>}
        </ul>

        {canManage && (
          <div className="rounded-md border border-dashed border-[var(--color-neutral-border-strong)] bg-white p-2">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Tambah Catatan Tinjauan</div>
            <textarea
              className={inputClass + ' h-16 resize-none'}
              placeholder="Ringkasan hasil tinjauan…"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
            <div className="mt-1.5 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                disabled={!reviewNote.trim()}
                onClick={() => {
                  dispatch({
                    type: 'ADD_RISK_REVIEW',
                    riskId: risk.id,
                    review: { date: new Date().toISOString().slice(0, 10), reviewer: currentUser.name, note: reviewNote.trim() },
                    actor: currentUser.name,
                  })
                  setReviewNote('')
                }}
              >
                Simpan Tinjauan
              </Button>
            </div>
          </div>
        )}

        {canManage && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Ubah Status:
            </span>
            {(['identified', 'assessed', 'treated', 'monitored', 'closed'] as RiskStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => dispatch({ type: 'UPDATE_RISK_STATUS', riskId: risk.id, status: s, actor: currentUser.name })}
                className={`rounded-md border border-[var(--color-neutral-border)] px-2 py-0.5 text-[11px] transition-colors ${
                  risk.status === s ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-white hover:bg-[var(--color-neutral-bg)]'
                }`}
              >
                {RISK_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RiskHeatmap({ risks }: { risks: Risk[] }) {
  const grid: Record<string, number> = {}
  risks.forEach((r) => {
    const key = `${r.residualLikelihood}-${r.residualImpact}`
    grid[key] = (grid[key] ?? 0) + 1
  })
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[280px]">
        <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1 text-[10px] text-[var(--color-neutral-medium)]">
          <div />
          {IMPACT_SCALE.map((i) => (
            <div key={i} className="text-center font-semibold">I{i}</div>
          ))}
          {[...LIKELIHOOD_SCALE].reverse().map((l) => (
            <Fragment key={`row-${l}`}>
              <div className="pr-1 text-right font-semibold">L{l}</div>
              {IMPACT_SCALE.map((i) => {
                const lv = riskLevelFor(l, i)
                const c = RISK_LEVEL_COLOR[lv]
                const count = grid[`${l}-${i}`] ?? 0
                return (
                  <div
                    key={`c${l}-${i}`}
                    className="flex h-9 items-center justify-center rounded text-[12px] font-bold tabular-nums"
                    style={{ backgroundColor: c.bg, color: c.text }}
                    title={`${LIKELIHOOD_LABEL[l]} × ${IMPACT_LABEL[i]} → ${RISK_LEVEL_LABEL[lv]}${count ? ` (${count} risiko)` : ''}`}
                  >
                    {count > 0 ? count : ''}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

function NewRiskModal({ onClose, onSave }: { onClose: () => void; onSave: (input: {
  title: string; description: string; category: RiskCategory; functionId: string; owner: string;
  standards: string[]; inherentLikelihood: Likelihood; inherentImpact: Impact; treatment: RiskTreatment;
  treatmentPlan: string; residualLikelihood: Likelihood; residualImpact: Impact; reviewDate: string | null;
}) => void }) {
  const { state, currentUser } = useApp()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<RiskCategory>('operational')
  const [functionId, setFunctionId] = useState(currentUser.functionId)
  const [owner, setOwner] = useState(currentUser.name)
  const [standards, setStandards] = useState<string[]>(['ISO31000'])
  const [iL, setIL] = useState<Likelihood>(3)
  const [iI, setII] = useState<Impact>(3)
  const [treatment, setTreatment] = useState<RiskTreatment>('reduce')
  const [treatmentPlan, setTreatmentPlan] = useState('')
  const [rL, setRL] = useState<Likelihood>(2)
  const [rI, setRI] = useState<Impact>(2)
  const [reviewDate, setReviewDate] = useState('')

  function handle(e: FormEvent) {
    e.preventDefault()
    onSave({
      title: title.trim(),
      description: description.trim(),
      category,
      functionId,
      owner,
      standards,
      inherentLikelihood: iL,
      inherentImpact: iI,
      treatment,
      treatmentPlan: treatmentPlan.trim(),
      residualLikelihood: rL,
      residualImpact: rI,
      reviewDate: reviewDate || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handle} className="edms-animate-in max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-[var(--shadow-popover)]">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Risiko Baru</h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">Identifikasi & analisis awal — level level dihitung otomatis dari L × I.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-[var(--color-neutral-bg)]"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Judul Risiko"><input required className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Kegagalan supplier tunggal…" /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Deskripsi"><textarea required rows={3} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <Field label="Kategori">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as RiskCategory)}>
              {Object.entries(RISK_CATEGORY_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </Field>
          <Field label="Fungsi">
            <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
              {state.functions.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
            </select>
          </Field>
          <Field label="Risk Owner">
            <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {state.users.filter((u) => u.active).map((u) => (<option key={u.id} value={u.name}>{u.name}</option>))}
            </select>
          </Field>
          <Field label="Perlakuan">
            <select className={inputClass} value={treatment} onChange={(e) => setTreatment(e.target.value as RiskTreatment)}>
              {Object.entries(RISK_TREATMENT_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
            </select>
          </Field>

          <div className="rounded-md bg-[var(--color-neutral-bg-soft)] p-3 sm:col-span-2">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Skor Inherent (sebelum kontrol)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScoreSlider label="Likelihood" value={iL} onChange={(v) => setIL(v as Likelihood)} labels={LIKELIHOOD_LABEL} />
              <ScoreSlider label="Impact" value={iI} onChange={(v) => setII(v as Impact)} labels={IMPACT_LABEL} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-[var(--color-neutral-medium)]">Skor L × I = <strong className="tabular-nums">{iL * iI}</strong></span>
              <RiskLevelBadge level={riskLevelFor(iL, iI)} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Rencana Perlakuan">
              <textarea required rows={2} className={inputClass} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="Uraikan tindakan mitigasi/transfer/lainnya…" />
            </Field>
          </div>

          <div className="rounded-md bg-[var(--color-neutral-bg-soft)] p-3 sm:col-span-2">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Skor Residual (setelah kontrol)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ScoreSlider label="Likelihood" value={rL} onChange={(v) => setRL(v as Likelihood)} labels={LIKELIHOOD_LABEL} />
              <ScoreSlider label="Impact" value={rI} onChange={(v) => setRI(v as Impact)} labels={IMPACT_LABEL} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-[var(--color-neutral-medium)]">Skor L × I = <strong className="tabular-nums">{rL * rI}</strong></span>
              <RiskLevelBadge level={riskLevelFor(rL, rI)} />
            </div>
          </div>

          <Field label="Jadwal Tinjauan Berikutnya">
            <input type="date" className={inputClass} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </Field>
          <Field label="Standar Terkait (comma-separated)">
            <input className={inputClass} value={standards.join(', ')} onChange={(e) => setStandards(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={!title || !description || !treatmentPlan}>Simpan Risiko</Button>
        </div>
      </form>
    </div>
  )
}

function ScoreSlider({ label, value, onChange, labels }: { label: string; value: number; onChange: (v: number) => void; labels: Record<number, string> }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="font-semibold">{label}</span>
        <span className="tabular-nums text-[var(--color-neutral-medium)]">{value} — {labels[value]}</span>
      </div>
      <input type="range" min={1} max={5} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-brand-primary)]" />
    </div>
  )
}
