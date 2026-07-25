import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[19px] font-bold text-[var(--color-neutral-dark)]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-[var(--color-neutral-medium)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-[var(--color-neutral-border)] bg-white p-4 ${className}`}>
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--color-brand-primary)] text-white hover:brightness-110',
  secondary: 'border border-[var(--color-neutral-border)] text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]',
  danger: 'bg-[var(--color-brand-danger)] text-white hover:brightness-110',
  ghost: 'text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]',
}

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-neutral-border)] py-12 text-center">
      <p className="text-sm font-semibold text-[var(--color-neutral-dark)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-[var(--color-neutral-medium)]">{description}</p>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-neutral-medium)]">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-[var(--color-neutral-border)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-brand-primary)]'
