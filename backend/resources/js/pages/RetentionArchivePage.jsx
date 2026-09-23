import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Lock, Pencil, Plus, Timer, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'
import { DISPOSITION_LABEL, RecordStatusBadge, d, errorText } from './records/shared'

const WORKLISTS = {
  to_inactive: { label: 'Siap Dipindah ke Inaktif', hint: 'Masa aktif sudah habis — pindahkan ke pusat arsip/penyimpanan inaktif.', icon: Archive, tone: { bg: '#fef1cf', text: '#8a5a10' } },
  to_dispose: { label: 'Jatuh Tempo Retensi', hint: 'Masa retensi (aktif + inaktif) habis — lakukan pemusnahan atau penyerahan permanen sesuai keterangan JRA, dengan berita acara.', icon: Trash2, tone: { bg: '#fbe7e6', text: '#b23b3a' } },
  on_hold: { label: 'Legal Hold', hint: 'Rekaman yang ditahan karena sengketa/pemeriksaan — tidak boleh dimusnahkan sampai penahanan dicabut.', icon: Lock, tone: { bg: '#f3c2c1', text: '#7d2726' } },
}

function SeriesFormModal({ open, onClose, initial, functions, onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(initial)

  useEffect(() => {
    if (!open) return
    setForm(initial
      ? { name: initial.name, description: initial.description ?? '', function_id: initial.function_id ?? '', retention_active_years: initial.retention_active_years, retention_inactive_years: initial.retention_inactive_years, disposition: initial.disposition, legal_basis: initial.legal_basis ?? '', active: initial.active }
      : { code: '', name: '', description: '', function_id: '', retention_active_years: 2, retention_inactive_years: 3, disposition: 'destroy', legal_basis: '' })
    setError('')
  }, [open, initial])

  if (!form) return null
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true); setError('')
    const body = { ...form, function_id: form.function_id || null, retention_active_years: Number(form.retention_active_years), retention_inactive_years: Number(form.retention_inactive_years) }
    try {
      onSaved(editing
        ? await api(`record-series/${initial.id}`, { method: 'PATCH', body })
        : await api('record-series', { method: 'POST', body: { ...body, code: form.code.toUpperCase() } }))
    } catch (err) {
      setError(errorText(err, 'Gagal menyimpan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Ubah Seri ${initial.code}` : 'Tambah Seri Rekaman'}>
      <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
        {!editing && <Field label="Kode Seri" hint="Huruf kapital/angka, mis. REK-PLT"><input className={inputClass} value={form.code} onChange={set('code')} required /></Field>}
        <Field label="Nama Seri"><input className={inputClass} value={form.name} onChange={set('name')} placeholder="mis. Rekaman Pelatihan Karyawan" required /></Field>
        <Field label="Deskripsi" hint="Opsional"><textarea className={inputClass} rows={2} value={form.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Retensi Aktif (th)"><input type="number" min={0} max={100} className={inputClass} value={form.retention_active_years} onChange={set('retention_active_years')} required /></Field>
          <Field label="Retensi Inaktif (th)"><input type="number" min={0} max={100} className={inputClass} value={form.retention_inactive_years} onChange={set('retention_inactive_years')} required /></Field>
          <Field label="Keterangan">
            <select className={inputClass} value={form.disposition} onChange={set('disposition')}>
              {Object.entries(DISPOSITION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        {editing && <p className="text-[11px] text-[#8a5a10]">Mengubah masa retensi akan menghitung ulang jatuh tempo semua rekaman seri ini yang belum musnah/permanen.</p>}
        <Field label="Dasar Hukum/Alasan Retensi" hint="Opsional"><input className={inputClass} value={form.legal_basis} onChange={set('legal_basis')} placeholder="mis. PP 35/2021 ps. 15; kebutuhan audit eksternal" /></Field>
        <Field label="Unit Pengolah" hint="Opsional">
          <select className={inputClass} value={form.function_id} onChange={set('function_id')}>
            <option value="">— Tidak ditentukan —</option>
            {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Seri aktif (bisa dipakai untuk rekaman baru)
          </label>
        )}
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function DisposeModal({ target, onClose, onDone }) {
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setReference(''); setError('') }, [target])
  if (!target) return null
  const { record, action } = target
  const destroy = action === 'dispose'

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await api(`records/${record.id}/action`, { method: 'POST', body: { action, disposal_reference: reference } })
      onDone()
    } catch (err) {
      setError(errorText(err, 'Gagal memproses.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={destroy ? 'Musnahkan Rekaman' : 'Serahkan Permanen'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12.5px]">
          <div className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{record.code}</div>
          <div className="font-semibold">{record.title}</div>
          <div className="text-[11.5px] text-[var(--color-neutral-medium)]">Seri {record.series?.code} · keterangan JRA: {DISPOSITION_LABEL[record.series?.disposition]}</div>
        </div>
        <p className={`text-[12px] ${destroy ? 'text-[#b23b3a]' : 'text-[var(--color-neutral-dark)]'}`}>
          {destroy
            ? 'Tindakan ini tidak bisa dibatalkan. Metadata rekaman tetap disimpan sebagai bukti pemusnahan.'
            : 'Rekaman ditandai telah diserahkan ke arsip statis/lembaga kearsipan. Tidak bisa dibatalkan.'}
        </p>
        <Field label={destroy ? 'Nomor Berita Acara Pemusnahan' : 'Nomor Berita Acara Penyerahan'}>
          <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} required />
        </Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant={destroy ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Memproses…' : destroy ? 'Musnahkan' : 'Serahkan Permanen'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function RetentionArchivePage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('records.view')
  const canManage = hasPermission('records.manage')
  const canDispose = hasPermission('records.dispose')

  const [series, setSeries] = useState(null)
  const [functions, setFunctions] = useState([])
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('to_dispose')
  const [worklist, setWorklist] = useState(null)
  const [error, setError] = useState('')
  const [seriesModal, setSeriesModal] = useState({ open: false, initial: null })
  const [disposeTarget, setDisposeTarget] = useState(null)

  const loadSeries = useCallback(() => {
    if (!canView) return
    api('record-series').then((r) => setSeries(r.series)).catch((err) => setError(errorText(err, 'Gagal memuat JRA.')))
  }, [canView])

  const loadWorklist = useCallback(() => {
    if (!canView) return
    setWorklist(null)
    api(`records?due=${tab}`)
      .then((r) => { setWorklist(r.records); setStats(r.stats) })
      .catch((err) => setError(errorText(err, 'Gagal memuat daftar kerja.')))
  }, [canView, tab])

  useEffect(() => { loadSeries() }, [loadSeries])
  useEffect(() => { loadWorklist() }, [loadWorklist])
  useEffect(() => { if (canView) api('master-data').then((m) => setFunctions(m.functions)).catch(() => {}) }, [canView])

  async function act(record, action, extra = {}) {
    setError('')
    try {
      await api(`records/${record.id}/action`, { method: 'POST', body: { action, ...extra } })
      loadWorklist()
    } catch (err) {
      setError(errorText(err, 'Gagal memproses aksi.'))
    }
  }

  if (!canView) return <Layout><div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Anda tidak berwenang melihat Retention & Archive.</div></Layout>

  const statKey = { to_inactive: 'due_to_inactive', to_dispose: 'due_to_dispose', on_hold: 'on_hold' }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Records Management</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Timer size={18} /> Retention & Archive</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Jadwal Retensi Arsip (JRA) per seri rekaman, serta daftar kerja pemindahan inaktif, pemusnahan, dan penyerahan permanen — mengikuti UU 43/2009 tentang Kearsipan.
          </p>
        </div>
        <Link to="/records"><Button variant="secondary">Buka Records Register</Button></Link>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Object.entries(WORKLISTS).map(([key, w]) => {
          const Icon = w.icon
          return (
            <button type="button" key={key} onClick={() => setTab(key)} className="text-left">
              <Card className={`!p-3.5 transition-shadow hover:shadow-md ${tab === key ? 'ring-2 ring-[var(--color-brand-primary)]' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: w.tone.bg, color: w.tone.text }}><Icon size={17} strokeWidth={2.25} /></div>
                  <div>
                    <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{stats ? stats[statKey[key]] : '…'}</div>
                    <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{w.label}</div>
                  </div>
                </div>
              </Card>
            </button>
          )
        })}
      </div>

      <Card className="mb-5">
        <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">{WORKLISTS[tab].label}</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">{WORKLISTS[tab].hint}</p>
        {!worklist ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : worklist.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Tidak ada rekaman di daftar ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Rekaman</th>
                  <th className="py-2 pr-3 font-bold">Seri / Keterangan</th>
                  <th className="py-2 pr-3 font-bold">Lokasi</th>
                  <th className="py-2 pr-3 font-bold">Jatuh Tempo</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 text-right font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {worklist.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-neutral-border)] align-top">
                    <td className="py-2 pr-3"><div className="font-mono text-[11px] text-[var(--color-neutral-medium)]">{r.code}</div><div className="font-semibold">{r.title}</div></td>
                    <td className="py-2 pr-3"><div className="font-mono text-[11px]">{r.series?.code}</div><div className="text-[11px] text-[var(--color-neutral-medium)]">{DISPOSITION_LABEL[r.series?.disposition]}</div></td>
                    <td className="py-2 pr-3 text-[12px]">{r.location || '—'}</td>
                    <td className="py-2 pr-3 text-[11.5px] tabular-nums">
                      {tab === 'to_inactive' ? `Aktif s/d ${d(r.active_until)}` : `Retensi s/d ${d(r.inactive_until)}`}
                      {tab === 'on_hold' && <div className="text-[#7d2726]">{r.legal_hold_reason}</div>}
                    </td>
                    <td className="py-2 pr-3"><RecordStatusBadge status={r.status} /></td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {tab === 'to_inactive' && canManage && <Button size="sm" variant="secondary" onClick={() => act(r, 'deactivate')}>Pindah ke Inaktif</Button>}
                        {tab === 'to_dispose' && canDispose && r.series?.disposition !== 'permanent' && <Button size="sm" variant="danger" onClick={() => setDisposeTarget({ record: r, action: 'dispose' })}>Musnahkan</Button>}
                        {tab === 'to_dispose' && canDispose && r.series?.disposition !== 'destroy' && <Button size="sm" variant="primary" onClick={() => setDisposeTarget({ record: r, action: 'archive_permanent' })}>Serahkan Permanen</Button>}
                        {tab === 'to_dispose' && !canDispose && <span className="text-[11px] text-[var(--color-neutral-medium)]">Perlu izin pemusnahan</span>}
                        {tab === 'on_hold' && canManage && <Button size="sm" variant="secondary" onClick={() => act(r, 'release')}>Cabut Legal Hold</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="mb-1 text-[13px] font-bold text-[var(--color-neutral-dark)]">Jadwal Retensi Arsip (JRA)</h2>
            <p className="text-[11.5px] text-[var(--color-neutral-medium)]">Masa retensi per seri rekaman — berlaku untuk semua rekaman di seri tersebut</p>
          </div>
          {canManage && <Button variant="primary" size="sm" onClick={() => setSeriesModal({ open: true, initial: null })}><Plus size={13} /> Tambah Seri</Button>}
        </div>
        {!series ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : series.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada seri rekaman di JRA.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <tr className="border-b border-[var(--color-neutral-border)]">
                  <th className="py-2 pr-3 font-bold">Kode</th>
                  <th className="py-2 pr-3 font-bold">Seri Rekaman</th>
                  <th className="py-2 pr-3 text-center font-bold">Aktif</th>
                  <th className="py-2 pr-3 text-center font-bold">Inaktif</th>
                  <th className="py-2 pr-3 font-bold">Keterangan</th>
                  <th className="py-2 pr-3 font-bold">Dasar</th>
                  <th className="py-2 pr-3 text-center font-bold">Rekaman</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.id} className={`border-b border-[var(--color-neutral-border)] align-top ${s.active ? '' : 'opacity-50'}`}>
                    <td className="py-2 pr-3 font-mono text-[11.5px]">{s.code}</td>
                    <td className="py-2 pr-3"><div className="font-semibold">{s.name}{!s.active && ' (nonaktif)'}</div><div className="text-[11px] text-[var(--color-neutral-medium)]">{s.org_function?.name ?? ''}</div></td>
                    <td className="py-2 pr-3 text-center tabular-nums">{s.retention_active_years} th</td>
                    <td className="py-2 pr-3 text-center tabular-nums">{s.retention_inactive_years} th</td>
                    <td className="py-2 pr-3 font-semibold">{DISPOSITION_LABEL[s.disposition]}</td>
                    <td className="py-2 pr-3 text-[11.5px] text-[var(--color-neutral-medium)]">{s.legal_basis || '—'}</td>
                    <td className="py-2 pr-3 text-center tabular-nums">{s.records_count}</td>
                    <td className="py-2 pr-3 text-right">
                      {canManage && <button type="button" className="text-[var(--color-neutral-medium)] hover:text-[var(--color-brand-primary)]" onClick={() => setSeriesModal({ open: true, initial: s })} title="Ubah"><Pencil size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SeriesFormModal
        open={seriesModal.open}
        initial={seriesModal.initial}
        functions={functions}
        onClose={() => setSeriesModal({ open: false, initial: null })}
        onSaved={() => { setSeriesModal({ open: false, initial: null }); loadSeries(); loadWorklist() }}
      />
      <DisposeModal target={disposeTarget} onClose={() => setDisposeTarget(null)} onDone={() => { setDisposeTarget(null); loadWorklist(); loadSeries() }} />
    </Layout>
  )
}
