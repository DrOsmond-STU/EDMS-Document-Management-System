import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, Field, inputClass } from '../components/ui'
import { DOCUMENT_TYPES } from '../constants'
import type { ClassificationLevel, DocumentType } from '../types'

const CLASSIFICATIONS: ClassificationLevel[] = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret']

export function NewDraftingRequest() {
  const navigate = useNavigate()
  const { state, createDraftingRequest, currentUser } = useApp()

  const [documentTitle, setDocumentTitle] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('SOP')
  const [functionId, setFunctionId] = useState(state.functions[0]?.id ?? '')
  const [selectedStandards, setSelectedStandards] = useState<string[]>([])
  const [initialClassification, setInitialClassification] = useState<ClassificationLevel>('internal')
  const [reason, setReason] = useState('')

  function toggleStandard(code: string) {
    setSelectedStandards((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!documentTitle.trim() || !functionId || !reason.trim()) return
    createDraftingRequest({
      documentTitle: documentTitle.trim(),
      documentType,
      functionId,
      standards: selectedStandards,
      initialClassification,
      reason: reason.trim(),
      requester: currentUser.name,
    })
    navigate('/tracking')
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Permintaan Baru" subtitle="Mengajukan permintaan pembuatan dokumen — Tahap 1 dari 8" />

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Judul Dokumen">
            <input className={inputClass} value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} required placeholder="mis. SOP Evaluasi Kepuasan Pelanggan" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Jenis Dokumen">
              <select className={inputClass} value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Fungsi/Departemen Pengaju">
              <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
                {state.functions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Standar Terkait" hint="Boleh lebih dari satu">
            <div className="flex flex-wrap gap-1.5">
              {state.standards.map((s) => (
                <button
                  type="button"
                  key={s.code}
                  onClick={() => toggleStandard(s.code)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    selectedStandards.includes(s.code)
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]'
                      : 'border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)]'
                  }`}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Level Klasifikasi Awal">
            <select className={inputClass} value={initialClassification} onChange={(e) => setInitialClassification(e.target.value as ClassificationLevel)}>
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          <Field label="Alasan Kebutuhan">
            <textarea
              className={inputClass}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Jelaskan mengapa dokumen ini dibutuhkan…"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/tracking')}>Batal</Button>
            <Button type="submit" variant="primary">Ajukan Permintaan</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
