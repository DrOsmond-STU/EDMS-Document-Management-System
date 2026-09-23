import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Clock, Plus, Scale, XCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'

const TYPE_LABEL = {
  uu: 'Undang-Undang', pp: 'Peraturan Pemerintah', perpres: 'Peraturan Presiden', permen: 'Peraturan Menteri',
  perda: 'Peraturan Daerah', keputusan: 'Keputusan/SK', sni: 'SNI/Standar', lainnya: 'Lainnya',
}
const CATEGORY_LABEL = {
  lingkungan: 'Lingkungan', k3: 'K3', ketenagakerjaan: 'Ketenagakerjaan', mutu: 'Mutu',
  keamanan_informasi: 'Keamanan Informasi', anti_penyuapan: 'Anti Penyuapan', umum: 'Umum',
}
const STATUS_LABEL = { active: 'Berlaku', revoked: 'Dicabut', replaced: 'Diganti' }
const COMPLIANCE = {
  compliant: { label: 'Patuh', bg: '#e3f1ea', text: '#1d6e48', icon: CheckCircle2 },
  partial: { label: 'Sebagian', bg: '#fdf1dc', text: '#b9791c', icon: AlertTriangle },
  non_compliant: { label: 'Tidak Patuh', bg: '#fbe7e6', text: '#b23b3a', icon: XCircle },
  not_evaluated: { label: 'Belum Dievaluasi', bg: 'var(--color-neutral-bg)', text: 'var(--color-neutral-medium)', icon: CircleDashed },
}

const today = () => new Date().toISOString().slice(0, 10)
const isOverdue = (item) => item.status === 'active' && item.next_evaluation_at && item.next_evaluation_at.slice(0, 10) < today()

function ComplianceBadge({ status }) {
  const c = COMPLIANCE[status] ?? COMPLIANCE.not_evaluated
  const Icon = c.icon
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      <Icon size={11} strokeWidth={2.5} /> {c.label}
    </span>
  )
}

