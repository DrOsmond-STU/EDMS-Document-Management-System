import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, StatusBadge, inputClass } from '../components/ui'

const TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir']
const CLASSIFICATIONS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret']

function CreateDocumentForm({ masterData, onCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('SOP')
  const [functionId, setFunctionId] = useState(masterData.functions[0]?.id ?? '')
  const [classification, setClassification] = useState('internal')
  const [standards, setStandards] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function toggleStandard(code) {
    setStandards((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const doc = await api('documents', { method: 'POST', body: { title, type, function_id: functionId, classification, standards } })
      onCreated(doc)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.message || JSON.stringify(err.body?.errors)) : 'Gagal membuat dokumen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Judul"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Fungsi/Departemen">
            <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
              {masterData.functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Klasifikasi">
          <select className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value)}>
            {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Standar Terkait" hint="Boleh lebih dari satu">
          <div className="flex flex-wrap gap-1.5">
            {masterData.standards.map((s) => (
              <button type="button" key={s.code} onClick={() => toggleStandard(s.code)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${standards.includes(s.code) ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]' : 'border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)]'}`}>
                {s.code}
              </button>
            ))}
          </div>
        </Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? 'Menyimpan…' : 'Buat Dokumen'}</Button>
        </div>
      </form>
    </Card>
  )
}

export default function DocumentsPage() {
  const { user, hasPermission, logout } = useAuth()
  const [documents, setDocuments] = useState(null)
  const [masterData, setMasterData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [docs, master] = await Promise.all([api('documents'), api('master-data')])
      setDocuments(docs)
      setMasterData(master)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
    }
  }

  useEffect(() => { load() }, [])

  const canCreate = hasPermission('document.draft') || hasPermission('document.control')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Register Dokumen</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            {user?.name} · {user?.roles?.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
              <Plus size={14} /> Dokumen Baru
            </Button>
          )}
          <Button variant="ghost" onClick={logout}>Keluar</Button>
        </div>
      </div>

      {showForm && masterData && (
        <CreateDocumentForm
          masterData={masterData}
          onCancel={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); load() }}
        />
      )}

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {!documents ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : documents.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <FileText size={28} className="text-[var(--color-neutral-soft)]" />
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Belum ada dokumen yang terlihat oleh Anda.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <th className="px-3 py-2 font-semibold">Kode</th>
                <th className="px-3 py-2 font-semibold">Judul</th>
                <th className="px-3 py-2 font-semibold">Fungsi</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Berkas</th>
              </tr>
            </thead>
            <tbody>
              {documents.data.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-neutral-border)] last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                  <td className="px-3 py-2.5 font-mono text-[12px] font-semibold">
                    <Link to={`/documents/${d.id}`} className="text-[var(--color-brand-primary)] hover:underline">{d.code}</Link>
                  </td>
                  <td className="px-3 py-2.5">{d.title}</td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.org_function?.name ?? '—'}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.files_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
