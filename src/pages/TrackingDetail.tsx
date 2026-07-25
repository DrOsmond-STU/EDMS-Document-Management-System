import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Check, FileCheck, Users2 } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, Field, inputClass, EmptyState } from '../components/ui'
import { StandardChip, ClassificationBadge } from '../components/Badges'
import { DRAFTING_STAGE_LABEL } from '../constants'
import { DRAFTING_STAGE_ORDER } from '../types'

export function TrackingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state, addMeeting, advanceStage, setFinalizedContent } = useApp()
  const [content, setContent] = useState('')
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [budget, setBudget] = useState('0')
  const [attendees, setAttendees] = useState('')
  const [hasPhoto, setHasPhoto] = useState(false)
  const [hasMinutes, setHasMinutes] = useState(false)
  const [signed, setSigned] = useState(false)

  const project = state.draftingProjects.find((p) => p.id === id)

  if (!project) {
    return (
      <div>
        <Link to="/tracking" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-brand-primary)] hover:underline">
          <ArrowLeft size={14} /> Kembali
        </Link>
        <EmptyState title="Proyek penyusunan tidak ditemukan" />
      </div>
    )
  }

  const func = state.functions.find((f) => f.id === project.functionId)
  const stageIdx = DRAFTING_STAGE_ORDER.indexOf(project.currentStage)
  const done = project.currentStage === 'register_utama'

  function handleAddMeeting(e: React.FormEvent) {
    e.preventDefault()
    addMeeting(project!.id, {
      sessionNumber: project!.meetings.length + 1,
      date: new Date().toISOString().slice(0, 10),
      budget: Number(budget) || 0,
      hasPhotoEvidence: hasPhoto,
      hasMinutesEvidence: hasMinutes,
      attendees: attendees.split(',').map((a) => a.trim()).filter(Boolean),
      signaturesCollected: signed,
    })
    setShowMeetingForm(false)
    setBudget('0')
    setAttendees('')
    setHasPhoto(false)
    setHasMinutes(false)
    setSigned(false)
  }

  function handleFinalize() {
    setFinalizedContent(project!.id, content || project!.finalizedContent || 'Draf final disetujui tim penyusun.')
    advanceStage(project!.id)
  }

  function handleAdvance() {
    advanceStage(project!.id)
    if (project!.currentStage === 'pengesahan') {
      // will become register_utama; jump to the newly released document afterwards
      setTimeout(() => navigate('/documents'), 50)
    }
  }

  const hasAnyMeeting = project.meetings.length > 0
  const hasMinutesEvidence = project.meetings.some((m) => m.hasMinutesEvidence)
  const hasSignatures = project.meetings.some((m) => m.signaturesCollected)

  return (
    <div>
      <Link to="/tracking" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-brand-primary)] hover:underline">
        <ArrowLeft size={14} /> Kembali ke Tracking
      </Link>

      <PageHeader
        title={project.documentTitle}
        subtitle={`${project.requestNumber} · ${func?.name ?? project.functionId} · Diajukan oleh ${project.requester}`}
      />

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center gap-4 overflow-x-auto pb-1">
          {DRAFTING_STAGE_ORDER.map((stage, i) => {
            const isComplete = i < stageIdx || done
            const isCurrent = i === stageIdx && !done
            return (
              <div key={stage} className="flex shrink-0 items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                      isComplete
                        ? 'bg-[var(--color-brand-success-text)] text-white'
                        : isCurrent
                          ? 'bg-[var(--color-brand-primary)] text-white'
                          : 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-medium)]'
                    }`}
                  >
                    {isComplete ? <Check size={13} /> : i + 1}
                  </div>
                  <span className={`max-w-[80px] text-center text-[10px] leading-tight ${isCurrent ? 'font-bold' : 'text-[var(--color-neutral-medium)]'}`}>
                    {DRAFTING_STAGE_LABEL[stage]}
                  </span>
                </div>
                {i < DRAFTING_STAGE_ORDER.length - 1 && <div className="h-px w-6 bg-[var(--color-neutral-border)]" />}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-[var(--color-neutral-border)] pt-3">
          {project.standards.map((s) => (
            <StandardChip key={s} code={s} />
          ))}
          <ClassificationBadge level={project.initialClassification} />
        </div>
      </Card>

      {done ? (
        <Card>
          <h2 className="mb-1.5 text-sm font-bold text-[var(--color-brand-success-text)]">Selesai — Dokumen di Register Utama</h2>
          <p className="mb-3 text-xs text-[var(--color-neutral-medium)]">
            Dokumen telah disahkan dan diterbitkan sebagai dokumen resmi berstatus Released.
          </p>
          {project.ratifiedDocumentId && (
            <Link to={`/documents/${project.ratifiedDocumentId}`}>
              <Button variant="primary">Lihat Dokumen</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {project.currentStage === 'permintaan' && (
              <Card>
                <h2 className="mb-2 text-sm font-bold">Alasan Kebutuhan</h2>
                <p className="mb-4 text-sm text-[var(--color-neutral-dark)]">{project.reason}</p>
                <Button variant="primary" onClick={handleAdvance}>Kirim Undangan Rapat</Button>
              </Card>
            )}

            {project.currentStage === 'undangan_rapat' && (
              <Card>
                <h2 className="mb-2 text-sm font-bold">Undangan Rapat Pembahasan</h2>
                <p className="mb-4 text-xs text-[var(--color-neutral-medium)]">
                  Jadwalkan rapat pembahasan pertama bersama fungsi terkait dan reviewer.
                </p>
                <Button variant="primary" onClick={handleAdvance}>Mulai Sesi Rapat</Button>
              </Card>
            )}

            {(project.currentStage === 'rapat' || project.currentStage === 'bukti_notulen' || project.currentStage === 'daftar_hadir') && (
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold">Rapat Pembahasan ({project.meetings.length} sesi)</h2>
                  <Button variant="secondary" onClick={() => setShowMeetingForm((s) => !s)}>
                    {showMeetingForm ? 'Batal' : '+ Sesi Rapat'}
                  </Button>
                </div>

                {showMeetingForm && (
                  <form onSubmit={handleAddMeeting} className="mb-4 flex flex-col gap-3 rounded-md border border-[var(--color-neutral-border)] p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Anggaran (Rp)">
                        <input className={inputClass} type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} />
                      </Field>
                      <Field label="Peserta" hint="Pisahkan dengan koma">
                        <input className={inputClass} value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Nama peserta…" />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={hasPhoto} onChange={(e) => setHasPhoto(e.target.checked)} /> Foto dokumentasi
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={hasMinutes} onChange={(e) => setHasMinutes(e.target.checked)} /> Bukti notulen
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} /> Tanda tangan kehadiran lengkap
                      </label>
                    </div>
                    <Button type="submit" variant="primary" className="self-end">Simpan Sesi Rapat</Button>
                  </form>
                )}

                <div className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
                  {project.meetings.map((m) => (
                    <div key={m.id} className="py-2.5 text-xs first:pt-0">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold">Rapat {m.sessionNumber} — {m.date}</span>
                        <span className="text-[var(--color-neutral-medium)]">Rp {m.budget.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-neutral-medium)]">
                        <span className="flex items-center gap-1"><Users2 size={11} /> {m.attendees.join(', ') || '—'}</span>
                        <span className="flex items-center gap-1"><Camera size={11} /> {m.hasPhotoEvidence ? 'Ada foto' : 'Belum ada foto'}</span>
                        <span className="flex items-center gap-1"><FileCheck size={11} /> {m.hasMinutesEvidence ? 'Notulen lengkap' : 'Notulen belum'}</span>
                        <span>{m.signaturesCollected ? '✅ TTD lengkap' : '⏳ TTD belum lengkap'}</span>
                      </div>
                    </div>
                  ))}
                  {!hasAnyMeeting && <p className="py-3 text-xs text-[var(--color-neutral-medium)]">Belum ada sesi rapat tercatat.</p>}
                </div>

                <div className="mt-4 flex justify-end">
                  {project.currentStage === 'rapat' && (
                    <Button variant="primary" disabled={!hasAnyMeeting} onClick={handleAdvance}>Lanjut ke Bukti Notulen</Button>
                  )}
                  {project.currentStage === 'bukti_notulen' && (
                    <Button variant="primary" disabled={!hasMinutesEvidence} onClick={handleAdvance}>Lanjut ke Daftar Hadir & TTD</Button>
                  )}
                  {project.currentStage === 'daftar_hadir' && (
                    <Button variant="primary" disabled={!hasSignatures} onClick={handleAdvance}>Lanjut ke Finalisasi</Button>
                  )}
                </div>
              </Card>
            )}

            {project.currentStage === 'finalisasi' && (
              <Card>
                <h2 className="mb-2 text-sm font-bold">Finalisasi Dokumen</h2>
                <Field label="Konten Final">
                  <textarea
                    className={inputClass}
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tuliskan konten final dokumen hasil rapat pembahasan…"
                  />
                </Field>
                <div className="mt-3 flex justify-end">
                  <Button variant="primary" onClick={handleFinalize}>Finalisasi & Kirim untuk Pengesahan</Button>
                </div>
              </Card>
            )}

            {project.currentStage === 'pengesahan' && (
              <Card>
                <h2 className="mb-2 text-sm font-bold">Menunggu Pengesahan</h2>
                <p className="mb-3 whitespace-pre-wrap text-sm text-[var(--color-neutral-dark)]">{project.finalizedContent}</p>
                <p className="mb-4 text-xs text-[var(--color-neutral-medium)]">
                  Peran Ratifier memverifikasi kelengkapan rapat (notulen, daftar hadir, TTD) sebelum mengesahkan dokumen ke Register Utama.
                </p>
                <Button variant="primary" onClick={handleAdvance}>Pengesahan Dokumen</Button>
              </Card>
            )}
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-bold">Ringkasan</h2>
            <dl className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Nomor</dt><dd className="font-medium">{project.requestNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Jenis</dt><dd className="font-medium">{project.documentType}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Pemohon</dt><dd className="font-medium">{project.requester}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Diajukan</dt><dd className="font-medium">{project.createdAt}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Diperbarui</dt><dd className="font-medium">{project.updatedAt}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--color-neutral-medium)]">Sesi Rapat</dt><dd className="font-medium">{project.meetings.length}</dd></div>
            </dl>
          </Card>
        </div>
      )}
    </div>
  )
}
