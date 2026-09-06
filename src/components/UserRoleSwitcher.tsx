import { useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { ROLE_MAP } from '../constants'
import { Button, inputClass } from './ui'

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { changeOwnPassword } = useApp()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }
    setSubmitting(true)
    const err = await changeOwnPassword(currentPassword, newPassword)
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 px-1 py-1.5">
      <input
        type="password"
        placeholder="Password saat ini"
        className={inputClass}
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <input
        type="password"
        placeholder="Password baru (min. 8 karakter)"
        className={inputClass}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <input
        type="password"
        placeholder="Ulangi password baru"
        className={inputClass}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-[11px] text-[var(--color-brand-danger)]">{error}</p>}
      <Button type="submit" variant="primary" size="sm" className="justify-center" disabled={submitting}>
        {submitting ? 'Menyimpan…' : 'Simpan Password Baru'}
      </Button>
    </form>
  )
}

export function UserRoleSwitcher() {
  const { state, currentUser, setCurrentRole, logout } = useApp()
  const [open, setOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  function close() {
    setOpen(false)
    setChangingPassword(false)
  }

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
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="edms-animate-in absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-white p-2 shadow-[var(--shadow-popover)]">
            <div className="mb-1.5 px-2 pt-1 text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">
              {currentUser.name}
            </div>
            <div className="mb-2 px-2 text-[11px] text-[var(--color-neutral-medium)]">{currentUser.email}</div>

            {currentUser.roles.length > 1 && (
              <>
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  Tampilkan Sebagai
                </div>
                <div className="mb-2 flex flex-col gap-0.5">
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
                <div className="mb-2 border-t border-[var(--color-neutral-border)]" />
              </>
            )}

            {changingPassword ? (
              <ChangePasswordForm onDone={close} />
            ) : (
              <button
                onClick={() => setChangingPassword(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]"
              >
                <KeyRound size={13} /> Ganti Password
              </button>
            )}

            <button
              onClick={logout}
              className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/10"
            >
              <LogOut size={13} /> Keluar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
