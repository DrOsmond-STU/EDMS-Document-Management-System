import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, CheckCircle2, FileText, PenLine, Plus, Upload, UserPlus } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Button, Card, Field, inputClass, Modal, StandardChip } from '../components/ui'
import { SignaturePad } from '../components/SignaturePad'
import { CLASSIFICATION_LABEL, StatusBadge, Stepper, dt, errorText, rupiah } from './drafting/shared'

function FileButton({ label, accept, onFile, icon: Icon = Upload, disabled }) {
  const ref = useRef(null)
  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = '' }} />
      <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => ref.current.click()}><Icon size={13} /> {label}</Button>
    </>
  )
}

function MeetingCard({ project, meeting, canWork, onChanged, setError }) {
  const base = `drafting-projects/${project.id}/meetings/${meeting.id}`
  const [minutes, setMinutes] = useState(meeting.minutes ?? '')
  const [budget, setBudget] = useState(meeting.budget ?? '')
  const [attendee, setAttendee] = useState({ name: '', position: '' })
  const [signing, setSigning] = useState(null) // attendee yang sedang TTD
  const [busy, setBusy] = useState(false)

  useEffect(() => { setMinutes(meeting.minutes ?? ''); setBudget(meeting.budget ?? '') }, [meeting])

  async function run(fn, fallback) {
    setBusy(true); setError('')
    try { await fn(); onChanged() } catch (err) { setError(errorText(err, fallback)) } finally { setBusy(false) }
  }

  const upload = (path, file, extra = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v))
    return api(path, { method: 'POST', body: fd, isForm: true })
  }

  const held = Boolean(meeting.held_at)
  const signed = meeting.attendees.filter((a) => a.signed_at).length

  return (
    <Card className="!p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Rapat Pembahasan {meeting.session_no}</div>
          <div className="text-[14px] font-bold text-[var(--color-neutral-dark)]">{meeting.agenda}</div>
          <div className="text-[11.5px] text-[var(--color-neutral-medium)]">{dt(meeting.scheduled_at)}{meeting.location ? ` · ${meeting.location}` : ''}</div>
        </div>
        {held ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#dcefe1] px-2.5 py-1 text-[11px] font-bold text-[#1f6a45]"><CheckCircle2 size={12} /> Dilaksanakan {dt(meeting.held_at)}</span>
        ) : canWork ? (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run(() => api(base, { method: 'PATCH', body: { held: true } }), 'Gagal menandai rapat.')}>Tandai Sudah Dilaksanakan</Button>
        ) : <span className="rounded-full bg-[var(--color-neutral-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-neutral-medium)]">Terjadwal</span>}
      </div>

      {held && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Anggaran Rapat</div>
              {canWork ? (
                <div className="flex gap-1.5">
                  <input type="number" min={0} className={inputClass} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Rp" />
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api(base, { method: 'PATCH', body: { budget: budget === '' ? null : Number(budget) } }), 'Gagal menyimpan anggaran.')}>Simpan</Button>
                </div>
              ) : <div className="text-[13px]">{rupiah(meeting.budget)}</div>}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Notulen</div>
              {canWork ? (
                <>
                  <textarea className={inputClass} rows={4} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Ringkasan pembahasan & keputusan rapat…" />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(() => api(base, { method: 'PATCH', body: { minutes } }), 'Gagal menyimpan notulen.')}>Simpan Notulen</Button>
                    <FileButton label="Unggah Bukti Notulen" accept="application/pdf,image/png,image/jpeg" disabled={busy}
                      onFile={(f) => run(() => upload(`${base}/minutes-file`, f), 'Gagal mengunggah bukti notulen.')} />
                  </div>
                </>
              ) : <p className="whitespace-pre-line text-[12.5px]">{meeting.minutes || '—'}</p>}
              {meeting.has_minutes_file && (
                <a href={`/api/${base}/minutes-file`} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-primary)] hover:underline">
                  <FileText size={13} /> {meeting.minutes_file_name}
                </a>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Foto Dokumentasi ({meeting.photos.length})</span>
                {canWork && <FileButton label="Foto" icon={Camera} accept="image/png,image/jpeg" disabled={busy} onFile={(f) => run(() => upload(`${base}/photos`, f), 'Gagal mengunggah foto.')} />}
              </div>
              {meeting.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {meeting.photos.map((p) => (
                    <a key={p.id} href={`/api/${base}/photos/${p.id}`} target="_blank" rel="noreferrer">
                      <img src={`/api/${base}/photos/${p.id}`} alt={p.caption || p.original_name} className="aspect-video w-full rounded-md border border-[var(--color-neutral-border)] object-cover" />
                    </a>
                  ))}
                </div>
              ) : <p className="text-[12px] text-[var(--color-neutral-medium)]">Belum ada foto.</p>}
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Daftar Hadir ({signed}/{meeting.attendees.length} bertanda tangan)</div>
            <div className="overflow-hidden rounded-md border border-[var(--color-neutral-border)]">
              {meeting.attendees.length === 0 && <p className="px-3 py-4 text-center text-[12px] text-[var(--color-neutral-medium)]">Belum ada peserta.</p>}
              {meeting.attendees.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2 border-b border-[var(--color-neutral-border)] px-3 py-2 last:border-0">
                  <span className="w-5 text-[11px] tabular-nums text-[var(--color-neutral-medium)]">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="text-[12.5px] font-semibold">{a.name}</div>
                    {a.position && <div className="text-[10.5px] text-[var(--color-neutral-medium)]">{a.position}</div>}
                  </div>
                  {a.signed_at ? (
                    <img src={`/api/${base}/attendees/${a.id}/signature`} alt={`TTD ${a.name}`} className="h-9 w-24 rounded border border-[var(--color-neutral-border)] bg-white object-contain" />
                  ) : canWork ? (
                    <Button size="sm" variant="secondary" onClick={() => setSigning(a)}><PenLine size={12} /> TTD</Button>
                  ) : <span className="text-[11px] text-[#b9791c]">belum TTD</span>}
                </div>
              ))}
            </div>
            {canWork && (
              <form className="mt-2 flex gap-1.5" onSubmit={(e) => {
                e.preventDefault()
                run(async () => { await api(`${base}/attendees`, { method: 'POST', body: attendee }); setAttendee({ name: '', position: '' }) }, 'Gagal menambah peserta.')
              }}>
                <input className={inputClass} placeholder="Nama peserta" value={attendee.name} onChange={(e) => setAttendee({ ...attendee, name: e.target.value })} required />
                <input className={inputClass} placeholder="Jabatan/fungsi" value={attendee.position} onChange={(e) => setAttendee({ ...attendee, position: e.target.value })} />
                <Button type="submit" size="sm" variant="secondary" disabled={busy}><UserPlus size={13} /></Button>
              </form>
            )}
          </div>
        </div>
      )}

      {signing && (
        <Modal open onClose={() => setSigning(null)} title={`Tanda Tangan — ${signing.name}`}>
          <p className="mb-2 text-[12px] text-[var(--color-neutral-medium)]">Minta peserta menandatangani di kotak berikut (mouse, stylus, atau jari).</p>
          <SignaturePad saving={busy} onCancel={() => setSigning(null)}
            onSave={(dataUrl) => run(async () => { await api(`${base}/attendees/${signing.id}`, { method: 'PATCH', body: { signature: dataUrl } }); setSigning(null) }, 'Gagal menyimpan tanda tangan.')} />
        </Modal>
      )}
    </Card>
  )
}

