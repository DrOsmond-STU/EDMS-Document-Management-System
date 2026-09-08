import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, HelpCircle, KeyRound, LogOut, Search } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { findCurrentSection } from './navConfig'
import { roleLabels } from '../lib/roleLabels'
import { Button, inputClass } from './ui'
import { ApiError } from '../api'

function ChangePasswordForm({ onDone }) {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword, confirmPassword)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengganti password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 px-1 py-1.5">
      <input type="password" placeholder="Password saat ini" className={inputClass} value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      <input type="password" placeholder="Password baru (min. 8 karakter)" className={inputClass} value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      <input type="password" placeholder="Ulangi password baru" className={inputClass} value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      {error && <p className="text-[11px] text-[var(--color-brand-danger)]">{error}</p>}
      <Button type="submit" variant="primary" size="sm" className="justify-center" disabled={submitting}>
        {submitting ? 'Menyimpan…' : 'Simpan Password Baru'}
      </Button>
    </form>
  )
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-[var(--color-neutral-medium)] transition-colors hover:bg-[var(--color-neutral-bg)] hover:text-[var(--color-neutral-dark)]"
        aria-label="Notifikasi"
      >
        <Bell size={17} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white shadow-[var(--shadow-popover)]">
            <div className="border-b border-[var(--color-neutral-border)] px-3 py-2 text-[13px] font-semibold">Pusat Notifikasi</div>
            <div className="px-3 py-6 text-center text-[11.5px] text-[var(--color-neutral-medium)]">
              Fitur pemberitahuan dalam-aplikasi akan segera hadir.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  function close() {
    setOpen(false)
    setChangingPassword(false)
  }

  const initials = (user?.name || '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--color-neutral-border)] bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--color-neutral-border-strong)] hover:bg-[var(--color-neutral-bg-soft)]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] text-[10px] font-bold text-white">
          {initials}
        </div>
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[12px] font-semibold text-[var(--color-neutral-dark)]">{user?.name}</div>
          <div className="text-[10px] text-[var(--color-neutral-medium)]">{roleLabels(user?.roles)}</div>
        </div>
        <ChevronDown size={13} className="text-[var(--color-neutral-medium)]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white p-2 shadow-[var(--shadow-popover)]">
            <div className="mb-1.5 px-2 pt-1 text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">{user?.name}</div>
            <div className="mb-2 px-2 text-[11px] text-[var(--color-neutral-medium)]">{user?.email}</div>
            <div className="mb-2 border-t border-[var(--color-neutral-border)]" />

            {changingPassword ? (
              <ChangePasswordForm onDone={close} />
            ) : (
              <button
                onClick={() => setChangingPassword(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]"
              >
                <KeyRound size={13} /> Ganti Password
              </button>
            )}

            <button
              onClick={logout}
              className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/10"
            >
              <LogOut size={13} /> Keluar
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const section = findCurrentSection(location.pathname)

  useEffect(() => {
    function onKey(e) {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    navigate(`/documents?q=${encodeURIComponent(query)}`)
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-neutral-border)] bg-[var(--color-surface)]/80 px-5 py-2.5 backdrop-blur">
      <div className="hidden min-w-0 flex-shrink items-center gap-2 text-[12px] md:flex">
        {section.group && (
          <>
            <span className="text-[var(--color-neutral-soft)]">{section.group}</span>
            <span className="text-[var(--color-neutral-soft)]">/</span>
          </>
        )}
        {section.label && <span className="truncate font-semibold text-[var(--color-neutral-dark)]">{section.label}</span>}
      </div>

      <form
        onSubmit={handleSearch}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-1.5 transition-colors focus-within:border-[var(--color-brand-primary)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)]/15 sm:flex"
      >
        <Search size={14} className="text-[var(--color-neutral-medium)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari dokumen, kode, kata kunci…"
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--color-neutral-soft)]"
          aria-label="Cari dokumen"
        />
        <kbd className="hidden rounded border border-[var(--color-neutral-border)] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-neutral-medium)] shadow-sm md:inline">
          Ctrl + K
        </kbd>
      </form>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <a
          href="https://github.com/DrOsmond-STU/EDMS-Document-Management-System#readme"
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-full p-2 text-[var(--color-neutral-medium)] transition-colors hover:bg-[var(--color-neutral-bg)] hover:text-[var(--color-brand-primary)] md:inline-flex"
          aria-label="Bantuan"
          title="Bantuan"
        >
          <HelpCircle size={17} />
        </a>
        <NotificationBell />
        <div className="mx-1 hidden h-6 w-px bg-[var(--color-neutral-border)] md:block" />
        <UserMenu />
      </div>
    </header>
  )
}
