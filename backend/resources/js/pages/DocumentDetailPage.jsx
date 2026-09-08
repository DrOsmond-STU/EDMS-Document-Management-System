import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowLeftRight, Ban, Download, Eye, ShieldCheck, Snowflake, Sun,
  Trash2, Upload, XCircle,
} from 'lucide-react'
import { api, ApiError } from '../api'
import { Layout } from '../components/Layout'
import { Button, Card, ClassificationBadge, Field, inputClass, Modal, StatusBadge, ValidityBadge } from '../components/ui'

// Status yang pernah resmi dirilis — cermin dari Document::CONTROLLED_STATUSES
// di backend. Berkas dokumen berstatus ini hanya bisa dilihat berwatermark
// "uncontrolled copy"; unduhan berkas asli dibatasi untuk Document Controller
// (lihat can.download_master, ditegakkan ulang di server lewat
// DocumentFileController::download()/view()).
const CONTROLLED_STATUSES = ['released', 'frozen', 'revoked', 'obsolete']

const ACTION_META = {
  freeze: { label: 'Bekukan', icon: Snowflake, variant: 'secondary' },
  unfreeze: { label: 'Cairkan', icon: Sun, variant: 'secondary' },
  revoke: { label: 'Cabut', icon: Ban, variant: 'danger' },
  cancel: { label: 'Batalkan', icon: XCircle, variant: 'danger' },
  supersede: { label: 'Tandai Digantikan', icon: ArrowLeftRight, variant: 'secondary' },
}

const RELATION_LABEL = { superseded_by: 'Digantikan oleh', supersedes: 'Menggantikan' }

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

function FileRow({ documentId, file, canManage, canRawDownload, isControlled, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(null)

  function handleView() {
    // Dibuka di tab baru: browser menampilkan lewat penampil bawaannya
    // (PDF/gambar), dan cetak/print-to-PDF dari sana otomatis ikut membawa
    // watermark "UNCONTROLLED COPY" karena sudah ditempel sungguhan ke
    // berkasnya di server (lihat WatermarkService) — bukan lapisan CSS.
    window.open(`/api/documents/${documentId}/files/${file.id}/view`, '_blank', 'noopener')
  }

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
        <Button variant="ghost" size="sm" onClick={handleView} title={isControlled ? 'Lihat dengan watermark uncontrolled copy' : 'Lihat dokumen'}>
          <Eye size={13} />
        </Button>
        {(!isControlled || canRawDownload) && (
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Unduh berkas asli"><Download size={13} /></Button>
        )}
        {canManage && <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy} title="Hapus"><Trash2 size={13} /></Button>}
      </div>
    </div>
  )
}

/** Modal alasan wajib untuk aksi siklus hidup pengecualian (bekukan/
 *  cairkan/cabut/batalkan/tandai-digantikan) — semua tercatat permanen ke
 *  Audit Trail (lihat DocumentLifecycle::performAction). */
