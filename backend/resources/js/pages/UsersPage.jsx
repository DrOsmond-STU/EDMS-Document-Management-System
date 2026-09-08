import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Copy, KeyRound, Plus, Search, ShieldOff, ShieldCheck, Users as UsersIcon,
} from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { BasePill, Button, Card, Field, inputClass, Modal, StandardChip } from '../components/ui'

/** Ditampilkan SEKALI persis setelah server membuat/mereset password —
 *  tidak pernah disimpan atau ditampilkan lagi setelah modal ini ditutup
 *  (lihat catatan di UserController). */
function TemporaryPasswordModal({ password, userName, onClose }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard tidak tersedia — pengguna salin manual */ }
  }

  return (
    <Modal open={Boolean(password)} onClose={onClose} title="Password Sementara">
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-[var(--color-neutral-medium)]">
          Password untuk <span className="font-semibold text-[var(--color-neutral-dark)]">{userName}</span> berikut
          ini hanya ditampilkan SEKALI dan tidak tersimpan di mana pun setelah ini ditutup. Sampaikan ke
          pengguna secara langsung — mereka wajib menggantinya saat login pertama.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3 py-2">
          <code className="flex-1 font-mono text-[14px] font-bold tracking-wide">{password}</code>
          <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
            <Copy size={12} /> {copied ? 'Tersalin' : 'Salin'}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>Selesai</Button>
        </div>
      </div>
    </Modal>
  )
}

