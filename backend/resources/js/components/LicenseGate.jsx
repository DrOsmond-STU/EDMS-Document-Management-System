import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '../api'

// Gerbang lisensi di level PALING LUAR — dicek sebelum apa pun lain (bahkan
// sebelum CompanyProvider/AuthProvider dimuat). Kalau lisensi tidak valid,
// tidak ada satu pun bagian aplikasi yang dirender, termasuk halaman login —
// sesuai keputusan bahwa lisensi kedaluwarsa memblokir total untuk semua
// peran. Endpoint /api/license-status ini publik dan sengaja di luar gerbang
// license.active di backend, supaya pesannya bisa ditampilkan dengan jelas.
export function LicenseGate({ children }) {
  const [status, setStatus] = useState(null)
  const [checkFailed, setCheckFailed] = useState(false)

  useEffect(() => {
    api('license-status')
      .then(setStatus)
      .catch(() => setCheckFailed(true))
  }, [])

  if (!status && !checkFailed) {
    return <div className="flex min-h-screen w-full items-center justify-center text-[13px] text-[var(--color-neutral-medium)]">Memuat…</div>
  }

  // Kegagalan jaringan (server benar-benar tidak terjangkau) TIDAK dianggap
  // lisensi tidak valid — supaya gangguan koneksi sesaat tidak salah tampil
  // sebagai "lisensi kedaluwarsa". Backend sendiri tetap menolak permintaan
  // lain lewat middleware license.active kalau memang lisensinya tidak sah.
  if (checkFailed || status?.valid) {
    return children
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-neutral-border)] bg-white p-7 text-center shadow-[var(--shadow-elevated)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fbe7e6]">
          <ShieldAlert size={22} className="text-[var(--color-brand-danger)]" />
        </div>
        <h1 className="text-[17px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Lisensi Tidak Aktif</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-neutral-medium)]">
          {status?.message || 'Lisensi aplikasi ini tidak aktif atau sudah kedaluwarsa. Hubungi penyedia layanan untuk memperbarui.'}
        </p>
        {status?.expires_at && (
          <p className="mt-3 text-[11px] text-[var(--color-neutral-soft)]">Masa berlaku terakhir: {status.expires_at}</p>
        )}
      </div>
    </div>
  )
}
