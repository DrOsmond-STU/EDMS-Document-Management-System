import { Lock } from 'lucide-react'

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

export function BasePill({ bg, text, children }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold"
      style={{ backgroundColor: bg, color: text }}
    >
      {children}
    </span>
  )
}

// Warna & label persis mengikuti purwarupa lama (docs/05_BRAND.md §6) supaya
// tampilan status/validitas/klasifikasi konsisten di kedua versi aplikasi.
const STATUS_COLOR = {
  draft: { bg: '#EEF2F7', text: '#475569' },
  review: { bg: '#FDF1DC', text: '#B9791C' },
  approval: { bg: '#FCE8D1', text: '#C1650F' },
  released: { bg: '#E5F5EC', text: '#1E8E5A' },
  obsolete: { bg: '#FBE7E6', text: '#B23B3A' },
}
const STATUS_LABEL = { draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', obsolete: 'Obsolete' }

export function StatusBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.draft
  return <BasePill bg={c.bg} text={c.text}>{STATUS_LABEL[status] || status}</BasePill>
}

const VALIDITY_COLOR = {
  berlaku: { bg: '#E5F5EC', text: '#1E8E5A' },
  kadaluarsa: { bg: '#FBE7E6', text: '#B23B3A' },
  tidak_berlaku: { bg: '#E9EEF2', text: '#55606B' },
  belum_berlaku: { bg: '#EEF2F7', text: '#475569' },
}
const VALIDITY_LABEL = { berlaku: 'Berlaku', kadaluarsa: 'Kadaluarsa', tidak_berlaku: 'Tidak Berlaku', belum_berlaku: 'Belum Berlaku' }

export function ValidityBadge({ validity }) {
  const c = VALIDITY_COLOR[validity] || VALIDITY_COLOR.belum_berlaku
  return <BasePill bg={c.bg} text={c.text}>{VALIDITY_LABEL[validity] || validity}</BasePill>
}

const CLASSIFICATION_COLOR = {
  public: { bg: '#7fa88f', text: '#ffffff' },
  internal: { bg: '#5f8fb4', text: '#ffffff' },
  restricted: { bg: '#c98a3e', text: '#ffffff' },
  confidential: { bg: '#b9563f', text: '#ffffff' },
  secret: { bg: '#7a3b3b', text: '#ffffff' },
  top_secret: { bg: '#1f2937', text: '#ffffff' },
}
const CLASSIFICATION_LABEL = {
  public: 'Public', internal: 'Internal', restricted: 'Restricted',
  confidential: 'Confidential', secret: 'Secret', top_secret: 'Top Secret',
}
const CLASSIFICATION_HAS_LOCK = { public: false, internal: false, restricted: true, confidential: true, secret: true, top_secret: true }

export function ClassificationBadge({ level }) {
  const c = CLASSIFICATION_COLOR[level] || CLASSIFICATION_COLOR.internal
  return (
    <BasePill bg={c.bg} text={c.text}>
      {CLASSIFICATION_HAS_LOCK[level] && <Lock size={11} strokeWidth={2.5} />}
      {CLASSIFICATION_LABEL[level] || level}
    </BasePill>
  )
}

// Warna aksi audit — hijau untuk yang membangun/menambah, biru untuk
// perubahan, merah untuk yang menghapus/menandakan masalah keamanan,
// ungu untuk sesi. Daftar ini mengikuti nilai action nyata yang benar-benar
// ditulis AuditLogger di seluruh aplikasi (lihat App\Services\AuditLogger
// pemanggilnya) — bukan daftar yang ditebak.
const ACTION_COLOR = {
  create: { bg: '#E5F5EC', text: '#1E8E5A' },
  upload: { bg: '#E5F5EC', text: '#1E8E5A' },
  login: { bg: '#EFE8FB', text: '#6B3FA0' },
  update: { bg: '#EAF3FB', text: '#2A6FB3' },
  status_change: { bg: '#EAF3FB', text: '#2A6FB3' },
  password_change: { bg: '#EAF3FB', text: '#2A6FB3' },
  download: { bg: '#EEF2F7', text: '#475569' },
  logout: { bg: '#EEF2F7', text: '#475569' },
  delete: { bg: '#FBE7E6', text: '#B23B3A' },
  login_failed: { bg: '#FBE7E6', text: '#B23B3A' },
  account_locked: { bg: '#FBE7E6', text: '#B23B3A' },
}
const ACTION_LABEL = {
  create: 'Dibuat', upload: 'Diunggah', login: 'Masuk', update: 'Diperbarui',
  status_change: 'Status Berubah', password_change: 'Ganti Password', download: 'Diunduh',
  logout: 'Keluar', delete: 'Dihapus', login_failed: 'Gagal Masuk', account_locked: 'Akun Terkunci',
}

export function ActionBadge({ action }) {
  const c = ACTION_COLOR[action] || { bg: '#EEF2F7', text: '#475569' }
  return <BasePill bg={c.bg} text={c.text}>{ACTION_LABEL[action] || action}</BasePill>
}

export function StandardChip({ code }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: 'var(--color-chip-bg)', color: 'var(--color-chip-text)' }}
    >
      {code}
    </span>
  )
}
