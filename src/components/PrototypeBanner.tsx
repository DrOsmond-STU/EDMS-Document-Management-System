import { useState } from 'react'
import { ShieldAlert, X } from 'lucide-react'

export function PrototypeBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-start gap-2.5 border-b border-[#e8c48a] bg-[#fdf1dc] px-5 py-2.5 text-[#7a4e0f]">
      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-[12px] leading-snug">
        <strong>Prototipe demo — bukan untuk operasional resmi.</strong> Tidak ada autentikasi, backend, atau
        enkripsi sungguhan; seluruh data tersimpan di localStorage browser Anda. Fitur Asisten AI, Information
        Protection, Digital Signature, dan Integration sengaja tidak disertakan karena membutuhkan backend
        (lihat <code className="rounded bg-black/5 px-1 py-0.5">docs/02_SECURITY.md</code> §2 dan §12 sebelum
        deployment produksi).
      </p>
      <button onClick={() => setDismissed(true)} className="shrink-0 rounded p-0.5 hover:bg-black/5" aria-label="Tutup">
        <X size={14} />
      </button>
    </div>
  )
}
