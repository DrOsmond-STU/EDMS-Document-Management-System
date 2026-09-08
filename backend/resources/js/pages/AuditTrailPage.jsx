import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardList, Search } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { ActionBadge, Button, Card, inputClass } from '../components/ui'

export default function AuditTrailPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('audit.view')

  const [logs, setLogs] = useState(null)
  const [meta, setMeta] = useState({ entities: [], actions: [] })
  const [error, setError] = useState('')

  const [keyword, setKeyword] = useState('')
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!canView) return
    api('audit-logs/meta').then(setMeta).catch(() => {})
  }, [canView])

  useEffect(() => {
    if (!canView) return
    const qs = new URLSearchParams()
    if (keyword.trim()) qs.set('q', keyword.trim())
    if (entity) qs.set('entity', entity)
    if (action) qs.set('action', action)
    if (actor.trim()) qs.set('actor', actor.trim())
    if (dateFrom) qs.set('date_from', dateFrom)
    if (dateTo) qs.set('date_to', dateTo)
    qs.set('page', String(page))

    const handle = setTimeout(() => {
      api(`audit-logs?${qs.toString()}`)
        .then(setLogs)
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat jejak audit.'))
    }, keyword || actor ? 300 : 0)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, keyword, entity, action, actor, dateFrom, dateTo, page])

  function updateFilter(setter) {
    return (value) => {
      setter(value)
      setPage(1)
    }
  }

  function formatTimestamp(iso) {
    if (!iso) return '—'
    return iso.replace('T', ' ').slice(0, 19)
  }

  if (!canView) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang melihat jejak audit. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Audit Trail</h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          {logs ? `${logs.total} catatan` : 'Jejak setiap perubahan — dibuat otomatis, tidak bisa diubah atau dihapus.'}
        </p>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="relative col-span-2 md:col-span-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
          <input
            className={`${inputClass} pl-7`}
            placeholder="Cari detail…"
            value={keyword}
            onChange={(e) => updateFilter(setKeyword)(e.target.value)}
          />
        </div>
        <input
          className={inputClass}
          placeholder="Nama pelaku…"
          value={actor}
          onChange={(e) => updateFilter(setActor)(e.target.value)}
        />
        <select className={inputClass} value={entity} onChange={(e) => updateFilter(setEntity)(e.target.value)}>
          <option value="">Semua Entitas</option>
          {meta.entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className={inputClass} value={action} onChange={(e) => updateFilter(setAction)(e.target.value)}>
          <option value="">Semua Aksi</option>
          {meta.actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" className={inputClass} value={dateFrom} onChange={(e) => updateFilter(setDateFrom)(e.target.value)} title="Dari tanggal" />
        <input type="date" className={inputClass} value={dateTo} onChange={(e) => updateFilter(setDateTo)(e.target.value)} title="Sampai tanggal" />
      </div>

      {!logs ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : logs.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <ClipboardList size={28} className="text-[var(--color-neutral-soft)]" />
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada catatan yang cocok dengan filter.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-border)] bg-white">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <th className="px-3 py-2 font-semibold">Waktu</th>
                  <th className="px-3 py-2 font-semibold">Pelaku</th>
                  <th className="px-3 py-2 font-semibold">Aksi</th>
                  <th className="px-3 py-2 font-semibold">Entitas</th>
                  <th className="px-3 py-2 font-semibold">Detail</th>
                  <th className="px-3 py-2 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--color-neutral-border)] align-top last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{formatTimestamp(log.created_at)}</td>
                    <td className="px-3 py-2.5 font-medium">{log.actor_name}</td>
                    <td className="px-3 py-2.5"><ActionBadge action={log.action} /></td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{log.entity}</div>
                      {log.entity_label && <div className="text-[11px] text-[var(--color-neutral-medium)]">{log.entity_label}</div>}
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-[var(--color-neutral-medium)]">{log.detail}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[var(--color-neutral-soft)]">{log.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.last_page > 1 && (
            <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--color-neutral-medium)]">
              <span>Halaman {logs.current_page} dari {logs.last_page}</span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={logs.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={13} /> Sebelumnya
                </Button>
                <Button variant="secondary" size="sm" disabled={logs.current_page >= logs.last_page} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
