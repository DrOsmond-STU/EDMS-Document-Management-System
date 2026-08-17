import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { ROLE_MAP } from '../constants'

export function UserRoleSwitcher() {
  const { state, currentUser, setCurrentUser, setCurrentRole } = useApp()
  const [open, setOpen] = useState(false)
  const activeUsers = state.users.filter((u) => u.active)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[var(--color-neutral-border)] bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-[var(--color-neutral-border-strong)] hover:bg-[var(--color-neutral-bg-soft)]"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] text-[10px] font-bold text-white">
          {currentUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="text-left leading-tight">
          <div className="text-[12px] font-semibold text-[var(--color-neutral-dark)]">{currentUser.name}</div>
          <div className="text-[10px] text-[var(--color-neutral-medium)]">{ROLE_MAP[state.currentRoleId].label}</div>
        </div>
        <ChevronDown size={13} className="text-[var(--color-neutral-medium)]" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="edms-animate-in absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white p-2 shadow-[var(--shadow-popover)]">
            <div className="mb-2 rounded-md bg-[var(--color-brand-warning)]/10 px-2 py-1.5 text-[10.5px] leading-snug text-[#8a5a10]">
              Prototipe: peran dipilih manual, bukan autentikasi sungguhan. Lihat{' '}
              <span className="font-semibold">docs/02_SECURITY.md</span>.
            </div>

            <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Ganti Pengguna
            </div>
            <div className="mb-2 max-h-40 overflow-y-auto">
              {activeUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u.id)
                    setCurrentRole(u.roles[0])
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-neutral-bg)] ${
                    u.id === currentUser.id ? 'bg-[var(--color-brand-primary)]/10 font-semibold' : ''
                  }`}
                >
                  <span>{u.name}</span>
                  <span className="text-[10px] text-[var(--color-neutral-medium)]">{u.functionId}</span>
                </button>
              ))}
            </div>

            <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              Peran Aktif
            </div>
            <div className="flex flex-col gap-0.5">
              {currentUser.roles.map((roleId) => (
                <button
                  key={roleId}
                  onClick={() => setCurrentRole(roleId)}
                  className={`rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-neutral-bg)] ${
                    roleId === state.currentRoleId ? 'bg-[var(--color-brand-primary)]/10 font-semibold' : ''
                  }`}
                >
                  {ROLE_MAP[roleId].label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
