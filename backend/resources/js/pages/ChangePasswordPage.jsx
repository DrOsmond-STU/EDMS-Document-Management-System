import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Button, Field, inputClass } from '../components/ui'
import { ApiError } from '../api'

export default function ChangePasswordPage() {
  const { changePassword, logout, user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Konfirmasi password baru tidak sama.'); return }
    setSubmitting(true)
    try {
      await changePassword(currentPassword, password, confirm)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-neutral-border)] bg-white p-7 shadow-[var(--shadow-elevated)]">
        <div className="mb-5">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#fdf1dc] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#8a5a10]">
            <KeyRound size={11} strokeWidth={2.5} /> Wajib Ganti Password
          </div>
          <h1 className="text-[18px] font-bold tracking-tight">Halo, {user?.name}</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-neutral-medium)]">
            Password bawaan dibagikan sama ke semua akun. Ganti dulu sebelum melanjutkan.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Password saat ini">
            <input type="password" className={inputClass} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label="Password baru (min. 8 karakter, huruf & angka)">
            <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Ulangi password baru">
            <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
          {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
          <Button type="submit" variant="primary" className="justify-center py-2" disabled={submitting}>
            {submitting ? 'Menyimpan…' : 'Simpan & Lanjutkan'}
          </Button>
          <button type="button" onClick={logout} className="text-center text-[12px] text-[var(--color-neutral-medium)] hover:underline">
            Keluar
          </button>
        </form>
      </div>
    </div>
  )
}
