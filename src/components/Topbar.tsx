import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, HelpCircle } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { UserRoleSwitcher } from './UserRoleSwitcher'
import { NAV_GROUPS } from './navConfig'

function findCurrentSection(pathname: string): { group?: string; label?: string } {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      const match = it.path === '/' ? pathname === '/' : pathname === it.path || pathname.startsWith(it.path + '/')
      if (match) return { group: g.label, label: it.label }
    }
  }
  return {}
}

export function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const section = findCurrentSection(location.pathname)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/documents?q=${encodeURIComponent(query)}`)
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-neutral-border)] bg-[var(--color-surface)]/80 px-5 py-2.5 backdrop-blur">
      {/* Breadcrumb-style section indicator */}
      <div className="hidden min-w-0 flex-shrink items-center gap-2 text-[12px] md:flex">
        {section.group && (
          <>
            <span className="text-[var(--color-neutral-soft)]">{section.group}</span>
            <span className="text-[var(--color-neutral-soft)]">/</span>
          </>
        )}
        {section.label && (
          <span className="truncate font-semibold text-[var(--color-neutral-dark)]">
            {section.label}
          </span>
        )}
      </div>

      {/* Search */}
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
        <UserRoleSwitcher />
      </div>
    </header>
  )
}
