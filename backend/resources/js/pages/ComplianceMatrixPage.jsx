import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { Card, ClassificationBadge, StatusBadge } from '../components/ui'

function StandardCard({ row }) {
  return (
    <Card className={row.has_gap ? '!border-[#f3c9c8]' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[12px] font-bold text-[var(--color-neutral-medium)]">{row.code}</div>
          <h2 className="text-[14px] font-bold text-[var(--color-neutral-dark)]">{row.name}</h2>
        </div>
        {row.has_gap ? (
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-[#FBE7E6] px-2.5 py-1 text-[11px] font-semibold text-[#B23B3A]">
            <AlertTriangle size={12} /> Belum ada dokumen released
          </span>
        ) : (
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-[#E5F5EC] px-2.5 py-1 text-[11px] font-semibold text-[#1E8E5A]">
            <CheckCircle2 size={12} /> {row.released_count} dokumen released
          </span>
        )}
      </div>

      {row.documents.length === 0 ? (
        <p className="mt-3 text-[12px] italic text-[var(--color-neutral-soft)]">Belum ada dokumen yang ditandai memenuhi standar ini.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {row.documents.map((doc) => (
            <Link
              key={doc.id}
              to={`/documents/${doc.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-neutral-border)] px-2.5 py-1.5 text-[12.5px] hover:bg-[var(--color-neutral-bg)]"
            >
              <div className="min-w-0">
                <span className="font-mono text-[11px] font-semibold text-[var(--color-neutral-medium)]">{doc.code}</span>{' '}
                <span className="font-medium">{doc.title}</span>
                <span className="ml-1.5 text-[11px] text-[var(--color-neutral-medium)]">— {doc.org_function?.name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ClassificationBadge level={doc.classification} />
                <StatusBadge status={doc.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function ComplianceMatrixPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('compliance-matrix')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat Compliance Matrix.'))
  }, [])

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

  const { summary } = data

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <ShieldCheck size={18} /> Compliance Matrix
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          Standar acuan dan dokumen released yang menyatakan memenuhinya — hanya dokumen released yang dihitung sebagai bukti kepatuhan berlaku.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-3">
        <Card className="!p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">Total Standar</div>
          <div className="mt-1.5 text-[22px] font-bold leading-none text-[var(--color-neutral-dark)]">{summary.total_standards}</div>
        </Card>
        <Card className="!p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">Terpenuhi</div>
          <div className="mt-1.5 text-[22px] font-bold leading-none text-[#1E8E5A]">{summary.covered}</div>
        </Card>
        <Card className="!p-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">Gap (Belum Terpenuhi)</div>
          <div className={`mt-1.5 text-[22px] font-bold leading-none ${summary.gaps.length > 0 ? 'text-[#B23B3A]' : 'text-[var(--color-neutral-dark)]'}`}>
            {summary.gaps.length}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        {data.standards.map((row) => <StandardCard key={row.code} row={row} />)}
      </div>
    </Layout>
  )
}
