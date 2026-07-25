import { useState } from 'react'
import type { FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { Card, Button, Field, inputClass } from './ui'

export function LoginGate({ onSuccess }: { onSuccess: () => void }) {
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
        body: JSON.stringify({ password }),
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
    <div className="flex h-screen w-full items-center justify-center bg-[#fafaf8] px-4">
      <Card className="w-full max-w-sm">
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold">EDMS — Masuk</h1>
            <p className="mt-0.5 text-xs text-[var(--color-neutral-medium)]">Masukkan password untuk mengakses sistem.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Password">
            <input
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </Field>
          {error && <p className="text-xs text-[var(--color-brand-danger)]">{error}</p>}
          <Button type="submit" variant="primary" className="justify-center" disabled={submitting}>
            {submitting ? 'Memeriksa…' : 'Masuk'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
