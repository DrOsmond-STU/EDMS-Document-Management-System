import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Circle, ClipboardEdit, ShieldCheck, XCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card, Field, inputClass, Modal } from '../components/ui'

// Matriks Klausul × Dokumen sungguhan — gaya & struktur mengikuti purwarupa
// lama (bundel JS dibaca langsung dari server, lihat riwayat commit), tapi
// klausul di sini adalah master data nyata (StandardClause, ditanam via
// StandardClauseSeeder dari taksonomi 7 standar ISO/SMK3 yang terverifikasi)
// dan tiap sel dinilai manual oleh Compliance Admin — bukan dihitung
// otomatis dari status dokumen seperti versi ringkasan sebelumnya.
const STATUS_META = {
  compliant: { label: 'Compliant', bg: '#e3f1ea', text: '#1d6e48', icon: CheckCircle2 },
  partial: { label: 'Partial', bg: '#fdf1dc', text: '#b9791c', icon: AlertTriangle },
  gap: { label: 'Gap', bg: '#fbe7e6', text: '#b23b3a', icon: XCircle },
  unassessed: { label: 'Belum Dinilai', bg: 'var(--color-neutral-bg)', text: 'var(--color-neutral-soft)', icon: Circle },
}

function StatCard({ status, value }) {
  const m = STATUS_META[status]
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: m.bg, color: m.text }}>
          <m.icon size={17} />
        </div>
        <div>
          <div className="text-[22px] font-bold leading-none tabular-nums text-[var(--color-neutral-dark)]">{value}</div>
          <div className="mt-1 text-[11.5px] font-medium text-[var(--color-neutral-medium)]">{m.label}</div>
        </div>
      </div>
    </Card>
  )
}

function CellButton({ status, onClick, disabled }) {
  const m = STATUS_META[status ?? 'unassessed']
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className="mx-auto flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
      style={{ backgroundColor: status ? m.bg : 'transparent' }}
      title={m.label}
    >
      <m.icon size={status ? 14 : 16} style={{ color: m.text }} strokeWidth={status ? 2.5 : 1.75} />
    </button>
  )
}

function AssessCellModal({ open, onClose, cell, onSaved }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setNote(cell?.note ?? ''); setError('') }
  }, [open, cell])

  if (!cell) return null

  async function save(status) {
    setSubmitting(true)
    setError('')
    try {
      const result = await api('compliance-matrix/assessments', {
        method: 'PATCH',
        body: { clause_id: cell.clause.id, document_id: cell.document.id, status, note: status ? note : null },
      })
      onSaved(result, status)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nilai Klausul">
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2 text-[12.5px]">
          <div className="flex items-baseline gap-1.5">
            <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{cell.clause.standard_code}</span>
            <span className="font-mono text-[11px] font-bold">{cell.clause.code}</span>
            <span className="font-semibold">{cell.clause.title}</span>
          </div>
          <div className="mt-1 text-[11.5px] text-[var(--color-neutral-medium)]">
            <span className="font-mono">{cell.document.code}</span> — {cell.document.title}
          </div>
        </div>

        <Field label="Catatan" hint="Opsional — dipakai juga sebagai catatan tindak lanjut">
          <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

        <div className="grid grid-cols-2 gap-1.5">
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => save('compliant')} className="!border-[#c4dfcf] !bg-[#e3f1ea] !text-[#1d6e48]">
            <CheckCircle2 size={13} /> Compliant
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => save('partial')} className="!border-[#f4dfae] !bg-[#fdf1dc] !text-[#b9791c]">
            <AlertTriangle size={13} /> Partial
          </Button>
          <Button type="button" variant="secondary" disabled={submitting} onClick={() => save('gap')} className="!border-[#f4c8c6] !bg-[#fbe7e6] !text-[#b23b3a]">
            <XCircle size={13} /> Gap
          </Button>
          <Button type="button" variant="ghost" disabled={submitting} onClick={() => save(null)}>
            <Circle size={13} /> Kosongkan
          </Button>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
      </div>
    </Modal>
  )
}

