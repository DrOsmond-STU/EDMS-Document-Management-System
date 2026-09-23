import { Check } from 'lucide-react'

export const STATUS = {
  requested: { label: 'Permintaan', bg: '#e4ecf7', text: '#2f5aa3' },
  in_progress: { label: 'Penyusunan', bg: '#fef1cf', text: '#8a5a10' },
  finalized: { label: 'Menunggu Pengesahan', bg: '#efe6fa', text: '#6b4fa3' },
  ratified: { label: 'Disahkan', bg: '#dcefe1', text: '#1f6a45' },
  rejected: { label: 'Ditolak', bg: '#eceef1', text: '#5b6673' },
}

export const CLASSIFICATION_LABEL = {
  public: 'Publik', internal: 'Internal', restricted: 'Terbatas', confidential: 'Rahasia', secret: 'Sangat Rahasia', top_secret: 'Top Secret',
}

export function StatusBadge({ status }) {
  const c = STATUS[status] ?? STATUS.requested
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

export function Stepper({ labels, stages }) {
  return (
    <ol className="grid grid-cols-4 gap-y-4 md:grid-cols-8">
      {labels.map((label, i) => {
        const done = stages[i]
        const current = !done && (i === 0 || stages[i - 1])
        return (
          <li key={label} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute right-1/2 top-3.5 hidden h-0.5 w-full md:block ${stages[i - 1] ? 'bg-[#1d6e48]' : 'bg-[var(--color-neutral-border)]'}`} />}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                done ? 'border-[#1d6e48] bg-[#1d6e48] text-white'
                  : current ? 'border-[var(--color-brand-primary)] bg-white text-[var(--color-brand-primary)]'
                  : 'border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-soft)]'
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : i + 1}
            </span>
            <span className={`mt-1.5 px-1 text-[10.5px] leading-tight ${done ? 'font-semibold text-[#1d6e48]' : current ? 'font-semibold text-[var(--color-neutral-dark)]' : 'text-[var(--color-neutral-medium)]'}`}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function errorText(err, fallback) {
  const gaps = err?.body?.gaps
  if (gaps?.length) return `${err.body.message} ${gaps.join(' ')}`
  if (err?.body?.errors) return Object.values(err.body.errors).flat().join(' ')
  return err?.body?.message || err?.message || fallback
}

export const rupiah = (v) => (v == null ? '—' : `Rp ${Number(v).toLocaleString('id-ID')}`)
export const dt = (v) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—')
