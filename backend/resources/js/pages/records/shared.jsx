export const MEDIUM_LABEL = { physical: 'Fisik', electronic: 'Elektronik', hybrid: 'Hibrida' }
export const CLASSIFICATION_LABEL = { public: 'Publik', internal: 'Internal', confidential: 'Rahasia', secret: 'Sangat Rahasia' }
export const DISPOSITION_LABEL = { destroy: 'Musnah', permanent: 'Permanen', review: 'Dinilai Kembali' }
export const RECORD_STATUS = {
  active: { label: 'Aktif', bg: '#e4ecf7', text: '#2f5aa3' },
  inactive: { label: 'Inaktif', bg: '#fef1cf', text: '#8a5a10' },
  destroyed: { label: 'Dimusnahkan', bg: '#eceef1', text: '#5b6673' },
  archived_permanent: { label: 'Permanen', bg: '#dcefe1', text: '#1f6a45' },
}

export const today = () => new Date().toISOString().slice(0, 10)
export const d = (v) => (v ? v.slice(0, 10) : '—')

export function RecordStatusBadge({ status }) {
  const c = RECORD_STATUS[status] ?? RECORD_STATUS.active
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

export function HoldBadge() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#f3c2c1] px-2 py-0.5 text-[10.5px] font-bold text-[#7d2726]" title="Penahanan legal — tidak boleh dimusnahkan">
      Legal Hold
    </span>
  )
}

export function errorText(err, fallback) {
  if (err?.body?.errors) return Object.values(err.body.errors).flat().join(' ')
  return err?.body?.message || err?.message || fallback
}
