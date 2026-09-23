import { useCallback, useEffect, useState } from 'react'
import { Database, FileText, Layers, ListTree, Pencil, Plus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { BasePill, Button, Card, ConfirmDelete, Field, IconAction, inputClass, Modal, useConfirmDelete } from '../components/ui'

const TABS = [
  { key: 'functions', label: 'Fungsi & Departemen' },
  { key: 'standards', label: 'Standar' },
]

/** Dipakai untuk kedua jenis master data — bedanya cuma label field id/kode
 *  dan pola validasinya (server yang menegakkan, form ini hanya beri hint).
 *  id/kode tidak bisa diubah setelah dibuat (lihat MasterDataController). */
function EntryFormModal({ open, onClose, idLabel, idHint, editing, onSaved, endpoint }) {
  const isEdit = Boolean(editing)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setId(editing?.id ?? editing?.code ?? '')
    setName(editing?.name ?? '')
    setActive(editing?.active ?? true)
    setError('')
  }, [open, editing])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = isEdit
        ? await api(`${endpoint}/${editing.id ?? editing.code}`, { method: 'PATCH', body: { name, active } })
        : await api(endpoint, { method: 'POST', body: { [idLabel === 'Kode Standar' ? 'code' : 'id']: id, name } })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Ubah Entri' : 'Entri Baru'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label={idLabel} hint={isEdit ? 'Tidak bisa diubah — sudah dipakai di nomor dokumen.' : idHint}>
          <input className={inputClass} value={id} onChange={(e) => setId(e.target.value)} disabled={isEdit} required />
        </Field>
        <Field label="Nama"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        {isEdit && (
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Aktif (tampil di dropdown formulir dokumen)
          </label>
        )}
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Tambah'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function EntryTable({ rows, idKey, countColumns, onEdit, onToggleActive, onDelete, onClauses, busyId }) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-14 text-center">
        <Database size={28} className="text-[var(--color-neutral-soft)]" />
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada entri.</p>
      </Card>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-border)] bg-white">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
            <th className="px-3 py-2 font-semibold">Kode</th>
            <th className="px-3 py-2 font-semibold">Nama</th>
            {countColumns.map((c) => <th key={c.key} className="px-3 py-2 font-semibold">{c.label}</th>)}
            <th className="px-3 py-2 font-semibold">Status</th>
            <th className="px-3 py-2 font-semibold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[idKey]} className="border-b border-[var(--color-neutral-border)] align-top last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
              <td className="px-3 py-2.5 font-mono text-[12px] font-semibold">{row[idKey]}</td>
              <td className="px-3 py-2.5">{row.name}</td>
              {countColumns.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{row[c.key]}</td>
              ))}
              <td className="px-3 py-2.5">
                {row.active
                  ? <BasePill bg="#E5F5EC" text="#1E8E5A">Aktif</BasePill>
                  : <BasePill bg="#E9EEF2" text="#55606B">Nonaktif</BasePill>}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex justify-end gap-1">
                  {onClauses && <Button variant="ghost" size="sm" title="Kelola klausul" onClick={() => onClauses(row)}><ListTree size={13} /> Klausul</Button>}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>Ubah</Button>
                  <Button
                    variant="ghost" size="sm" disabled={busyId === row[idKey]}
                    title={row.active ? 'Nonaktifkan' : 'Aktifkan'}
                    onClick={() => onToggleActive(row)}
                  >
                    {row.active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                  </Button>
                  <Button variant="ghost" size="sm" title="Hapus" onClick={() => onDelete(row)} className="hover:!bg-[#fbe7e6] hover:!text-[#b23b3a]">
                    <Trash2 size={13} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** CRUD klausul sebuah standar — baris-baris Compliance Matrix. */
function ClausesModal({ standard, onClose }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ code: '', title: '' })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const del = useConfirmDelete()
  const base = `master-data/standards/${encodeURIComponent(standard.code)}/clauses`
  const load = useCallback(() => { api(base).then(setData).catch((e) => setError(e.message)) }, [base])
  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      if (editing) await api(`${base}/${editing.id}`, { method: 'PATCH', body: { code: editing.code, title: editing.title } })
      else await api(base, { method: 'POST', body: form })
      setForm({ code: '', title: '' }); setEditing(null); load()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.message) : 'Gagal menyimpan.')
    }
  }

  return (
    <Modal open onClose={onClose} title={`Klausul ${standard.code}`}>
      <div className="flex max-h-[70vh] flex-col gap-3">
        <form onSubmit={save} className="grid grid-cols-[90px_1fr_auto] gap-1.5">
          <input className={inputClass} placeholder="No." value={editing ? editing.code : form.code} required maxLength={32}
            onChange={(e) => (editing ? setEditing({ ...editing, code: e.target.value }) : setForm({ ...form, code: e.target.value }))} />
          <input className={inputClass} placeholder="Judul klausul" value={editing ? editing.title : form.title} required maxLength={255}
            onChange={(e) => (editing ? setEditing({ ...editing, title: e.target.value }) : setForm({ ...form, title: e.target.value }))} />
          <Button type="submit" variant="primary" size="sm">{editing ? 'Simpan' : 'Tambah'}</Button>
        </form>
        {editing && <button type="button" className="self-start text-[11.5px] font-semibold text-[var(--color-neutral-medium)] hover:underline" onClick={() => setEditing(null)}>Batal ubah</button>}
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="overflow-y-auto rounded-md border border-[var(--color-neutral-border)]">
          {!data ? <p className="p-3 text-[12px] text-[var(--color-neutral-medium)]">Memuat…</p> : data.clauses.length === 0 ? (
            <p className="p-3 text-[12px] text-[var(--color-neutral-medium)]">Belum ada klausul.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-neutral-border)]">
              {data.clauses.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]">
                  <span className="w-12 shrink-0 font-mono text-[11.5px] font-bold">{c.code}</span>
                  <span className="flex-1">{c.title}</span>
                  {c.assessments_count > 0 && <span className="text-[10.5px] text-[var(--color-neutral-medium)]">{c.assessments_count} penilaian</span>}
                  <IconAction icon={Pencil} label="Ubah klausul" onClick={() => setEditing({ id: c.id, code: c.code, title: c.title })} />
                  <IconAction icon={Trash2} label="Hapus klausul" danger onClick={() => del.ask(c)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDelete open={del.open} onClose={del.close} title="Hapus klausul?" what={del.target && `${standard.code} ${del.target.code} — ${del.target.title}`}
        note="Klausul yang sudah punya penilaian di Compliance Matrix tidak bisa dihapus."
        onConfirm={() => api(`${base}/${del.target.id}`, { method: 'DELETE' })} onDone={load} />
    </Modal>
  )
}