function UserFormModal({ open, onClose, roles, functions, editingUser, onSaved }) {
  const isEdit = Boolean(editingUser)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [functionId, setFunctionId] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editingUser?.name ?? '')
    setEmail(editingUser?.email ?? '')
    setFunctionId(editingUser?.function_id ?? '')
    setSelectedRoles(editingUser?.roles?.map((r) => r.id) ?? [])
    setError('')
  }, [open, editingUser])

  function toggleRole(id) {
    setSelectedRoles((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = { name, email, function_id: functionId || null, roles: selectedRoles }
      const result = isEdit
        ? await api(`users/${editingUser.id}`, { method: 'PATCH', body })
        : await api('users', { method: 'POST', body })
      onSaved(result)
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors ? Object.values(err.body.errors).flat().join(' ') : err.body?.message || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Ubah Pengguna' : 'Pengguna Baru'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Nama"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Email"><input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Fungsi/Departemen" hint="Opsional">
          <select className={inputClass} value={functionId} onChange={(e) => setFunctionId(e.target.value)}>
            <option value="">— Tidak ditentukan —</option>
            {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
        <Field label="Peran" hint="Boleh lebih dari satu — menentukan hak akses pengguna">
          <div className="flex flex-col gap-1.5 rounded-md border border-[var(--color-neutral-border)] p-2.5">
            {roles.map((r) => (
              <label key={r.id} className="flex items-start gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedRoles.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
                <span>
                  <span className="font-semibold">{r.label}</span>
                  {r.summary && <span className="block text-[11px] text-[var(--color-neutral-medium)]">{r.summary}</span>}
                </span>
              </label>
            ))}
          </div>
        </Field>
        {!isEdit && (
          <p className="text-[11.5px] text-[var(--color-neutral-medium)]">
            Password sementara akan dibuat otomatis dan ditampilkan sekali setelah akun dibuat.
          </p>
        )}
        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" disabled={submitting || selectedRoles.length === 0}>
            {submitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Pengguna'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function UserRow({ user, isSelf, onEdit, onToggleActive, onResetPassword, busy }) {
  return (
    <tr className="border-b border-[var(--color-neutral-border)] align-top last:border-b-0 hover:bg-[var(--color-neutral-bg)]">
      <td className="px-3 py-2.5">
        <div className="font-medium">{user.name}{isSelf && <span className="ml-1.5 text-[10.5px] font-semibold text-[var(--color-brand-primary)]">(Anda)</span>}</div>
        <div className="text-[11.5px] text-[var(--color-neutral-medium)]">{user.email}</div>
      </td>
      <td className="px-3 py-2.5 text-[var(--color-neutral-medium)]">{user.org_function?.name ?? '—'}</td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {user.roles?.map((r) => <StandardChip key={r.id} code={r.label} />)}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {user.active
          ? <BasePill bg="#E5F5EC" text="#1E8E5A">Aktif</BasePill>
          : <BasePill bg="#E9EEF2" text="#55606B">Nonaktif</BasePill>}
        {user.must_change_password && (
          <div className="mt-1 text-[10.5px] text-[var(--color-neutral-medium)]">Belum ganti password awal</div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[11.5px] text-[var(--color-neutral-medium)]">
        {user.last_login_at ? user.last_login_at.replace('T', ' ').slice(0, 16) : 'Belum pernah'}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(user)} title="Ubah">Ubah</Button>
          <Button variant="ghost" size="sm" onClick={() => onResetPassword(user)} disabled={busy} title="Reset password">
            <KeyRound size={13} />
          </Button>
          <Button
            variant="ghost" size="sm" disabled={busy || isSelf} title={isSelf ? 'Tidak bisa menonaktifkan akun sendiri' : (user.active ? 'Nonaktifkan' : 'Aktifkan')}
            onClick={() => onToggleActive(user)}
          >
            {user.active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth()
  const canManage = hasPermission('users.manage')

  const [users, setUsers] = useState(null)
  const [meta, setMeta] = useState({ roles: [] })
  const [functions, setFunctions] = useState([])
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const fetchUsers = useCallback(() => {
    if (!canManage) return
    const qs = new URLSearchParams()
    if (keyword.trim()) qs.set('q', keyword.trim())
    if (roleFilter) qs.set('role', roleFilter)
    if (activeFilter) qs.set('active', activeFilter)
    qs.set('page', String(page))
    api(`users?${qs.toString()}`)
      .then(setUsers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat pengguna.'))
  }, [canManage, keyword, roleFilter, activeFilter, page])

  useEffect(() => {
    if (!canManage) return
    api('users/meta').then((m) => setMeta(m)).catch(() => {})
    api('master-data').then((m) => setFunctions(m.functions)).catch(() => {})
  }, [canManage])

  useEffect(() => {
    const handle = setTimeout(fetchUsers, keyword ? 300 : 0)
    return () => clearTimeout(handle)
  }, [fetchUsers, keyword])

  function updateFilter(setter) {
    return (value) => { setter(value); setPage(1) }
  }

  function openCreate() {
    setEditingUser(null)
    setFormOpen(true)
  }

  function openEdit(user) {
    setEditingUser(user)
    setFormOpen(true)
  }

  function handleSaved(result) {
    setFormOpen(false)
    if (result.temporary_password) {
      setTempPasswordInfo({ password: result.temporary_password, name: result.user.name })
    }
    fetchUsers()
  }

  async function handleToggleActive(user) {
    setBusyId(user.id)
    try {
      await api(`users/${user.id}`, { method: 'PATCH', body: { active: !user.active } })
      fetchUsers()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResetPassword(user) {
    if (!confirm(`Buat password baru untuk "${user.name}"? Password lama akan langsung tidak berlaku.`)) return
    setBusyId(user.id)
    try {
      const result = await api(`users/${user.id}/reset-password`, { method: 'POST' })
      setTempPasswordInfo({ password: result.temporary_password, name: user.name })
      fetchUsers()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Gagal mereset password.')
    } finally {
      setBusyId(null)
    }
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang mengelola pengguna. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Manajemen Pengguna & Hak Akses</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            {users ? `${users.total} pengguna` : 'Kelola akun dan peran — akses dicabut lewat nonaktifkan, bukan hapus, supaya jejak audit tetap utuh.'}
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}><Plus size={14} /> Pengguna Baru</Button>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="relative col-span-2 md:col-span-2">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-neutral-soft)]" />
          <input className={`${inputClass} pl-7`} placeholder="Cari nama atau email…" value={keyword} onChange={(e) => updateFilter(setKeyword)(e.target.value)} />
        </div>
        <select className={inputClass} value={roleFilter} onChange={(e) => updateFilter(setRoleFilter)(e.target.value)}>
          <option value="">Semua Peran</option>
          {meta.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select className={inputClass} value={activeFilter} onChange={(e) => updateFilter(setActiveFilter)(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="1">Aktif</option>
          <option value="0">Nonaktif</option>
        </select>
      </div>

      {!users ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : users.data.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <UsersIcon size={28} className="text-[var(--color-neutral-soft)]" />
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Tidak ada pengguna yang cocok dengan filter.</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-border)] bg-white">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-neutral-border)] text-[11px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  <th className="px-3 py-2 font-semibold">Pengguna</th>
                  <th className="px-3 py-2 font-semibold">Fungsi</th>
                  <th className="px-3 py-2 font-semibold">Peran</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Login Terakhir</th>
                  <th className="px-3 py-2 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUser?.id}
                    onEdit={openEdit}
                    onToggleActive={handleToggleActive}
                    onResetPassword={handleResetPassword}
                    busy={busyId === u.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {users.last_page > 1 && (
            <div className="mt-3 flex items-center justify-between text-[12px] text-[var(--color-neutral-medium)]">
              <span>Halaman {users.current_page} dari {users.last_page}</span>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={users.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={13} /> Sebelumnya
                </Button>
                <Button variant="secondary" size="sm" disabled={users.current_page >= users.last_page} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        roles={meta.roles}
        functions={functions}
        editingUser={editingUser}
        onSaved={handleSaved}
      />

      {tempPasswordInfo && (
        <TemporaryPasswordModal
          password={tempPasswordInfo.password}
          userName={tempPasswordInfo.name}
          onClose={() => setTempPasswordInfo(null)}
        />
      )}
    </Layout>
  )
}