export default function ComplianceMatrixPage() {
  const { hasPermission } = useAuth()
  const canAssess = hasPermission('compliance.manage')

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [standardFilter, setStandardFilter] = useState('')
  const [activeCell, setActiveCell] = useState(null)

  const load = (standard) => {
    const qs = standard ? `?standard=${encodeURIComponent(standard)}` : ''
    api(`compliance-matrix${qs}`)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat Compliance Matrix.'))
  }

  useEffect(() => { load(standardFilter) }, [standardFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellMap = useMemo(() => {
    const map = new Map()
    data?.cells?.forEach((c) => map.set(`${c.clause_id}:${c.document_id}`, c))
    return map
  }, [data])

  const gapList = useMemo(() => {
    if (!data) return []
    const byClause = new Map(data.clauses.map((c) => [c.id, c]))
    const byDoc = new Map(data.documents.map((d) => [d.id, d]))
    return data.cells
      .filter((c) => c.status === 'gap' || c.status === 'partial')
      .map((c) => ({ ...c, clause: byClause.get(c.clause_id), document: byDoc.get(c.document_id) }))
      .filter((c) => c.clause && c.document)
  }, [data])

  function openCell(clause, document) {
    if (!canAssess) return
    const existing = cellMap.get(`${clause.id}:${document.id}`)
    setActiveCell({ clause, document, note: existing?.note ?? '' })
  }

  function handleSaved(result, status) {
    setActiveCell(null)
    load(standardFilter)
  }

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">{error}</div>
      </Layout>
    )
  }

  if (!data) {
    return (
      <Layout>
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Governance</div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <ShieldCheck size={18} /> Compliance Matrix
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          Peta pemenuhan klausul standar terhadap dokumen internal. Menampilkan gap analysis lintas ISO &amp; regulasi.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard status="compliant" value={data.stats.compliant} />
        <StatCard status="partial" value={data.stats.partial} />
        <StatCard status="gap" value={data.stats.gap} />
        <StatCard status="unassessed" value={data.stats.unassessed} />
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-bold text-[var(--color-neutral-dark)]">Matriks Klausul × Dokumen</h2>
            <p className="text-[11.5px] text-[var(--color-neutral-medium)]">Menampilkan {data.clauses.length} klausul × {data.documents.length} dokumen{!canAssess && ' — hanya lihat'}</p>
          </div>
          <select className={`${inputClass} w-64`} value={standardFilter} onChange={(e) => setStandardFilter(e.target.value)}>
            <option value="">Semua Standar</option>
            {data.standards.map((s) => (
              <option key={s.code} value={s.code} disabled={s.clauses_count === 0}>
                {s.code} ({s.clauses_count} klausul)
              </option>
            ))}
          </select>
        </div>

        {data.documents.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] italic text-[var(--color-neutral-soft)]">Belum ada dokumen di sistem.</p>
        ) : data.clauses.length === 0 ? (
          <p className="py-8 text-center text-[12.5px] italic text-[var(--color-neutral-soft)]">Standar ini belum punya taksonomi klausul.</p>
        ) : (
          <div className="max-h-[600px] overflow-auto rounded-md border border-[var(--color-neutral-border)]">
            <table className="w-full border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 border-b border-r border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-2 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                    Klausul
                  </th>
                  {data.documents.map((doc) => (
                    <th key={doc.id} className="sticky top-0 z-10 border-b border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                      <div className="font-mono">{doc.code}</div>
                      <div className="mt-0.5 truncate text-[10px] font-normal normal-case text-[var(--color-neutral-soft)]" style={{ maxWidth: 100 }} title={doc.title}>{doc.title}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.clauses.map((clause) => (
                  <tr key={clause.id} className="hover:bg-[var(--color-neutral-bg-soft)]">
                    <td className="sticky left-0 z-10 border-b border-r border-[var(--color-neutral-border)] bg-white px-2 py-2 text-left">
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{clause.standard_code}</span>
                        <span className="font-mono text-[11px] font-bold">{clause.code}</span>
                      </div>
                      <div className="text-[11.5px] font-semibold text-[var(--color-neutral-dark)]">{clause.title}</div>
                    </td>
                    {data.documents.map((doc) => {
                      const cell = cellMap.get(`${clause.id}:${doc.id}`)
                      return (
                        <td key={doc.id} className="border-b border-[var(--color-neutral-border)] px-1 py-2 text-center">
                          <CellButton status={cell?.status} disabled={!canAssess} onClick={() => openCell(clause, doc)} />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-neutral-medium)]">
          {Object.entries(STATUS_META).map(([key, m]) => (
            <span key={key} className="flex items-center gap-1"><m.icon size={13} style={{ color: m.text }} /> {m.label}</span>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-[13px] font-bold text-[var(--color-neutral-dark)]">Gap Analysis &amp; Tindak Lanjut</h2>
        <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">{gapList.length} sel gap/partial teridentifikasi pada tampilan saat ini</p>
        {gapList.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] italic text-[var(--color-neutral-soft)]">Tidak ada gap atau partial pada klausul yang ditampilkan.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {gapList.map((c) => {
              const m = STATUS_META[c.status]
              const prefillTitle = `${c.clause.standard_code} ${c.clause.code} — ${c.clause.title} belum terpenuhi pada ${c.document.code}`
              const prefillDesc = c.note || `Klausul ${c.clause.standard_code} ${c.clause.code} (${c.clause.title}) dinilai "${m.label}" terhadap dokumen ${c.document.code} — ${c.document.title}.`
              const findingUrl = `/findings?prefillTitle=${encodeURIComponent(prefillTitle)}&prefillDescription=${encodeURIComponent(prefillDesc)}&prefillClause=${encodeURIComponent(`${c.clause.standard_code} ${c.clause.code}`)}&prefillType=${c.status === 'gap' ? 'nc_minor' : 'ofi'}`
              return (
                <li key={`${c.clause_id}-${c.document_id}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{c.clause.standard_code}</span>
                      <span className="font-mono text-[12px] font-bold">{c.clause.code}</span>
                      <span className="text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">{c.clause.title}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: m.bg, color: m.text }}>{m.label}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">
                      <span className="font-mono">{c.document.code}</span> — {c.document.title}
                    </p>
                    {c.note && <p className="mt-1 text-[12px] italic text-[var(--color-neutral-medium)]">{c.note}</p>}
                  </div>
                  <Link to={findingUrl}>
                    <Button variant="secondary" size="sm"><ClipboardEdit size={12} /> Buat Temuan</Button>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <AssessCellModal open={Boolean(activeCell)} onClose={() => setActiveCell(null)} cell={activeCell} onSaved={handleSaved} />
    </Layout>
  )
}
