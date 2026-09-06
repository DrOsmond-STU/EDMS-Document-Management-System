import { useState } from 'react'
import { Plus, KeyRound } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { PageHeader, Card, Button, Field, inputClass } from '../components/ui'
import { ROLES, ROLE_MAP } from '../constants'
import { rolesHavePermission } from '../state/permissions'
import type { RoleId } from '../types'

export function UserManagement() {
  const { currentUser, addUser, toggleUserActive, resetUserPassword, state } = useApp()
  const canManage = rolesHavePermission(currentUser.roles, 'users.manage')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [functionId, setFunctionId] = useState(state.functions[0]?.id ?? '')
  const [selectedRoles, setSelectedRoles] = useState<RoleId[]>(['viewer'])
  const [showForm, setShowForm] = useState(false)
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSubmitting, setResetSubmitting] = useState(false)

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTargetId) return
    setResetSubmitting(true)
    setResetError('')
    const err = await resetUserPassword(resetTargetId, resetPassword)
    setResetSubmitting(false)
    if (err) {
      setResetError(err)
      return
    }
    setResetTargetId(null)
    setResetPassword('')
  }

  function toggleRole(r: RoleId) {
    setSelectedRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || selectedRoles.length === 0) return
    addUser({
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      functionId,
      roles: selectedRoles,
      active: true,
    })
    setName('')
    setEmail('')
    setSelectedRoles(['viewer'])
    setShowForm(false)
  }

  return (
    <div>
      <PageHeader
        title="Manajemen Pengguna & Hak Akses"
        subtitle={`${state.users.length} pengguna · matriks 11 peran RBAC`}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
              <Plus size={14} /> Pengguna Baru
            </Button>
          )
        }
      />

      {!canManage && (
        <p className="mb-4 rounded-md bg-[var(--color-brand-warning)]/10 px-3 py-2 text-xs text-[#8a5a10]">
          Peran aktif Anda tidak berwenang mengelola pengguna (khusus System Administrator).
        </p>
      )}

      {showForm && canManage && (
        <Card className="mb-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="Email"><input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            </div>
            <Field label="Fungsi/Departemen">
              <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
                {state.functions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Peran" hint="Boleh lebih dari satu">
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggleRole(r.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      selectedRoles.includes(r.id)
                        ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]'
                        : 'border-[var(--color-neutral-border)] text-[var(--color-neutral-medium)]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>
            <Button type="submit" variant="primary" className="self-end">Tambah Pengguna</Button>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-neutral-border)] bg-white">
        <table className="w-full min-w-[700px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <th className="px-3 py-2 font-semibold">Nama</th>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">Fungsi</th>
              <th className="px-3 py-2 font-semibold">Peran</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              {canManage && <th className="px-3 py-2 font-semibold"></th>}
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--color-neutral-border)] last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
                <td className="px-3 py-2.5 font-medium">{u.name}</td>
                <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{u.email}</td>
                <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{state.functions.find((f) => f.id === u.functionId)?.name ?? u.functionId}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className="rounded bg-[var(--color-chip-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-chip-text)]">
                        {ROLE_MAP[r].label}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-semibold ${u.active ? 'text-[var(--color-brand-success-text)]' : 'text-[var(--color-neutral-medium)]'}`}>
                    {u.active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                {canManage && (
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setResetTargetId(u.id)
                          setResetPassword('')
                          setResetError('')
                        }}
                        className="!py-1 text-[11px]"
                        title="Reset password"
                      >
                        <KeyRound size={12} />
                      </Button>
                      <Button variant="ghost" onClick={() => toggleUserActive(u.id)} className="!py-1 text-[11px]">
                        {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resetTargetId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setResetTargetId(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2">
            <Card>
              <h3 className="mb-1 text-sm font-bold text-[var(--color-neutral-dark)]">Reset Password</h3>
              <p className="mb-3 text-xs text-[var(--color-neutral-medium)]">
                {state.users.find((u) => u.id === resetTargetId)?.name} — password baru berlaku segera.
              </p>
              <form onSubmit={handleResetPassword} className="flex flex-col gap-2">
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Password baru (min. 8 karakter)"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={8}
                  autoFocus
                  required
                />
                {resetError && <p className="text-[11px] text-[var(--color-brand-danger)]">{resetError}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setResetTargetId(null)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" disabled={resetSubmitting}>
                    {resetSubmitting ? 'Menyimpan…' : 'Reset Password'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