function StatCard({ icon: Icon, value, label, tone, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={`!p-3.5 transition-shadow hover:shadow-md ${active ? 'ring-2 ring-[var(--color-brand-primary)]' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: tone.bg, color: tone.text }}>
            <Icon size={17} strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{value}</div>
            <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{label}</div>
          </div>
        </div>
      </Card>
    </button>
  )
}

function EvaluateForm({ item, onDone }) {
  const [form, setForm] = useState({ compliance_status: 'compliant', evaluation_date: today(), evidence: '', notes: '', next_evaluation_at: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api(`legal-requirements/${item.id}/evaluations`, { method: 'POST', body: { ...form, next_evaluation_at: form.next_evaluation_at || null } })
      setForm((f) => ({ ...f, evidence: '', notes: '', next_evaluation_at: '' }))
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.message) : 'Gagal menyimpan evaluasi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Catat Evaluasi Kepatuhan</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Hasil">
          <select className={inputClass} value={form.compliance_status} onChange={(e) => setForm({ ...form, compliance_status: e.target.value })}>
            {['compliant', 'partial', 'non_compliant'].map((k) => <option key={k} value={k}>{COMPLIANCE[k].label}</option>)}
          </select>
        </Field>
        <Field label="Tanggal Evaluasi"><input type="date" className={inputClass} max={today()} value={form.evaluation_date} onChange={(e) => setForm({ ...form, evaluation_date: e.target.value })} required /></Field>
        <Field label="Evaluasi Berikutnya"><input type="date" className={inputClass} value={form.next_evaluation_at} onChange={(e) => setForm({ ...form, next_evaluation_at: e.target.value })} /></Field>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Bukti Pemenuhan"><textarea className={inputClass} rows={2} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="mis. Laporan RKL-RPL Semester 1 telah diterima DLH" /></Field>
        <Field label="Catatan"><textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
      {error && <p className="mt-1.5 text-[11.5px] text-[#b23b3a]">{error}</p>}
      <div className="mt-2 flex justify-end"><Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan Evaluasi'}</Button></div>
    </form>
  )
}

function ItemRow({ item, canManage, onReload }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const overdue = isOverdue(item)

  async function setStatus(status) {
    setError('')
    try {
      await api(`legal-requirements/${item.id}`, { method: 'PATCH', body: { status } })
      onReload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah status.')
    }
  }

  const needsFollowUp = ['partial', 'non_compliant'].includes(item.compliance_status) && item.status === 'active'
  const findingUrl = `/findings?prefillTitle=${encodeURIComponent(`Ketidakpatuhan: ${item.regulation_number || item.title}`)}`
    + `&prefillDescription=${encodeURIComponent(`Hasil evaluasi kepatuhan ${item.code} (${item.title}): ${COMPLIANCE[item.compliance_status].label}.\n\nKewajiban: ${item.obligations || '-'}`)}`
    + `&prefillClause=${encodeURIComponent(item.regulation_number || item.code)}`
    + `&prefillType=${item.compliance_status === 'non_compliant' ? 'nc_major' : 'nc_minor'}&prefillAuditSource=other`

  return (
    <>
      <tr className={`cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)] ${item.status !== 'active' ? 'opacity-60' : ''}`} onClick={() => setOpen((v) => !v)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{item.code}</td>
        <td className="py-2 pr-3">
          <div className="flex items-start gap-1 font-semibold text-[var(--color-neutral-dark)]">
            {open ? <ChevronUp size={13} className="mt-0.5 shrink-0" /> : <ChevronDown size={13} className="mt-0.5 shrink-0" />}
            <span>{item.title}</span>
          </div>
          <div className="pl-[17px] text-[11px] text-[var(--color-neutral-medium)]">
            {item.regulation_number || '—'}{item.issuer ? ` · ${item.issuer}` : ''}
            {item.status !== 'active' && <span className="ml-1 font-bold">({STATUS_LABEL[item.status]})</span>}
          </div>
        </td>
        <td className="py-2 pr-3 text-[12px]">{TYPE_LABEL[item.regulation_type] ?? item.regulation_type}</td>
        <td className="py-2 pr-3 text-[12px]">{CATEGORY_LABEL[item.category] ?? item.category}</td>
        <td className="py-2 pr-3 text-[12px]">
          <div>{item.org_function?.name ?? '—'}</div>
          {item.owner && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{item.owner}</div>}
        </td>
        <td className="py-2 pr-3"><ComplianceBadge status={item.compliance_status} /></td>
        <td className="py-2 pr-3 text-[11.5px] tabular-nums">
          {item.next_evaluation_at ? (
            <span className={overdue ? 'font-bold text-[#b23b3a]' : 'text-[var(--color-neutral-medium)]'}>
              {item.next_evaluation_at.slice(0, 10)}{overdue ? ' · terlambat' : ''}
            </span>
          ) : <span className="text-[var(--color-neutral-soft)]">—</span>}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
          <td colSpan={7} className="px-3 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                {[['Ringkasan', item.summary], ['Pasal yang Relevan', item.applicable_clauses], ['Kewajiban yang Harus Dipenuhi', item.obligations]].map(([label, value]) => (
                  <div key={label}>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{label}</div>
                    <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--color-neutral-dark)]">{value || '—'}</p>
                  </div>
                ))}
                {canManage && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-[var(--color-neutral-medium)]">Status peraturan:</span>
                    <select className="rounded border border-[var(--color-neutral-border)] bg-white px-1.5 py-1 text-[11.5px]" value={item.status} onChange={(e) => setStatus(e.target.value)}>
                      {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                )}
                {error && <p className="text-[11.5px] text-[#b23b3a]">{error}</p>}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Riwayat Evaluasi ({item.evaluations?.length ?? 0})</div>
                    {needsFollowUp && canManage && (
                      <Link to={findingUrl} className="text-[11.5px] font-semibold text-[var(--color-brand-primary)] hover:underline">+ Buat Temuan Tindak Lanjut</Link>
                    )}
                  </div>
                  {item.evaluations?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {item.evaluations.map((ev) => (
                        <li key={ev.id} className="rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-2 text-[12px]">
                          <div className="flex items-center justify-between gap-2">
                            <ComplianceBadge status={ev.compliance_status} />
                            <span className="text-[10.5px] tabular-nums text-[var(--color-neutral-medium)]">{ev.evaluation_date?.slice(0, 10)} · {ev.evaluator?.name ?? '—'}</span>
                          </div>
                          {ev.evidence && <p className="mt-1 text-[var(--color-neutral-dark)]"><span className="font-semibold">Bukti:</span> {ev.evidence}</p>}
                          {ev.notes && <p className="mt-0.5 text-[var(--color-neutral-medium)]">{ev.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12.5px] text-[var(--color-neutral-medium)]">Belum pernah dievaluasi.</p>
                  )}
                </div>
                {canManage && item.status === 'active' && <EvaluateForm item={item} onDone={onReload} />}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ItemFormModal({ open, onClose, functions, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({
      title: '', regulation_number: '', regulation_type: 'pp', issuer: '', issued_date: '', category: 'lingkungan',
      summary: '', applicable_clauses: '', obligations: '', function_id: '', owner: '', next_evaluation_at: '',
    })
    setError('')
  }, [open])

  if (!form) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const body = { ...form }
      ;['issued_date', 'function_id', 'next_evaluation_at'].forEach((k) => { if (!body[k]) body[k] = null })
      onSaved(await api('legal-requirements', { method: 'POST', body }))
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Peraturan">
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label="Judul Peraturan"><input className={inputClass} value={form.title} onChange={set('title')} required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nomor"><input className={inputClass} value={form.regulation_number} onChange={set('regulation_number')} placeholder="PP No. 22 Tahun 2021" /></Field>
          <Field label="Jenis">
            <select className={inputClass} value={form.regulation_type} onChange={set('regulation_type')}>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Penerbit" hint="Opsional"><input className={inputClass} value={form.issuer} onChange={set('issuer')} /></Field>
          <Field label="Tanggal Terbit" hint="Opsional"><input type="date" className={inputClass} value={form.issued_date} onChange={set('issued_date')} /></Field>
        </div>
        <Field label="Kategori">
          <select className={inputClass} value={form.category} onChange={set('category')}>
            {Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Ringkasan" hint="Opsional"><textarea className={inputClass} rows={2} value={form.summary} onChange={set('summary')} /></Field>
        <Field label="Pasal yang Relevan" hint="Opsional"><textarea className={inputClass} rows={2} value={form.applicable_clauses} onChange={set('applicable_clauses')} /></Field>
        <Field label="Kewajiban yang Harus Dipenuhi" hint="Opsional"><textarea className={inputClass} rows={2} value={form.obligations} onChange={set('obligations')} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fungsi Penanggung Jawab" hint="Opsional">
            <select className={inputClass} value={form.function_id} onChange={set('function_id')}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="PIC" hint="Opsional"><input className={inputClass} value={form.owner} onChange={set('owner')} /></Field>
        </div>
        <Field label="Jadwal Evaluasi Pertama" hint="Opsional"><input type="date" className={inputClass} value={form.next_evaluation_at} onChange={set('next_evaluation_at')} /></Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function LegalRegisterPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('legal.view')
  const canManage = hasPermission('legal.manage')

  const [items, setItems] = useState(null)
  const [stats, setStats] = useState(null)
  const [functions, setFunctions] = useState([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [category, setCategory] = useState('')
  const [compliance, setCompliance] = useState('')
  const [status, setStatus] = useState('active')
  const [overdue, setOverdue] = useState(false)

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (category) qs.set('category', category)
    if (compliance) qs.set('compliance_status', compliance)
    if (status) qs.set('status', status)
    if (overdue) qs.set('overdue', '1')
    api(`legal-requirements?${qs.toString()}`)
      .then((r) => { setItems(r.items); setStats(r.stats) })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat Legal Register.'))
  }, [canView, q, category, compliance, status, overdue])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])
  useEffect(() => {
    if (canView) api('master-data').then((m) => setFunctions(m.functions)).catch(() => {})
  }, [canView])

  function quickFilter(key) {
    if (key === 'overdue') { setOverdue((v) => !v); setCompliance(''); return }
    setOverdue(false)
    setCompliance((c) => (c === key ? '' : key))
  }

  if (!canView) {
    return <Layout><div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Anda tidak berwenang melihat Legal Register.</div></Layout>
  }

  const pct = stats && stats.total_active > 0 ? Math.round((stats.compliant / stats.total_active) * 100) : null

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Governance & Compliance</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Scale size={18} /> Legal Register</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Daftar peraturan perundang-undangan & persyaratan lain yang berlaku, beserta evaluasi kepatuhan berkala (ISO 14001/45001 klausul 6.1.3 & 9.1.2).
          </p>
        </div>
        {canManage && <Button variant="primary" onClick={() => setFormOpen(true)}><Plus size={14} /> Tambah Peraturan</Button>}
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatCard icon={CheckCircle2} value={stats.compliant} label={`Patuh${pct !== null ? ` (${pct}%)` : ''}`} tone={{ bg: '#e3f1ea', text: '#1d6e48' }} active={compliance === 'compliant'} onClick={() => quickFilter('compliant')} />
          <StatCard icon={AlertTriangle} value={stats.partial} label="Patuh Sebagian" tone={{ bg: '#fdf1dc', text: '#b9791c' }} active={compliance === 'partial'} onClick={() => quickFilter('partial')} />
          <StatCard icon={XCircle} value={stats.non_compliant} label="Tidak Patuh" tone={{ bg: '#fbe7e6', text: '#b23b3a' }} active={compliance === 'non_compliant'} onClick={() => quickFilter('non_compliant')} />
          <StatCard icon={CircleDashed} value={stats.not_evaluated} label="Belum Dievaluasi" tone={{ bg: 'var(--color-neutral-bg)', text: 'var(--color-neutral-medium)' }} active={compliance === 'not_evaluated'} onClick={() => quickFilter('not_evaluated')} />
          <StatCard icon={Clock} value={stats.evaluation_overdue} label="Evaluasi Terlambat" tone={{ bg: '#fbd8c3', text: '#a3480d' }} active={overdue} onClick={() => quickFilter('overdue')} />
        </div>
      )}

      <Card>
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Peraturan</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Klik kartu statistik untuk memfilter cepat; klik baris untuk detail & evaluasi</p>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <input className={inputClass} placeholder="Cari judul, nomor, penerbit…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Semua Kategori</option>
            {Object.entries(CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className={inputClass} value={compliance} onChange={(e) => { setCompliance(e.target.value); setOverdue(false) }}>
            <option value="">Semua Status Kepatuhan</option>
            {Object.entries(COMPLIANCE).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua (termasuk dicabut/diganti)</option>
            {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>

        {!items ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Scale size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada peraturan yang cocok dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Kode</th>
                  <th className="py-2 pr-3 font-bold">Peraturan</th>
                  <th className="py-2 pr-3 font-bold">Jenis</th>
                  <th className="py-2 pr-3 font-bold">Kategori</th>
                  <th className="py-2 pr-3 font-bold">Penanggung Jawab</th>
                  <th className="py-2 pr-3 font-bold">Kepatuhan</th>
                  <th className="py-2 pr-3 font-bold">Evaluasi Berikutnya</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => <ItemRow key={it.id} item={it} canManage={canManage} onReload={load} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ItemFormModal open={formOpen} onClose={() => setFormOpen(false)} functions={functions} onSaved={() => { setFormOpen(false); load() }} />
    </Layout>
  )
}
