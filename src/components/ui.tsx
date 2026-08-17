import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-primary)]">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-[var(--color-neutral-dark)]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--color-neutral-medium)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({
  children,
  className = '',
  padded = true,
  interactive = false,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  interactive?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-neutral-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${
        interactive ? 'transition hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]' : ''
      } ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13.5px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          {children}
        </h2>
        {hint && (
          <p className="mt-0.5 text-[11.5px] text-[var(--color-neutral-medium)]">{hint}</p>
        )}
      </div>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md'

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-brand-primary)] text-white shadow-sm hover:bg-[var(--color-brand-primary-dark)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)]/40',
  secondary:
    'border border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)] hover:border-[var(--color-neutral-border-strong)]',
  outline:
    'border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-soft)]',
  danger:
    'bg-[var(--color-brand-danger)] text-white shadow-sm hover:brightness-110',
  ghost:
    'text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg)]',
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-[12px]',
  md: 'px-3.5 py-1.5 text-[13px]',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${SIZE_CLASS[size]} ${VARIANT_CLASS[variant]} ${className}`}
      {...props}
    />
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-neutral-border-strong)] bg-[var(--color-neutral-bg-soft)] px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-neutral-medium)] shadow-[var(--shadow-card)]">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--color-neutral-dark)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--color-neutral-medium)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
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
  'w-full rounded-md border border-[var(--color-neutral-border)] bg-white px-2.5 py-2 text-[13px] outline-none transition-colors placeholder:text-[var(--color-neutral-soft)] focus:border-[var(--color-brand-primary)] focus:ring-2 focus:ring-[var(--color-brand-primary)]/20'

/**
 * Small pill-style chip used inline in tables/lists — brand-neutral, subtle.
 */
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--color-chip-bg)] text-[var(--color-chip-text)]',
    primary: 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]',
    success: 'bg-[var(--color-brand-success-bg)] text-[var(--color-brand-success-text)]',
    warning: 'bg-[#fdf1dc] text-[#b9791c]',
    danger: 'bg-[#fbe7e6] text-[#b23b3a]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
