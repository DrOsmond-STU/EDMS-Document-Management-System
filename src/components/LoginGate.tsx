import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, ShieldCheck, GitBranch, ClipboardList, Lock } from 'lucide-react'
import { Button, Field, inputClass } from './ui'

export function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? 'Gagal masuk. Coba lagi.')
        setSubmitting(false)
        return
      }
      onSuccess()
    } catch {
      setError('Tidak dapat menghubungi server.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-app-bg)]">
      {/* Left — brand / marketing panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-gradient-to-br from-[var(--color-brand-primary-dark)] via-[var(--color-brand-primary)] to-[var(--color-brand-teal)] lg:flex">
        {/* Decorative blurred blobs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-black/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.12),transparent_50%)]" />

        <div className="relative z-10 flex w-full flex-col justify-between px-14 py-14 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <FileText size={22} strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">EDMS</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
                Document Governance Platform
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight tracking-tight">
              Satu sumber kebenaran untuk seluruh siklus hidup dokumen.
            </h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/85">
              Draft → Review → Approval → Released → Obsolete — dengan penomoran otomatis,
              audit trail, dan RBAC 11 peran, selaras ISO 9001, 27001, 45001, dan standar
              manajemen lainnya.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Feature icon={<GitBranch size={14} />} label="Lifecycle terpandu" />
              <Feature icon={<ShieldCheck size={14} />} label="RBAC 11 peran" />
              <Feature icon={<ClipboardList size={14} />} label="Audit trail lengkap" />
              <Feature icon={<FileText size={14} />} label="Penomoran otomatis" />
            </div>
          </div>

          <div className="text-[11px] text-white/60">
            © {new Date().getFullYear()} EDMS Prototype · Bahasa Indonesia
          </div>
        </div>
      </div>

      {/* Right — login card */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-dark)] text-white shadow-[0_4px_10px_rgba(55,138,221,0.35)]">
              <FileText size={18} strokeWidth={2.25} />
            </div>
            <div>
              <div className="text-[15px] font-bold tracking-tight">EDMS</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-neutral-medium)]">
                Document Governance
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-neutral-border)] bg-white p-7 shadow-[var(--shadow-elevated)]">
            <div className="mb-6">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-primary-soft)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-brand-primary-dark)]">
                <Lock size={11} strokeWidth={2.5} /> Akses Terbatas
              </div>
              <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
                Masuk ke EDMS
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-neutral-medium)]">
                Masuk dengan email dan password akun Anda di EDMS.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  autoComplete="username"
                  placeholder="nama.anda@company.example"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </Field>
              {error && (
                <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                variant="primary"
                className="mt-1 w-full justify-center py-2"
                disabled={submitting}
              >
                {submitting ? 'Memeriksa…' : 'Masuk'}
              </Button>
            </form>

            <div className="mt-6 rounded-md border border-[#e8c48a] bg-[#fdf1dc] px-3 py-2 text-[11px] leading-relaxed text-[#7a4e0f]">
              <strong>Prototipe demo.</strong> Gunakan email salah satu pengguna contoh (lihat{' '}
              <code className="rounded bg-black/5 px-1 py-0.5">Manajemen Pengguna</code> setelah masuk) dengan
              password bawaan <code className="rounded bg-black/5 px-1 py-0.5">Edms#2026</code>. Segera ganti
              lewat menu akun setelah masuk.
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--color-neutral-medium)]">
            Butuh bantuan?{' '}
            <a
              href="https://github.com/DrOsmond-STU/EDMS-Document-Management-System"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--color-brand-primary)] hover:underline"
            >
              Lihat dokumentasi
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20 text-white">
        {icon}
      </div>
      <span className="text-[12.5px] font-medium text-white">{label}</span>
    </div>
  )
}
