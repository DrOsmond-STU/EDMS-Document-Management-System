import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { api, ApiError } from '../api'
import { Layout } from '../components/Layout'
import { Button, Card, StatusBadge } from '../components/ui'

function UploadForm({ documentId, onUploaded }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('is_primary', '1')
      await api(`documents/${documentId}/files`, { method: 'POST', body: form, isForm: true })
      setFile(null)
      onUploaded()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors?.file?.[0] || err.message) : 'Gagal mengunggah.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-[12px]"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
      />
      <Button type="submit" variant="primary" size="sm" disabled={!file || submitting}>
        <Upload size={12} /> {submitting ? 'Mengunggah…' : 'Unggah'}
      </Button>
      {error && <span className="text-[11.5px] text-[var(--color-brand-danger)]">{error}</span>}
    </form>
  )
}

function FileRow({ documentId, file, canManage, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(null)

  async function handleDownload() {
    const res = await fetch(`/api/documents/${documentId}/files/${file.id}/download`, { credentials: 'same-origin' })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.original_name
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleVerify() {
    setBusy(true)
    try {
      const r = await api(`documents/${documentId}/files/${file.id}/verify`)
      setVerified(r.intact)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Hapus berkas "${file.original_name}"?`)) return
    setBusy(true)
    try {
      await api(`documents/${documentId}/files/${file.id}`, { method: 'DELETE' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-neutral-border)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold">{file.original_name}</div>
        <div className="text-[11px] text-[var(--color-neutral-medium)]">
          {file.size_for_humans} · diunggah oleh {file.uploaded_by_name}
          {verified !== null && (
            <span className={verified ? ' text-[var(--color-brand-success-text)]' : ' text-[var(--color-brand-danger)]'}>
              {' '}· {verified ? 'checksum utuh' : 'checksum TIDAK COCOK'}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={handleVerify} disabled={busy} title="Verifikasi checksum"><ShieldCheck size={13} /></Button>
        <Button variant="ghost" size="sm" onClick={handleDownload} title="Unduh"><Download size={13} /></Button>
        {canManage && <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy} title="Hapus"><Trash2 size={13} /></Button>}
      </div>
    </div>
  )
}

export default function DocumentDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api(`documents/${id}`))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat dokumen.')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleTransition(toStatus) {
    if (!confirm(`Pindahkan status ke "${toStatus}"?`)) return
    setTransitioning(true)
    try {
      await api(`documents/${id}/transition`, { method: 'POST', body: { to_status: toStatus } })
      await load()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal memindahkan status.')
    } finally {
      setTransitioning(false)
    }
  }

  if (error) return <Layout><div className="mx-auto max-w-3xl text-[13px] text-[var(--color-brand-danger)]">{error}</div></Layout>
  if (!data) return <Layout><div className="mx-auto max-w-3xl text-[13px] text-[var(--color-neutral-medium)]">Memuat…</div></Layout>

  const { document: doc, allowed_next, can } = data

  return (
    <Layout>
    <div className="mx-auto max-w-3xl">
      <Link to="/documents" className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-[var(--color-brand-primary)] hover:underline">
        <ArrowLeft size={13} /> Kembali ke Register
      </Link>

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[12px] font-semibold text-[var(--color-neutral-medium)]">{doc.code}</div>
            <h1 className="text-[19px] font-bold tracking-tight">{doc.title}</h1>
          </div>
          <StatusBadge status={doc.status} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.standards?.map((s) => (
            <span key={s.code} className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-chip-text)]">{s.code}</span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Fungsi</dt><dd>{doc.org_function?.name ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Klasifikasi</dt><dd className="capitalize">{doc.classification}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Versi</dt><dd>{doc.version} (rev. {doc.revision_number})</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Pemilik</dt><dd>{doc.owner?.name ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Berlaku</dt><dd>{doc.effective_date ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Tinjau ulang</dt><dd>{doc.review_date ?? '—'}</dd></div>
        </dl>

        {can.transition && allowed_next.length > 0 && (
          <div className="mt-4 flex gap-2 border-t border-[var(--color-neutral-border)] pt-4">
            {allowed_next.map((s) => (
              <Button key={s} variant="primary" size="sm" disabled={transitioning} onClick={() => handleTransition(s)}>
                Dorong ke: {s}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-[13.5px] font-bold">Berkas Dokumen</h2>
        <div className="flex flex-col gap-2">
          {doc.files?.length ? (
            doc.files.map((f) => <FileRow key={f.id} documentId={doc.id} file={f} canManage={can.upload_file} onChanged={load} />)
          ) : (
            <p className="text-[12.5px] italic text-[var(--color-neutral-soft)]">Belum ada berkas.</p>
          )}
        </div>
        {can.upload_file && (
          <div className="mt-3 border-t border-[var(--color-neutral-border)] pt-3">
            <UploadForm documentId={doc.id} onUploaded={load} />
          </div>
        )}
      </Card>
    </div>
    </Layout>
  )
}
