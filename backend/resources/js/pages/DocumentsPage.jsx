import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, Plus, Search } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, ClassificationBadge, Field, StandardChip, StatusBadge, ValidityBadge, inputClass } from '../components/ui'

const TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir']
const CLASSIFICATIONS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret']
const CLASSIFICATION_LABEL = {
  public: 'Public', internal: 'Internal', restricted: 'Restricted',
  confidential: 'Confidential', secret: 'Secret', top_secret: 'Top Secret',
}
const STATUSES = ['draft', 'review', 'approval', 'released', 'obsolete', 'frozen', 'revoked', 'cancelled']
const STATUS_LABEL = {
  draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', obsolete: 'Obsolete',
  frozen: 'Dibekukan', revoked: 'Dicabut', cancelled: 'Dibatalkan',
}

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
            {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>)}
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
  const { hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()

  const [documents, setDocuments] = useState(null)
  const [totalCount, setTotalCount] = useState(null)
  const [masterData, setMasterData] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const [keyword, setKeyword] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState('')
  const [functionId, setFunctionId] = useState('')
  const [type, setType] = useState('')
  const [standard, setStandard] = useState('')
  const [classification, setClassification] = useState('')
  const [page, setPage] = useState(1)

  // Baseline jumlah dokumen TANPA filter — dipakai untuk subjudul "X dari Y
  // dokumen", persis seperti register versi lama. Cukup diambil sekali.
  useEffect(() => {
    api('documents?per_page=1').then((r) => setTotalCount(r.total)).catch(() => {})
    api('master-data').then(setMasterData).catch((err) => {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data acuan.')
    })
  }, [])

  function buildQuery() {
    const qs = new URLSearchParams()
    if (keyword.trim()) qs.set('q', keyword.trim())
    if (status) qs.set('status', status)
    if (functionId) qs.set('function_id', functionId)
    if (type) qs.set('type', type)
    if (standard) qs.set('standard', standard)
    if (classification) qs.set('classification', classification)
    qs.set('page', String(page))
    return qs.toString()
  }

  function fetchDocuments() {
    api(`documents?${buildQuery()}`)
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen.'))
  }

  useEffect(() => {
    // Debounce ringan supaya mengetik kata kunci tidak memicu satu
    // permintaan per huruf.
    const handle = setTimeout(fetchDocuments, keyword ? 300 : 0)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, status, functionId, type, standard, classification, page])

  // Setiap kali salah satu filter berubah, kembali ke halaman 1.
  function updateFilter(setter) {
    return (value) => {
      setter(value)
      setPage(1)
    }
  }

  function handleKeywordChange(value) {
    setKeyword(value)
    setPage(1)
    setParams(value ? { q: value } : {})
  }

  const canCreate = hasPermission('document.draft') || hasPermission('document.control')
  const funcName = (id) => masterData?.functions.find((f) => f.id === id)?.name ?? '—'

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Register Dokumen</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            {documents ? `${documents.total} dari ${totalCount ?? documents.total} dokumen` : 'Draft → Review → Approval → Released → Obsolete'}
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={14} /> Dokumen Baru
          </Button>
        )}
      </div>

      {showForm && masterData && (
        <CreateDocumentForm
          masterData={masterData}
          onCancel={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchDocuments() }}
        />
      )}

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 md:col-span-1 lg:col-span-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
          <input
            className={`${inputClass} pl-7`}
            placeholder="Cari kata kunci…"
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
          />
        </div>
        <select className={inputClass} value={status} onChange={(e) => updateFilter(setStatus)(e.target.value)}>
          <option value="">Semua Status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className={inputClass} value={functionId} onChange={(e) => updateFilter(setFunctionId)(e.target.value)}>
          <option value="">Semua Fungsi</option>
          {masterData?.functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className={inputClass} value={type} onChange={(e) => updateFilter(setType)(e.target.value)}>
          <option value="">Semua Jenis</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={inputClass} value={standard} onChange={(e) => updateFilter(setStandard)(e.target.value)}>
          <option value="">Semua Standar</option>
          {masterData?.standards.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
        </select>
        <select className={inputClass} value={classification} onChange={(e) => updateFilter(setClassification)(e.target.value)}>
          <option value="">Semua Klasifikasi</option>
          {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>)}
        </select>
      </div>

      {!documents ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : documents.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <FileText size={28} className="text-[var(--color-neutral-soft)]" />
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada dokumen yang cocok dengan filter.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-border)] bg-white">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <th className="px-3 py-2 font-semibold">Kode</th>
                  <th className="px-3 py-2 font-semibold">Judul</th>
                  <th className="px-3 py-2 font-semibold">Fungsi</th>
                  <th className="px-3 py-2 font-semibold">Standar</th>
                  <th className="px-3 py-2 font-semibold">Klasifikasi</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Validitas</th>
                  <th className="px-3 py-2 font-semibold">Versi</th>
                  <th className="px-3 py-2 font-semibold">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {documents.data.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--color-neutral-border)] last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                    <td className="px-3 py-2.5 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{d.code}</td>
                    <td className="px-3 py-2.5">
                      <Link to={`/documents/${d.id}`} className="font-medium hover:text-[var(--color-brand-primary)] hover:underline">
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.org_function?.name ?? funcName(d.function_id)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {d.standards?.map((s) => <StandardChip key={s.code} code={s.code} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><ClassificationBadge level={d.classification} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                    <td className="px-3 py-2.5"><ValidityBadge validity={d.display_validity ?? d.validity} /></td>
                    <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.version}</td>
                    <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.files_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {documents.last_page > 1 && (
            <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--color-neutral-medium)]">
              <span>Halaman {documents.current_page} dari {documents.last_page}</span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={documents.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={13} /> Sebelumnya
                </Button>
                <Button variant="secondary" size="sm" disabled={documents.current_page >= documents.last_page} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