function LifecycleActionModal({ action, onClose, onSubmitted }) {
  const [reason, setReason] = useState('')
  const [replacementCode, setReplacementCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!action) return null
  const meta = ACTION_META[action]

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSubmitted(action, reason, action === 'supersede' ? replacementCode : undefined)
      setReason('')
      setReplacementCode('')
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors?.reason?.[0] || err.body?.errors?.replacement_code?.[0] || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={Boolean(action)} onClose={onClose} title={`${meta.label} Dokumen`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-[12px] text-[var(--color-neutral-medium)]">
          Tindakan ini di luar alur persetujuan normal dan wajib disertai alasan tertulis — akan
          tercatat permanen di Audit Trail dan tidak bisa diubah/dihapus kemudian.
        </p>
        {action === 'supersede' && (
          <Field label="Kode Dokumen Pengganti" hint="Kode dokumen yang menggantikan ini, mis. SOP-QA-002">
            <input
              className={`${inputClass} font-mono`}
              value={replacementCode}
              onChange={(e) => setReplacementCode(e.target.value.toUpperCase())}
              required
            />
          </Field>
        )}
        <Field label="Alasan" hint="Minimal 10 karakter">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={10}
            required
          />
        </Field>
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant={meta.variant} disabled={submitting || reason.trim().length < 10}>
            {submitting ? 'Menyimpan…' : `Konfirmasi ${meta.label}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function DocumentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [lifecycleModalAction, setLifecycleModalAction] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  async function handleLifecycleAction(action, reason, replacementCode) {
    await api(`documents/${id}/lifecycle-action`, {
      method: 'POST',
      body: { action, reason, replacement_code: replacementCode || undefined },
    })
    setLifecycleModalAction(null)
    await load()
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await api(`documents/${id}`, { method: 'DELETE' })
      navigate('/documents')
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Gagal menghapus dokumen.')
      setDeleting(false)
    }
  }

  if (error) return <Layout><div className="mx-auto max-w-3xl text-[13px] text-[var(--color-brand-danger)]">{error}</div></Layout>
  if (!data) return <Layout><div className="mx-auto max-w-3xl text-[13px] text-[var(--color-neutral-medium)]">Memuat…</div></Layout>

  const { document: doc, allowed_next, available_lifecycle_actions, can } = data
  const isControlled = CONTROLLED_STATUSES.includes(doc.status)
  const canDelete = can.delete && doc.status === 'draft'

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
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <StatusBadge status={doc.status} />
            <ValidityBadge validity={doc.display_validity ?? doc.validity} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {doc.standards?.map((s) => (
            <span key={s.code} className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-chip-text)]">{s.code}</span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Fungsi</dt><dd>{doc.org_function?.name ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Klasifikasi</dt><dd><ClassificationBadge level={doc.classification} /></dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Versi</dt><dd>{doc.version} (rev. {doc.revision_number})</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Pemilik</dt><dd>{doc.owner?.name ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Berlaku</dt><dd>{doc.effective_date?.slice(0, 10) ?? '—'}</dd></div>
          <div><dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Tinjau ulang</dt><dd>{doc.review_date?.slice(0, 10) ?? '—'}</dd></div>
        </dl>

        {doc.document_relations?.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-[var(--color-neutral-border)] pt-4">
            {doc.document_relations.map((rel) => (
              <div key={rel.id} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-[var(--color-neutral-medium)]">{RELATION_LABEL[rel.type] || rel.type}:</span>
                <Link to={`/documents/${rel.target.id}`} className="font-mono font-semibold text-[var(--color-brand-primary)] hover:underline">
                  {rel.target.code}
                </Link>
                <span className="truncate text-[var(--color-neutral-medium)]">{rel.target.title}</span>
                <StatusBadge status={rel.target.status} />
              </div>
            ))}
          </div>
        )}

        {can.transition && allowed_next.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-neutral-border)] pt-4">
            {allowed_next.map((s) => (
              <Button key={s} variant="primary" size="sm" disabled={transitioning} onClick={() => handleTransition(s)}>
                Dorong ke: {s}
              </Button>
            ))}
          </div>
        )}

        {can.lifecycle_action && available_lifecycle_actions?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-neutral-border)] pt-4">
            {available_lifecycle_actions.map((action) => {
              const meta = ACTION_META[action]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <Button key={action} variant={meta.variant} size="sm" onClick={() => setLifecycleModalAction(action)}>
                  <Icon size={12} /> {meta.label}
                </Button>
              )
            })}
          </div>
        )}

        {canDelete && (
          <div className="mt-4 flex justify-end border-t border-[var(--color-neutral-border)] pt-4">
            <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)}>
              <Trash2 size={12} /> Hapus Dokumen
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-[13.5px] font-bold">Berkas Dokumen</h2>
        {isControlled && (
          <p className="mb-3 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[11.5px] text-[var(--color-neutral-medium)]">
            Dokumen ini terkontrol. "Lihat" menampilkan salinan berwatermark <em>UNCONTROLLED COPY</em>
            {' '}(termasuk saat dicetak/print-to-PDF); unduhan berkas asli hanya untuk Document Controller.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {doc.files?.length ? (
            doc.files.map((f) => (
              <FileRow
                key={f.id}
                documentId={doc.id}
                file={f}
                canManage={can.upload_file}
                canRawDownload={can.download_master}
                isControlled={isControlled}
                onChanged={load}
              />
            ))
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

    <LifecycleActionModal
      action={lifecycleModalAction}
      onClose={() => setLifecycleModalAction(null)}
      onSubmitted={handleLifecycleAction}
    />

    <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Hapus Dokumen">
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[var(--color-neutral-medium)]">
          Hapus dokumen draft <span className="font-mono font-semibold text-[var(--color-neutral-dark)]">{doc.code}</span> — "{doc.title}"?
          Gunakan ini hanya untuk membereskan salah input; dokumen yang sudah berjalan lewat
          Review/Approval tidak bisa dihapus dan harus memakai Batalkan/Cabut.
        </p>
        {deleteError && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{deleteError}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Batal</Button>
          <Button variant="danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Menghapus…' : 'Ya, Hapus'}
          </Button>
        </div>
      </div>
    </Modal>
    </Layout>
  )
}
