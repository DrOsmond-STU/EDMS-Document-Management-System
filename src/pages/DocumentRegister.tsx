import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Button, EmptyState, inputClass } from '../components/ui'
import { ClassificationBadge, StandardChip, StatusBadge, ValidityBadge } from '../components/Badges'
import { DOCUMENT_STATUS_ORDER, DOCUMENT_TYPES, STATUS_LABEL } from '../constants'
import type { ClassificationLevel } from '../types'

export function DocumentRegister() {
  const { state } = useApp()
  const { documents, functions, standards } = state
  const [params, setParams] = useSearchParams()

  const [keyword, setKeyword] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState<string>('')
  const [functionId, setFunctionId] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [standard, setStandard] = useState<string>('')
  const [classification, setClassification] = useState<string>('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return documents.filter((d) => {
      if (status && d.status !== status) return false
      if (functionId && d.functionId !== functionId) return false
      if (type && d.type !== type) return false
      if (standard && !d.standards.includes(standard)) return false
      if (classification && d.classification !== classification) return false
      if (kw) {
        const haystack = `${d.title} ${d.code} ${d.keywords.join(' ')}`.toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
  }, [documents, status, functionId, type, standard, classification, keyword])

  function funcName(id: string) {
    return functions.find((f) => f.id === id)?.name ?? id
  }

  return (
    <div>
      <PageHeader
        title="Register Dokumen"
        subtitle={`${filtered.length} dari ${documents.length} dokumen`}
        actions={
          <Link to="/documents/new">
            <Button variant="primary">
              <Plus size={14} /> Dokumen Baru
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <input
          className={inputClass}
          placeholder="Cari kata kunci…"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setParams(e.target.value ? { q: e.target.value } : {})
          }}
        />
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {DOCUMENT_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
          <option value="">Semua Fungsi</option>
          {functions.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Semua Jenis</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select className={inputClass} value={standard} onChange={(e) => setStandard(e.target.value)}>
          <option value="">Semua Standar</option>
          {standards.map((s) => (
            <option key={s.code} value={s.code}>{s.code}</option>
          ))}
        </select>
        <select className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value)}>
          <option value="">Semua Klasifikasi</option>
          {(['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'] as ClassificationLevel[]).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada dokumen ditemukan" description="Coba ubah atau hapus filter pencarian." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-border)] bg-white">
          <table className="w-full min-w-[900px] text-left text-[13px]">
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-[var(--color-neutral-border)] last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                  <td className="px-3 py-2.5 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{d.code}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/documents/${d.id}`} className="font-medium hover:text-[var(--color-brand-primary)] hover:underline">
                      {d.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{funcName(d.functionId)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {d.standards.map((s) => (
                        <StandardChip key={s} code={s} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><ClassificationBadge level={d.classification} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                  <td className="px-3 py-2.5"><ValidityBadge validity={d.validity} /></td>
                  <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{d.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
