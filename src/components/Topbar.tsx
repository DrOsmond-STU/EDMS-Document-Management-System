import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { UserRoleSwitcher } from './UserRoleSwitcher'

export function Topbar() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/documents?q=${encodeURIComponent(query)}`)
  }

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-neutral-border)] bg-white px-5 py-3">
      <form onSubmit={handleSearch} className="hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-[var(--color-neutral-border)] px-3 py-1.5 sm:flex">
        <Search size={15} className="text-[var(--color-neutral-medium)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari dokumen, kode, kata kunci…"
          className="w-full text-[13px] outline-none placeholder:text-[var(--color-neutral-medium)]"
        />
      </form>
      <div className="flex flex-1 items-center justify-end gap-3">
        <NotificationBell />
        <UserRoleSwitcher />
      </div>
    </header>
  )
}
