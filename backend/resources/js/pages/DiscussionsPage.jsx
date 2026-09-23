import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, CheckCircle2, MessagesSquare, User } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { Card } from '../components/ui'

const FILTERS = [
  { key: 'open', label: 'Utas Terbuka', icon: MessagesSquare },
  { key: 'mentions', label: 'Menyebut Saya', icon: AtSign },
  { key: 'mine', label: 'Utas & Dokumen Saya', icon: User },
  { key: 'resolved', label: 'Selesai', icon: CheckCircle2 },
]

const when = (v) => new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export default function DiscussionsPage() {
  const [filter, setFilter] = useState('open')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    api(`discussions?filter=${filter}`).then(setData).catch((err) => setError(err?.message || 'Gagal memuat diskusi.'))
  }, [filter])

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Collaboration</div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><MessagesSquare size={18} /> Comment & Discussion</h1>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
          Semua utas diskusi pada dokumen yang boleh Anda lihat. Diskusi dimulai dari halaman detail dokumen; sebut rekan dengan @nama agar mereka mendapat notifikasi.
        </p>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const Icon = f.icon
          const count = f.key === 'open' ? data?.counts?.open : f.key === 'mentions' ? data?.counts?.mentions : null
          return (
            <button type="button" key={f.key} onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${filter === f.key ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white' : 'border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)]'}`}>
              <Icon size={13} /> {f.label}{count != null ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      <Card>
        {!data ? <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p> : data.threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <MessagesSquare size={28} className="text-[var(--color-neutral-soft)]" />
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada utas pada filter ini.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {data.threads.map((t) => (
              <li key={t.id}>
                <Link to={`/documents/${t.document.id}#diskusi`} className="block px-1 py-3 hover:bg-[var(--color-neutral-bg-soft)]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[12px]">
                      <span className="font-mono text-[11px] text-[var(--color-brand-primary)]">{t.document.code}</span>
                      <span className="ml-2 font-semibold text-[var(--color-neutral-dark)]">{t.document.title}</span>
                      {t.section && <span className="ml-2 rounded bg-[var(--color-neutral-bg)] px-1.5 py-0.5 text-[10.5px] font-semibold">{t.section}</span>}
                    </div>
                    <span className="text-[10.5px] text-[var(--color-neutral-medium)]">{when(t.updated_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] text-[var(--color-neutral-dark)]">
                    {t.is_deleted ? <em className="text-[var(--color-neutral-soft)]">Komentar utama telah dihapus</em> : t.body}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--color-neutral-medium)]">
                    <span>oleh {t.author?.name}</span>
                    <span>{t.replies_count} balasan</span>
                    {t.resolved_at && <span className="font-semibold text-[#1d6e48]">Selesai</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Layout>
  )
}
