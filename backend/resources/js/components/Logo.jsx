export function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="docGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4fb2f0" />
          <stop offset="1" stopColor="#0b5fa8" />
        </linearGradient>
      </defs>
      <path d="M18 68 A 34 34 0 1 0 66 24" fill="none" stroke="#0b5fa8" strokeWidth="8" strokeLinecap="round" />
      <path d="M66 24 A 34 34 0 0 1 74 48" fill="none" stroke="#f2a93b" strokeWidth="8" strokeLinecap="round" />
      <path d="M32 14 H58 L72 28 V82 A5 5 0 0 1 67 87 H32 A5 5 0 0 1 27 82 V19 A5 5 0 0 1 32 14 Z" fill="url(#docGrad)" />
      <path d="M58 14 V24 A4 4 0 0 0 62 28 H72 Z" fill="#dcecfa" />
      <rect x="36" y="40" width="28" height="6" rx="3" fill="#eaf4fc" />
      <rect x="36" y="53" width="28" height="6" rx="3" fill="#eaf4fc" />
      <path d="M63 62 L84 70 V85 C84 94 76 100 67 103 C58 100 50 94 50 85 V70 Z" fill="#0b2340" />
      <path d="M58 84 L64 90 L76 76" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 36, showTagline = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className="text-[19px] font-extrabold tracking-tight">
          <span className="text-[var(--color-neutral-dark)]">Do</span>
          <span className="bg-gradient-to-br from-[var(--color-brand-primary)] to-[#4fb2f0] bg-clip-text text-transparent">GO</span>
        </div>
        <div className="-mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-neutral-medium)]">
          Document Governance
        </div>
        {showTagline && (
          <p className="mt-1 max-w-[220px] text-[11px] leading-snug text-[var(--color-neutral-medium)]">
            Tata kelola dokumen untuk memastikan dokumen dikelola dengan baik, aman, dan sesuai aturan.
          </p>
        )}
      </div>
    </div>
  )
}
