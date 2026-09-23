import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'
import {
  CLASSIFICATION_LABEL, DISPOSITION_LABEL, HoldBadge, MEDIUM_LABEL, RECORD_STATUS, RecordStatusBadge, d, errorText, today,
} from './records/shared'

function StatCard({ status, count }) {
  const c = RECORD_STATUS[status]
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg, color: c.text }}>
          <Archive size={17} strokeWidth={2.25} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{count}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{c.label}</div>
        </div>
      </div>
    </Card>
  )
}

function RecordRow({ record, canManage, onReload }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const final = ['destroyed', 'archived_permanent'].includes(record.status)
  const activeDue = record.status === 'active' && d(record.active_until) <= today()

  async function act(action, extra = {}) {
    setError('')
    try {
      await api(`records/${record.id}/action`, { method: 'POST', body: { action, ...extra } })
      onReload()
    } catch (err) {
      setError(errorText(err, 'Gagal memproses aksi.'))
    }
  }

  return (
    <>
      <tr className={`cursor-pointer border-b border-[var(--color-neutral-border)] align-top hover:bg-[var(--color-neutral-bg-soft)] ${final ? 'opacity-60' : ''}`} onClick={() => setOpen((v) => !v)}>
        <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{record.code}</td>
        <td className="py-2 pr-3">
          <div className="flex items-start gap-1 font-semibold text-[var(--color-neutral-dark)]">
            {open ? <ChevronUp size={13} className="mt-0.5 shrink-0" /> : <ChevronDown size={13} className="mt-0.5 shrink-0" />}
            <span>{record.title}</span>
          </div>
          {record.location && <div className="pl-[17px] text-[11px] text-[var(--color-neutral-medium)]">Lokasi: {record.location}</div>}
        </td>
        <td className="py-2 pr-3 text-[12px]">
          <div className="font-mono text-[11px]">{record.series?.code}</div>
          <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{record.series?.name}</div>
        </td>
        <td className="py-2 pr-3 tabular-nums">{d(record.record_date)}</td>
        <td className="py-2 pr-3">{MEDIUM_LABEL[record.medium] ?? record.medium}</td>
        <td className="py-2 pr-3 text-[11.5px] tabular-nums">
          <div className={activeDue ? 'font-bold text-[#b9791c]' : ''}>Aktif s/d {d(record.active_until)}</div>
          <div className="text-[var(--color-neutral-medium)]">Inaktif s/d {d(record.inactive_until)}</div>
        </td>
        <td className="py-2 pr-3">
          <div className="flex flex-col items-start gap-1">
            <RecordStatusBadge status={record.status} />
            {record.legal_hold && !final && <HoldBadge />}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
          <td colSpan={7} className="px-3 pb-4 pt-3 text-[12.5px]" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Deskripsi</div>
                <p className="whitespace-pre-line text-[var(--color-neutral-dark)]">{record.description || '—'}</p>
              </div>
              <div className="space-y-1">
                <div><span className="text-[var(--color-neutral-medium)]">Klasifikasi:</span> {CLASSIFICATION_LABEL[record.classification] ?? record.classification}</div>
                <div><span className="text-[var(--color-neutral-medium)]">Unit:</span> {record.org_function?.name ?? '—'}</div>
                <div><span className="text-[var(--color-neutral-medium)]">Keterangan JRA:</span> {DISPOSITION_LABEL[record.series?.disposition] ?? '—'}</div>
                {record.document && (
                  <div><span className="text-[var(--color-neutral-medium)]">Dokumen asal:</span> <Link className="font-semibold text-[var(--color-brand-primary)] hover:underline" to={`/documents/${record.document.id}`}>{record.document.code}</Link></div>
                )}
              </div>
              <div className="space-y-1">
                {record.legal_hold && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-2.5 py-1.5 text-[#7d2c2b]"><b>Legal hold:</b> {record.legal_hold_reason}</div>}
                {final ? (
                  <div className="rounded-md border border-[var(--color-neutral-border)] bg-white px-2.5 py-1.5">
                    <div><b>{record.status === 'destroyed' ? 'Dimusnahkan' : 'Diserahkan permanen'}</b> {d(record.disposed_at)}</div>
                    <div>BA: {record.disposal_reference}</div>
                    <div className="text-[var(--color-neutral-medium)]">oleh {record.disposer?.name ?? '—'}</div>
                  </div>
                ) : canManage && (
                  <div className="flex flex-wrap gap-1.5">
                    {record.status === 'active' && <Button size="sm" variant="secondary" onClick={() => act('deactivate')}>Pindah ke Inaktif</Button>}
                    {record.legal_hold ? (
                      <Button size="sm" variant="secondary" onClick={() => act('release')}>Cabut Legal Hold</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => { const reason = window.prompt('Alasan penahanan legal (mis. sengketa, pemeriksaan pajak):'); if (reason) act('hold', { reason }) }}>Tahan (Legal Hold)</Button>
                    )}
                  </div>
                )}
                {error && <p className="text-[11.5px] text-[#b23b3a]">{error}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RecordFormModal({ open, onClose, series, functions, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm({ series_id: '', title: '', description: '', record_date: today(), medium: 'physical', location: '', classification: 'internal', function_id: '' })
    setError('')
  }, [open])

  const selected = useMemo(() => series.find((s) => String(s.id) === String(form?.series_id)), [series, form?.series_id])
  const preview = useMemo(() => {
    if (!selected || !form?.record_date) return null
    const base = new Date(form.record_date)
    const a = new Date(base); a.setUTCFullYear(a.getUTCFullYear() + selected.retention_active_years)
    const i = new Date(a); i.setUTCFullYear(i.getUTCFullYear() + selected.retention_inactive_years)
    return { active: a.toISOString().slice(0, 10), inactive: i.toISOString().slice(0, 10) }
  }, [selected, form?.record_date])

  if (!form) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      onSaved(await api('records', { method: 'POST', body: { ...form, series_id: Number(form.series_id), function_id: form.function_id || null } }))
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Daftarkan Rekaman">
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
        <Field label="Seri Rekaman (JRA)">
          <select className={inputClass} value={form.series_id} onChange={set('series_id')} required>
            <option value="">— Pilih seri —</option>
            {series.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
        </Field>
        {selected && (
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-dark)]">
            Retensi: aktif {selected.retention_active_years} th + inaktif {selected.retention_inactive_years} th → <b>{DISPOSITION_LABEL[selected.disposition]}</b>
            {preview && <div className="text-[var(--color-neutral-medium)]">Aktif s/d {preview.active} · jatuh tempo retensi {preview.inactive}</div>}
          </div>
        )}
        <Field label="Judul Rekaman"><input className={inputClass} value={form.title} onChange={set('title')} placeholder="mis. Daftar hadir pelatihan K3 — Maret 2026" required /></Field>
        <Field label="Deskripsi" hint="Opsional"><textarea className={inputClass} rows={2} value={form.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tanggal Rekaman"><input type="date" max={today()} className={inputClass} value={form.record_date} onChange={set('record_date')} required /></Field>
          <Field label="Media">
            <select className={inputClass} value={form.medium} onChange={set('medium')}>
              {Object.entries(MEDIUM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Lokasi Simpan" hint="Lemari/rak/box untuk fisik, atau path/sistem untuk elektronik"><input className={inputClass} value={form.location} onChange={set('location')} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Klasifikasi">
            <select className={inputClass} value={form.classification} onChange={set('classification')}>
              {Object.entries(CLASSIFICATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Unit" hint="Opsional">
            <select className={inputClass} value={form.function_id} onChange={set('function_id')}>
              <option value="">— Tidak ditentukan —</option>
              {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Daftarkan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function RecordsRegisterPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('records.view')
  const canManage = hasPermission('records.manage')

  const [records, setRecords] = useState(null)
  const [stats, setStats] = useState(null)
  const [series, setSeries] = useState([])
  const [functions, setFunctions] = useState([])
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [q, setQ] = useState('')
  const [seriesId, setSeriesId] = useState('')
  const [status, setStatus] = useState('')
  const [medium, setMedium] = useState('')

  const load = useCallback(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (seriesId) qs.set('series_id', seriesId)
    if (status) qs.set('status', status)
    if (medium) qs.set('medium', medium)
    api(`records?${qs.toString()}`)
      .then((r) => { setRecords(r.records); setStats(r.stats) })
      .catch((err) => setError(errorText(err, 'Gagal memuat Records Register.')))
  }, [canView, q, seriesId, status, medium])

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => {
    if (!canView) return
    api('record-series').then((r) => setSeries(r.series)).catch(() => {})
    api('master-data').then((m) => setFunctions(m.functions)).catch(() => {})
  }, [canView])

  if (!canView) return <Layout><div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Anda tidak berwenang melihat Records Register.</div></Layout>

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Records Management</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Archive size={18} /> Records Register</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Register rekaman terkendali (ISO 9001 klausul 7.5.3) — bukti kegiatan beserta lokasi simpan dan jatuh tempo retensi sesuai Jadwal Retensi Arsip.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/retention"><Button variant="secondary">Jadwal Retensi & Arsip</Button></Link>
          {canManage && <Button variant="primary" onClick={() => setFormOpen(true)} disabled={series.length === 0} title={series.length === 0 ? 'Buat seri rekaman di Jadwal Retensi terlebih dahulu' : ''}><Plus size={14} /> Daftarkan Rekaman</Button>}
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {canManage && series.length === 0 && (
        <div className="mb-4 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12px]">
          Belum ada seri rekaman. <Link to="/retention" className="font-semibold text-[var(--color-brand-primary)] hover:underline">Susun Jadwal Retensi Arsip</Link> terlebih dahulu sebelum mendaftarkan rekaman.
        </div>
      )}

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.keys(RECORD_STATUS).map((s) => <StatCard key={s} status={s} count={stats[s]} />)}
        </div>
      )}

      <Card>
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Daftar Rekaman</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">Klik baris untuk detail & aksi</p>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <input className={inputClass} placeholder="Cari judul, kode, lokasi…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputClass} value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
            <option value="">Semua Seri</option>
            {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            {Object.entries(RECORD_STATUS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <select className={inputClass} value={medium} onChange={(e) => setMedium(e.target.value)}>
            <option value="">Semua Media</option>
            {Object.entries(MEDIUM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {!records ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Archive size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada rekaman yang cocok dengan filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Kode</th>
                  <th className="py-2 pr-3 font-bold">Rekaman</th>
                  <th className="py-2 pr-3 font-bold">Seri</th>
                  <th className="py-2 pr-3 font-bold">Tanggal</th>
                  <th className="py-2 pr-3 font-bold">Media</th>
                  <th className="py-2 pr-3 font-bold">Retensi</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>{records.map((r) => <RecordRow key={r.id} record={r} canManage={canManage} onReload={load} />)}</tbody>
            </table>
          </div>
        )}
      </Card>

      <RecordFormModal open={formOpen} onClose={() => setFormOpen(false)} series={series} functions={functions} onSaved={() => { setFormOpen(false); load() }} />
    </Layout>
  )
}
