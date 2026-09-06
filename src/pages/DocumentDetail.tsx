import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, History } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, EmptyState } from '../components/ui'
import { ClassificationBadge, StandardChip, StatusBadge, ValidityBadge } from '../components/Badges'
import { DOCUMENT_STATUS_ORDER, STATUS_LABEL } from '../constants'
import { canTransition } from '../state/permissions'
import type { DocumentStatus } from '../types'

export function DocumentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, currentUser, transitionDocument } = useApp()
  const [confirming, setConfirming] = useState<DocumentStatus | null>(null)

  const doc = state.documents.find((d) => d.id === id)
  const revisions = state.revisions
    .filter((r) => r.documentId === id)
    .sort((a, b) => (a.revisionNumber < b.revisionNumber ? 1 : -1))
  const func = state.functions.find((f) => f.id === doc?.functionId)

  if (!doc) {
    return (
      <div>
        <Link to="/documents" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-brand-primary)] hover:underline">
          <ArrowLeft size={14} /> Kembali ke Register
        </Link>
        <EmptyState title="Dokumen tidak ditemukan" description={`Tidak ada dokumen dengan id "${id}".`} />
      </div>
    )
  }

  const currentIdx = DOCUMENT_STATUS_ORDER.indexOf(doc.status)
  const nextStatus = DOCUMENT_STATUS_ORDER[currentIdx + 1]
  const canAdvance = doc.status !== 'obsolete' && canTransition(currentUser.roles, doc.status)

  function confirmTransition() {
    if (!confirming) return
    transitionDocument(doc!.id, confirming)
    setConfirming(null)
  }

  return (
    <div>
      <Link to="/documents" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-brand-primary)] hover:underline">
        <ArrowLeft size={14} /> Kembali ke Register
      </Link>

      <PageHeader
        title={doc.title}
        subtitle={`${doc.code} · ${func?.name ?? doc.functionId} · v${doc.version} · Revisi ${doc.revisionNumber}`}
        actions={
          nextStatus && (
            <Button variant={nextStatus === 'obsolete' ? 'danger' : 'primary'} disabled={!canAdvance} onClick={() => setConfirming(nextStatus)}>
              {nextStatus === 'obsolete' ? 'Nyatakan Obsolete' : `Majukan ke ${STATUS_LABEL[nextStatus]}`}
            </Button>
          )
        }
      />

      {!canAdvance && nextStatus && (
        <p className="mb-4 rounded-md bg-[var(--color-brand-warning)]/10 px-3 py-2 text-xs text-[#8a5a10]">
          Peran aktif Anda tidak berwenang memindahkan dokumen dari status {STATUS_LABEL[doc.status]}. Ganti peran melalui menu pengguna di kanan atas.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={doc.status} />
              <ValidityBadge validity={doc.validity} />
              <ClassificationBadge level={doc.classification} />
              {doc.standards.map((s) => (
                <StandardChip key={s} code={s} />
              ))}
            </div>
            <h2 className="mb-1.5 text-sm font-bold">Konten</h2>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-neutral-dark)]">{doc.content || 'Belum ada konten.'}</p>
            {doc.keywords.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {doc.keywords.map((k) => (
                  <span key={k} className="rounded bg-[var(--color-neutral-bg)] px-2 py-0.5 text-[11px] text-[var(--color-neutral-medium)]">
                    #{k}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
              <History size={15} /> Riwayat Revisi
            </h2>
            <div className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
              {revisions.map((r) => (
                <div key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Revisi {r.revisionNumber} · v{r.version}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--color-neutral-medium)]">{r.notes}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-neutral-medium)]">{r.editor} · {r.date}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-3 text-sm font-bold">Metadata</h2>
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Pemilik</dt><dd className="font-medium">{doc.owner}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Jenis</dt><dd className="font-medium">{doc.type}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Tanggal Efektif</dt><dd className="font-medium">{doc.effectiveDate ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Tanggal Review</dt><dd className="font-medium">{doc.reviewDate ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Kedaluwarsa</dt><dd className="font-medium">{doc.expiryDate ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Dibuat</dt><dd className="font-medium">{doc.createdAt}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Diperbarui</dt><dd className="font-medium">{doc.updatedAt}</dd></div>
            </dl>
          </Card>

          {doc.draftingProjectId && (
            <Card>
              <h2 className="mb-2 text-sm font-bold">Asal Penyusunan</h2>
              <p className="mb-2 text-xs text-[var(--color-neutral-medium)]">Dokumen ini diterbitkan melalui proses Tracking Penyusunan Dokumen.</p>
              <Button variant="secondary" onClick={() => navigate(`/tracking/${doc.draftingProjectId}`)} className="w-full justify-center">
                Lihat Proyek Penyusunan
              </Button>
            </Card>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <Card className="w-full max-w-sm">
            <h3 className="mb-1.5 text-sm font-bold">Konfirmasi Perubahan Status</h3>
            <p className="mb-4 text-xs text-[var(--color-neutral-medium)]">
              Pindahkan "{doc.title}" dari <strong>{STATUS_LABEL[doc.status]}</strong> ke{' '}
              <strong>{STATUS_LABEL[confirming]}</strong>? Tindakan ini akan tercatat di Audit Trail dan membuat revisi baru.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)}>Batal</Button>
              <Button variant={confirming === 'obsolete' ? 'danger' : 'primary'} onClick={confirmTransition}>Konfirmasi</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