export default function DraftingDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ agenda: '', scheduled_at: '', location: '' })
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalContent, setFinalContent] = useState('')
  const [finalFile, setFinalFile] = useState(null)
  const [assignTo, setAssignTo] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api(`drafting-projects/${id}`).then((r) => { setData(r); setFinalContent(r.project.final_content ?? '') }).catch((err) => setError(errorText(err, 'Gagal memuat proyek.')))
  }, [id])
  useEffect(() => { load() }, [load])

  async function act(fn, fallback) {
    setBusy(true); setError('')
    try { await fn(); load() } catch (err) { setError(errorText(err, fallback)) } finally { setBusy(false) }
  }

  if (!data) return <Layout><p className="text-[13px] text-[var(--color-neutral-medium)]">{error || 'Memuat…'}</p></Layout>
  const { project: p, can, gaps, stage_labels: labels, drafters } = data
  const path = `drafting-projects/${p.id}`

  return (
    <Layout>
      <Link to="/drafting" className="mb-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-primary)] hover:underline"><ArrowLeft size={13} /> Semua proyek penyusunan</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[12px] text-[var(--color-neutral-medium)]">{p.code}</div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">{p.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-neutral-medium)]">
            <StatusBadge status={p.status} />
            <span>{p.doc_type} · {p.org_function?.name} · {CLASSIFICATION_LABEL[p.classification] ?? p.classification}</span>
            {p.standards?.map((s) => <StandardChip key={s.code} code={s.code} />)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.status === 'requested' && can.take && <Button variant="primary" disabled={busy} onClick={() => act(() => api(`${path}/assign`, { method: 'POST', body: {} }), 'Gagal mengambil permintaan.')}>Ambil & Mulai Susun</Button>}
          {can.work && <Button variant="primary" disabled={busy} onClick={() => setFinalizeOpen(true)}>Finalisasi Dokumen</Button>}
          {p.status === 'finalized' && can.ratify && (
            <>
              <Button variant="primary" disabled={busy} onClick={() => { if (window.confirm('Sahkan dokumen ini? Dokumen akan langsung terbit (Released) di register utama.')) act(() => api(`${path}/ratify`, { method: 'POST' }), 'Gagal mengesahkan.') }}>Sahkan Dokumen</Button>
              <Button variant="secondary" disabled={busy} onClick={() => { const note = window.prompt('Catatan untuk penyusun (apa yang harus diperbaiki):'); if (note) act(() => api(`${path}/return`, { method: 'POST', body: { note } }), 'Gagal mengembalikan.') }}>Kembalikan</Button>
            </>
          )}
          {['requested', 'in_progress'].includes(p.status) && can.control && (
            <Button variant="ghost" disabled={busy} onClick={() => { const reason = window.prompt('Alasan menolak permintaan ini:'); if (reason) act(() => api(`${path}/reject`, { method: 'POST', body: { reason } }), 'Gagal menolak.') }}>Tolak</Button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {p.return_note && p.status === 'in_progress' && <div className="mb-4 rounded-md border border-[#f6d9a6] bg-[#fdf1dc] px-3 py-2 text-[12.5px] text-[#7a4f0e]"><b>Dikembalikan pengesah:</b> {p.return_note}</div>}
      {p.status === 'rejected' && <div className="mb-4 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg)] px-3 py-2 text-[12.5px]"><b>Ditolak:</b> {p.rejection_reason}</div>}
      {p.document && (
        <div className="mb-4 rounded-md border border-[#bfe0cc] bg-[#e3f1ea] px-3 py-2 text-[12.5px] text-[#1d6e48]">
          Disahkan {dt(p.ratified_at)} oleh {p.ratifier?.name} → terbit sebagai <Link to={`/documents/${p.document.id}`} className="font-bold underline">{p.document.code}</Link> (Released, Rev 0).
        </div>
      )}

      <Card className="mb-4"><Stepper labels={labels} stages={p.stages} /></Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Alasan Kebutuhan</div>
          <p className="whitespace-pre-line text-[13px] leading-relaxed">{p.reason}</p>
          {p.has_final_file && (
            <div className="mt-3 border-t border-[var(--color-neutral-border)] pt-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Berkas Final</div>
              <a href={`/api/${path}/final-file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--color-brand-primary)] hover:underline"><FileText size={13} /> {p.final_file_name}</a>
            </div>
          )}
        </Card>
        <Card>
          <dl className="space-y-2 text-[12.5px]">
            <div><dt className="text-[11px] text-[var(--color-neutral-medium)]">Pemohon</dt><dd className="font-semibold">{p.requester?.name}</dd></div>
            <div>
              <dt className="text-[11px] text-[var(--color-neutral-medium)]">Penyusun</dt>
              <dd className="font-semibold">{p.drafter?.name ?? '—'}</dd>
              {can.control && ['requested', 'in_progress'].includes(p.status) && drafters.length > 0 && (
                <div className="mt-1 flex gap-1.5">
                  <select className={`${inputClass} !py-1 text-[12px]`} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                    <option value="">Tugaskan ke…</option>
                    {drafters.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <Button size="sm" variant="secondary" disabled={!assignTo || busy} onClick={() => act(() => api(`${path}/assign`, { method: 'POST', body: { drafter_id: Number(assignTo) } }), 'Gagal menugaskan.')}>OK</Button>
                </div>
              )}
            </div>
            <div><dt className="text-[11px] text-[var(--color-neutral-medium)]">Diajukan</dt><dd>{dt(p.created_at)}</dd></div>
            <div><dt className="text-[11px] text-[var(--color-neutral-medium)]">Total Anggaran Rapat</dt><dd className="font-semibold">{rupiah(p.meetings.reduce((n, m) => n + Number(m.budget ?? 0), 0))}</dd></div>
          </dl>
        </Card>
      </div>

      {gaps.length > 0 && p.status === 'in_progress' && (
        <div className="mb-4 rounded-md border border-[#f6d9a6] bg-[#fdf1dc] px-3 py-2 text-[12px] text-[#7a4f0e]">
          <b>Belum bisa difinalisasi:</b>
          <ul className="ml-4 list-disc">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--color-neutral-dark)]">Rapat Pembahasan</h2>
        {can.work && <Button size="sm" variant="primary" onClick={() => setMeetingOpen(true)}><Plus size={13} /> Undangan Rapat</Button>}
      </div>
      {p.meetings.length === 0 ? (
        <Card><p className="py-6 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Belum ada rapat. {can.work ? 'Jadwalkan undangan rapat pembahasan pertama.' : ''}</p></Card>
      ) : (
        <div className="space-y-3">
          {p.meetings.map((m) => <MeetingCard key={m.id} project={p} meeting={m} canWork={can.work} onChanged={load} setError={setError} />)}
        </div>
      )}

      {meetingOpen && (
        <Modal open onClose={() => setMeetingOpen(false)} title={`Undangan Rapat Pembahasan ${p.meetings.length + 1}`}>
          <form className="flex flex-col gap-3" onSubmit={(e) => {
            e.preventDefault()
            act(async () => { await api(`${path}/meetings`, { method: 'POST', body: meetingForm }); setMeetingOpen(false); setMeetingForm({ agenda: '', scheduled_at: '', location: '' }) }, 'Gagal menjadwalkan rapat.')
          }}>
            <Field label="Agenda"><input className={inputClass} value={meetingForm.agenda} onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })} required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Waktu"><input type="datetime-local" className={inputClass} value={meetingForm.scheduled_at} onChange={(e) => setMeetingForm({ ...meetingForm, scheduled_at: e.target.value })} required /></Field>
              <Field label="Tempat" hint="Opsional"><input className={inputClass} value={meetingForm.location} onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMeetingOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={busy}>Jadwalkan</Button>
            </div>
          </form>
        </Modal>
      )}

      {finalizeOpen && (
        <Modal open onClose={() => setFinalizeOpen(false)} title="Finalisasi Dokumen">
          <form className="flex flex-col gap-3" onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData()
            fd.append('final_content', finalContent)
            if (finalFile) fd.append('file', finalFile)
            act(async () => { await api(`${path}/finalize`, { method: 'POST', body: fd, isForm: true }); setFinalizeOpen(false); setFinalFile(null) }, 'Gagal finalisasi.')
          }}>
            {gaps.length > 0 && <div className="rounded-md border border-[#f6d9a6] bg-[#fdf1dc] px-3 py-2 text-[12px] text-[#7a4f0e]">{gaps.join(' ')}</div>}
            <Field label="Ringkasan/Isi Final" hint="Opsional — ringkasan isi dokumen untuk register"><textarea className={inputClass} rows={4} value={finalContent} onChange={(e) => setFinalContent(e.target.value)} /></Field>
            <Field label="Berkas Final (PDF)" hint={p.has_final_file ? `Sudah ada: ${p.final_file_name} — unggah lagi hanya jika ingin mengganti` : 'Wajib PDF — dokumen terkontrol harus PDF agar bisa diberi watermark'}>
              <input type="file" accept="application/pdf" className="text-[12.5px]" onChange={(e) => setFinalFile(e.target.files[0] ?? null)} required={!p.has_final_file} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setFinalizeOpen(false)}>Batal</Button>
              <Button type="submit" variant="primary" disabled={busy || gaps.length > 0}>{busy ? 'Memproses…' : 'Finalisasi'}</Button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  )
}
