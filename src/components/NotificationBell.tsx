import { useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'

const CATEGORY_LABEL: Record<string, string> = {
  approval_pending: 'Menunggu Persetujuan',
  expiring_soon: 'Mendekati Kedaluwarsa',
  shared: 'Dokumen Dibagikan',
  assigned: 'Ditugaskan',
}

export function NotificationBell() {
  const { state, markNotificationRead, markAllNotificationsRead } = useApp()
  const [open, setOpen] = useState(false)
  const unread = state.notifications.filter((n) => !n.read)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-[var(--color-neutral-medium)] transition-colors hover:bg-[var(--color-neutral-bg)] hover:text-[var(--color-neutral-dark)]"
        aria-label="Notifikasi"
      >
        <Bell size={17} />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-brand-danger)] px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="edms-animate-in absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white shadow-[var(--shadow-popover)]">
            <div className="flex items-center justify-between border-b border-[var(--color-neutral-border)] px-3 py-2">
              <span className="text-sm font-semibold">Pusat Notifikasi</span>
              <button
                onClick={markAllNotificationsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-brand-primary)] hover:underline"
              >
                <CheckCheck size={12} /> Tandai semua dibaca
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {state.notifications.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-[var(--color-neutral-medium)]">Tidak ada notifikasi.</div>
              )}
              {state.notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.documentId ? `/documents/${n.documentId}` : '/tracking'}
                  onClick={() => {
                    markNotificationRead(n.id)
                    setOpen(false)
                  }}
                  className={`block border-b border-[var(--color-neutral-border)] px-3 py-2 text-xs last:border-b-0 hover:bg-[var(--color-neutral-bg)] ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand-teal)]">
                    {CATEGORY_LABEL[n.category] ?? n.category}
                  </div>
                  <div className="text-[var(--color-neutral-dark)]">{n.message}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--color-neutral-medium)]">{n.createdAt}</div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
