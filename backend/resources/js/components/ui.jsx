export function Button({ variant = 'secondary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-[var(--color-brand-primary)] text-white shadow-sm hover:bg-[var(--color-brand-primary-dark)]',
    secondary: 'border border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)]',
    danger: 'bg-[var(--color-brand-danger)] text-white hover:brightness-110',
    ghost: 'text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]',
  }
  const sizes = { sm: 'px-2.5 py-1 text-[12px]', md: 'px-3.5 py-1.5 text-[13px]' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[var(--color-neutral-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-neutral-medium)]">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-[var(--color-neutral-border)] bg-white px-2.5 py-2 text-[13px] outline-none transition-colors placeholder:text-[var(--color-neutral-soft)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20'

export function StatusBadge({ status }) {
  const map = {
    draft: 'bg-[var(--color-chip-bg)] text-[var(--color-chip-text)]',
    review: 'bg-[#fdf1dc] text-[#b9791c]',
    approval: 'bg-[#eaf3fb] text-[#2a6fb3]',
    released: 'bg-[var(--color-brand-success-bg)] text-[var(--color-brand-success-text)]',
    obsolete: 'bg-[#fbe7e6] text-[#b23b3a]',
  }
  const labels = { draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', obsolete: 'Obsolete' }
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${map[status] || ''}`}>{labels[status] || status}</span>
}
