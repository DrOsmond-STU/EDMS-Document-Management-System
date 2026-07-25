import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { PageHeader, EmptyState, inputClass } from '../components/ui'

const ACTION_LABEL: Record<string, string> = {
  login: 'Login',
  create: 'Buat',
  status_change: 'Perubahan Status',
  delete: 'Hapus',
  restore: 'Pulihkan',
  master_data_change: 'Perubahan Master Data',
  view: 'Lihat',
  export: 'Ekspor',
}

export function AuditTrail() {
  const { state } = useApp()
  const [action, setAction] = useState('')
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return state.auditLog.filter((a) => {
      if (action && a.action !== action) return false
      if (kw && !`${a.actor} ${a.detail} ${a.entity}`.toLowerCase().includes(kw)) return false
      return true
    })
  }, [state.auditLog, action, keyword])

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle={`${filtered.length} dari ${state.auditLog.length} entri log — append-only`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <input className={`${inputClass} max-w-xs`} placeholder="Cari aktor atau keterangan…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select className={`${inputClass} max-w-[220px]`} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Semua Aksi</option>
          {Object.entries(ACTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Tidak ada entri log" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-border)] bg-white">
          <table className="w-full min-w-[800px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                <th className="px-3 py-2 font-semibold">Waktu</th>
                <th className="px-3 py-2 font-semibold">Aktor</th>
                <th className="px-3 py-2 font-semibold">Aksi</th>
                <th className="px-3 py-2 font-semibold">Entitas</th>
                <th className="px-3 py-2 font-semibold">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((a) => (
                <tr key={a.id} className="border-b border-[var(--color-neutral-border)] last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--color-neutral-medium)]">{a.timestamp}</td>
                  <td className="px-3 py-2 font-medium">{a.actor}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-chip-text)]">
                      {ACTION_LABEL[a.action] ?? a.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-neutral-medium)]">{a.entity}</td>
                  <td className="px-3 py-2">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="px-3 py-2 text-[11px] text-[var(--color-neutral-medium)]">Menampilkan 200 dari {filtered.length} entri terbaru.</p>
          )}
        </div>
      )}
    </div>
  )
}