export default function MasterDataPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('masterdata.manage')

  const [tab, setTab] = useState('functions')
  const [functions, setFunctions] = useState(null)
  const [standards, setStandards] = useState(null)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [clausesOf, setClausesOf] = useState(null)
  const del = useConfirmDelete()

  const load = useCallback(() => {
    if (!canManage) return
    api('master-data/org-functions').then(setFunctions).catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat fungsi/departemen.'))
    api('master-data/standards').then(setStandards).catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat standar.'))
  }, [canManage])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(row) {
    setEditing(row)
    setFormOpen(true)
  }

  function handleSaved() {
    setFormOpen(false)
    load()
  }

  async function handleToggleActive(row, endpoint, idKey) {
    setBusyId(row[idKey])
    try {
      await api(`${endpoint}/${row[idKey]}`, { method: 'PATCH', body: { active: !row.active } })
      load()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang mengelola master data. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  const isFunctions = tab === 'functions'

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            <Database size={18} /> Master Data
          </h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            Data acuan yang dirujuk lintas modul. Entri yang belum pernah dipakai bisa dihapus; yang sudah dipakai cukup dinonaktifkan agar riwayat tetap utuh.
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}><Plus size={14} /> Entri Baru</Button>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-4 flex gap-1.5 border-b border-[var(--color-neutral-border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-semibold transition-colors ${
              tab === t.key
                ? 'border-b-2 border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]'
                : 'text-[var(--color-neutral-medium)] hover:text-[var(--color-neutral-dark)]'
            }`}
          >
            {t.key === 'functions' ? <Layers size={13} className="mr-1 inline" /> : <FileText size={13} className="mr-1 inline" />}
            {t.label}
          </button>
        ))}
      </div>

      {isFunctions ? (
        !functions ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : (
          <EntryTable
            rows={functions}
            idKey="id"
            countColumns={[
              { key: 'documents_count', label: 'Dokumen' },
              { key: 'users_count', label: 'Pengguna' },
            ]}
            onEdit={openEdit}
            onToggleActive={(row) => handleToggleActive(row, 'master-data/org-functions', 'id')}
            onDelete={(row) => del.ask({ path: `master-data/org-functions/${row.id}`, label: `${row.id} — ${row.name}` })}
            busyId={busyId}
          />
        )
      ) : (
        !standards ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : (
          <EntryTable
            rows={standards}
            idKey="code"
            countColumns={[{ key: 'documents_count', label: 'Dokumen' }, { key: 'clauses_count', label: 'Klausul' }]}
            onEdit={openEdit}
            onToggleActive={(row) => handleToggleActive(row, 'master-data/standards', 'code')}
            onDelete={(row) => del.ask({ path: `master-data/standards/${row.code}`, label: `${row.code} — ${row.name}` })}
            onClauses={setClausesOf}
            busyId={busyId}
          />
        )
      )}

      <EntryFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        idLabel={isFunctions ? 'Kode Fungsi' : 'Kode Standar'}
        idHint={isFunctions ? 'Huruf kecil, mis. "marketing" — ikut membentuk nomor dokumen (SOP-MARKETING-001).' : 'Mis. "ISO9001" — dirujuk di Compliance Matrix & dokumen.'}
        editing={editing}
        endpoint={isFunctions ? 'master-data/org-functions' : 'master-data/standards'}
        onSaved={handleSaved}
      />
      {clausesOf && <ClausesModal standard={clausesOf} onClose={() => { setClausesOf(null); load() }} />}
      <ConfirmDelete
        open={del.open} onClose={del.close} title={isFunctions ? 'Hapus fungsi/departemen?' : 'Hapus standar?'} what={del.target?.label}
        note="Hanya bisa dihapus bila belum dipakai di dokumen, pengguna, risiko, temuan, audit, dll. Bila sudah dipakai, gunakan Nonaktifkan agar riwayat tetap utuh."
        onConfirm={() => api(del.target.path, { method: 'DELETE' })} onDone={load}
      />
    </Layout>
  )
}
