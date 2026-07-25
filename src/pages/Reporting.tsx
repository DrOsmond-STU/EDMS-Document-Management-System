import { Download } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button } from '../components/ui'
import { DOCUMENT_STATUS_ORDER, DOCUMENT_TYPES, STATUS_LABEL } from '../constants'

function toCsvValue(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function Reporting() {
  const { state } = useApp()
  const { documents, functions, standards } = state

  function exportCsv() {
    const headers = ['Kode', 'Judul', 'Jenis', 'Fungsi', 'Standar', 'Klasifikasi', 'Status', 'Validitas', 'Versi', 'Tanggal Efektif']
    const rows = documents.map((d) => [
      d.code,
      d.title,
      d.type,
      functions.find((f) => f.id === d.functionId)?.name ?? d.functionId,
      d.standards.join('; '),
      d.classification,
      STATUS_LABEL[d.status],
      d.validity,
      d.version,
      d.effectiveDate ?? '',
    ])
    const csv = [headers, ...rows].map((r) => r.map(toCsvValue).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `edms-register-dokumen-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const byType = DOCUMENT_TYPES.map((t) => ({ type: t, count: documents.filter((d) => d.type === t).length }))
  const byStandard = standards.map((s) => ({ ...s, count: documents.filter((d) => d.standards.includes(s.code)).length }))
  const byStatus = DOCUMENT_STATUS_ORDER.map((s) => ({ status: s, count: documents.filter((d) => d.status === s).length }))

  return (
    <div>
      <PageHeader
        title="Reporting & KPI"
        subtitle="Ringkasan per jenis, fungsi, dan standar"
        actions={
          <Button variant="primary" onClick={exportCsv}>
            <Download size={14} /> Ekspor CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-3 text-sm font-bold">Per Jenis Dokumen</h2>
          <div className="flex flex-col gap-2 text-xs">
            {byType.map((t) => (
              <div key={t.type} className="flex justify-between border-b border-[var(--color-neutral-border)] pb-1.5 last:border-0">
                <span>{t.type}</span>
                <span className="font-semibold">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">Per Status</h2>
          <div className="flex flex-col gap-2 text-xs">
            {byStatus.map((s) => (
              <div key={s.status} className="flex justify-between border-b border-[var(--color-neutral-border)] pb-1.5 last:border-0">
                <span>{STATUS_LABEL[s.status]}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-bold">Per Standar</h2>
          <div className="flex flex-col gap-2 text-xs">
            {byStandard.map((s) => (
              <div key={s.code} className="flex justify-between border-b border-[var(--color-neutral-border)] pb-1.5 last:border-0">
                <span>{s.code}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="mt-4 text-[11px] text-[var(--color-neutral-medium)]">
        Laporan kepatuhan review/distribusi/retensi penuh, dan KPI SLA approval otomatis, adalah bagian dari roadmap — lihat docs/01_PRD.md Bagian 9.
      </p>
    </div>
  )
}
