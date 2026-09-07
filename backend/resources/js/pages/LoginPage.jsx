import { useState } from 'react'
import { FileText, Lock, ShieldCheck } from 'lucide-react'
import { useAuth } from '../AuthContext'
import { Button, Field, inputClass } from '../components/ui'
import { ApiError } from '../api'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] text-white">
            <FileText size={18} strokeWidth={2.25} />
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">EDMS</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-neutral-medium)]">Document Governance — v2</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-neutral-border)] bg-white p-7 shadow-[var(--shadow-elevated)]">
          <div className="mb-6">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-primary-soft)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-brand-primary-dark)]">
              <Lock size={11} strokeWidth={2.5} /> Akses Terbatas
            </div>
            <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Masuk ke EDMS</h1>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] leading-relaxed text-[var(--color-brand-success-text)]">
              <ShieldCheck size={13} /> Backend baru — data ternormalisasi, berkas asli dokumen didukung.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email">
              <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required autoComplete="username" />
            </Field>
            <Field label="Password">
              <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            {error && (
              <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>
            )}
            <Button type="submit" variant="primary" className="mt-1 w-full justify-center py-2" disabled={submitting}>
              {submitting ? 'Memeriksa…' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
