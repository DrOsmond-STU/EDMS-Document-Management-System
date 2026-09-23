import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, Trash2, X } from 'lucide-react'

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
  // Status di luar rantai maju resmi (lihat DocumentLifecycle::performAction).
  frozen: { bg: '#E0F2FE', text: '#0369A1' },
  revoked: { bg: '#450A0A', text: '#FECACA' },
  cancelled: { bg: '#E9EEF2', text: '#55606B' },
}
const STATUS_LABEL = {
  draft: 'Draft', review: 'Review', approval: 'Approval', released: 'Released', obsolete: 'Obsolete',
  frozen: 'Dibekukan', revoked: 'Dicabut', cancelled: 'Dibatalkan',
}

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
  password_reset: { bg: '#EAF3FB', text: '#2A6FB3' },
  download: { bg: '#EEF2F7', text: '#475569' },
  view: { bg: '#EEF2F7', text: '#475569' },
  logout: { bg: '#EEF2F7', text: '#475569' },
  delete: { bg: '#FBE7E6', text: '#B23B3A' },
  login_failed: { bg: '#FBE7E6', text: '#B23B3A' },
  account_locked: { bg: '#FBE7E6', text: '#B23B3A' },
  // Bekukan/cairkan/cabut/batalkan/tandai-digantikan (lihat
  // DocumentLifecycle::performAction) — warna oranye karena ini
  // penyimpangan pengecualian dari alur normal, bukan langkah rantai maju.
  lifecycle_action: { bg: '#FDF1DC', text: '#B9791C' },
}
const ACTION_LABEL = {
  create: 'Dibuat', upload: 'Diunggah', login: 'Masuk', update: 'Diperbarui',
  status_change: 'Status Berubah', password_change: 'Ganti Password', password_reset: 'Reset Password',
  download: 'Diunduh',
  view: 'Dilihat', logout: 'Keluar', delete: 'Dihapus', login_failed: 'Gagal Masuk',
  account_locked: 'Akun Terkunci', lifecycle_action: 'Aksi Siklus Hidup',
}

export function ActionBadge({ action }) {
  const c = ACTION_COLOR[action] || { bg: '#EEF2F7', text: '#475569' }
  return <BasePill bg={c.bg} text={c.text}>{ACTION_LABEL[action] || action}</BasePill>
}

/** Dialog modal generik — dipakai untuk konfirmasi hapus & aksi siklus hidup
 *  yang mewajibkan alasan tertulis, menggantikan window.confirm/prompt bawaan
 *  browser yang tidak konsisten dengan tampilan aplikasi. */
export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--color-neutral-border)] bg-[var(--color-surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[14.5px] font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg)]" title="Tutup">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
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

/** Tombol ikon kecil untuk aksi per baris (ubah/hapus). */
export function IconAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button" title={label} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${danger
        ? 'text-[var(--color-neutral-medium)] hover:bg-[#fbe7e6] hover:text-[#b23b3a]'
        : 'text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg)] hover:text-[var(--color-brand-primary)]'}`}
    >
      <Icon size={14} />
    </button>
  )
}

/**
 * Konfirmasi hapus standar untuk semua register. `onConfirm` mengembalikan
 * promise; bila server menolak (mis. data masih dipakai), pesannya
 * ditampilkan di dialog — bukan hilang diam-diam.
 */
export function ConfirmDelete({ open, onClose, title = 'Hapus data?', what, note, onConfirm, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setBusy(false); setError('') } }, [open])

  async function confirm() {
    setBusy(true); setError('')
    try {
      await onConfirm()
      onClose?.()
      onDone?.()
    } catch (err) {
      setError(err?.body?.message || err?.message || 'Gagal menghapus.')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title}>
      <p className="text-[13px] text-[var(--color-neutral-dark)]">Anda akan menghapus <b>{what}</b>.</p>
      <p className="mt-1.5 text-[12px] text-[var(--color-neutral-medium)]">
        {note ?? 'Data hilang dari daftar & perhitungan, tetapi tetap tercatat di Audit Trail.'}
      </p>
      {error && <div className="mt-3 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
        <Button type="button" variant="danger" onClick={confirm} disabled={busy}>
          <Trash2 size={13} /> {busy ? 'Menghapus…' : 'Hapus'}
        </Button>
      </div>
    </Modal>
  )
}

/** State kecil untuk ConfirmDelete: `ask(item)` membuka dialog untuk item tsb. */
export function useConfirmDelete() {
  const [target, setTarget] = useState(null)
  return { target, ask: setTarget, close: () => setTarget(null), open: target !== null }
}

/**
 * Keterangan bila pengguna hanya punya akses baca di sebuah modul — supaya
 * jelas kenapa tombol Tambah/Ubah/Hapus tidak tampil dan peran apa yang
 * dibutuhkan (diberikan lewat Manajemen Pengguna).
 */
export function ReadOnlyNotice({ roles }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-3.5 py-2.5 text-[12px] text-[var(--color-neutral-medium)]">
      <Lock size={13} className="mt-0.5 shrink-0" />
      <span>
        Anda hanya punya <b>akses baca</b> di modul ini. Tambah/ubah/hapus tersedia untuk peran: <b className="text-[var(--color-neutral-dark)]">{roles}</b>.
        {' '}Peran diberikan administrator di menu Manajemen Pengguna & Hak Akses.
      </span>
    </div>
  )
}
