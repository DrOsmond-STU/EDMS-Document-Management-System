import { useEffect, useRef, useState } from 'react'
import { Building2, MapPin, ShieldCheck, ShieldX, Upload } from 'lucide-react'
import { Layout } from '../components/Layout'
import { LogoMark } from '../components/Logo'
import { Button, Card, Field, inputClass } from '../components/ui'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { useCompany } from '../CompanyContext'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
// Samakan dengan batas di CompanySettingController (MIN/MAX_LOGO_WIDTH).
const MIN_LOGO_WIDTH = 60
const MAX_LOGO_WIDTH = 320
const DEFAULT_LOGO_WIDTH = 160

// Nama & alamat perusahaan ditandatangani BERSAMA lisensi (lihat
// LicenseService) — supaya salinan kode+database ini tidak bisa dipasang di
// server lain lalu diganti nama perusahaannya untuk dijual ulang. Karena
// itu keduanya read-only di sini, ditampilkan berdampingan dengan info
// lisensi, bukan di form yang bisa disimpan.
function IdentityAndLicenseCard({ companyName, companyAddress }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    api('license-status').then(setStatus).catch(() => {})
  }, [])

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center gap-2">
        {status?.valid ? (
          <ShieldCheck size={16} className="text-[var(--color-brand-success-text)]" />
        ) : (
          <ShieldX size={16} className="text-[var(--color-brand-danger)]" />
        )}
        <h2 className="text-[13.5px] font-bold">Identitas Perusahaan & Lisensi</h2>
      </div>
      <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">
        Nama, alamat, dan lisensi terkunci menjadi satu — hanya bisa diperbarui bersama-sama oleh
        penyedia layanan lewat tool terpisah. Tidak ada tombol ubah di sini.
      </p>
      <dl className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <dt className="flex items-center gap-1 text-[10.5px] uppercase text-[var(--color-neutral-medium)]"><Building2 size={11} /> Nama Perusahaan</dt>
          <dd className="font-semibold">{companyName || '—'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="flex items-center gap-1 text-[10.5px] uppercase text-[var(--color-neutral-medium)]"><MapPin size={11} /> Alamat</dt>
          <dd>{companyAddress || '—'}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Status Lisensi</dt>
          <dd className={status?.valid ? 'font-semibold text-[var(--color-brand-success-text)]' : 'font-semibold text-[var(--color-brand-danger)]'}>
            {status ? (status.valid ? 'Aktif' : (status.status ?? 'Tidak aktif')) : '…'}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Kode Lisensi</dt>
          <dd className="font-mono">{status?.license_key_masked ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase text-[var(--color-neutral-medium)]">Masa Berlaku</dt>
          <dd>{status?.expires_at ?? '—'}</dd>
        </div>
      </dl>
    </Card>
  )
}

function LogoUploadField({ label, hint, previewUrl, file, onPickFile, inputRef }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
        {previewUrl ? <img src={previewUrl} alt={label} className="h-full w-full object-contain" /> : <LogoMark size={40} />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">{label}</span>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)]">
          <Upload size={13} /> Pilih Berkas
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={onPickFile} className="hidden" />
        </label>
        <p className="mt-1.5 text-[11px] text-[var(--color-neutral-medium)]">{hint}</p>
        {file && <p className="mt-0.5 truncate text-[11px] text-[var(--color-neutral-dark)]">Dipilih: {file.name}</p>}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('masterdata.manage')
  const { refresh: refreshCompany } = useCompany()

  const [settings, setSettings] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [sidebarFile, setSidebarFile] = useState(null)
  const [sidebarPreview, setSidebarPreview] = useState(null)
  const [logoWidth, setLogoWidth] = useState(DEFAULT_LOGO_WIDTH)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const sidebarFileInputRef = useRef(null)

  useEffect(() => {
    api('company-settings').then((s) => {
      setSettings(s)
      setLogoWidth(s.logo_width || DEFAULT_LOGO_WIDTH)
    })
  }, [])

  function handlePickFile(e) {
    const f = e.target.files?.[0]
    setError('')
    if (!f) { setFile(null); setPreview(null); return }
    if (f.size > MAX_LOGO_BYTES) {
      setError('Ukuran logo melebihi 2 MB.')
      e.target.value = ''
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function handlePickSidebarFile(e) {
    const f = e.target.files?.[0]
    setError('')
    if (!f) { setSidebarFile(null); setSidebarPreview(null); return }
    if (f.size > MAX_LOGO_BYTES) {
      setError('Ukuran logo sidebar melebihi 2 MB.')
      e.target.value = ''
      return
    }
    setSidebarFile(f)
    setSidebarPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('logo_width', String(logoWidth))
      if (file) form.append('logo', file)
      if (sidebarFile) form.append('sidebar_logo', sidebarFile)
      const updated = await api('company-settings', { method: 'POST', body: form, isForm: true })
      setSettings(updated)
      setLogoWidth(updated.logo_width || DEFAULT_LOGO_WIDTH)
      setFile(null)
      setPreview(null)
      setSidebarFile(null)
      setSidebarPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (sidebarFileInputRef.current) sidebarFileInputRef.current.value = ''
      setSuccess('Pengaturan logo disimpan.')
      // Sidebar & Logo (CompanyContext) dimuat terpisah dari halaman ini,
      // jadi perlu disegarkan agar logo baru langsung terlihat tanpa reload.
      refreshCompany()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors?.logo?.[0] || err.body?.errors?.sidebar_logo?.[0] || err.message) : 'Gagal menyimpan.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang mengakses Pengaturan Perusahaan. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">Pengaturan Perusahaan</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            Identitas perusahaan tampil di halaman login dan seluruh aplikasi.
          </p>
        </div>

        <IdentityAndLicenseCard companyName={settings?.name} companyAddress={settings?.address} />

        <Card>
          {!settings ? (
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <LogoUploadField
                  label="Logo Halaman Login"
                  hint="PNG, JPG, SVG, atau WEBP · maks. 2 MB"
                  previewUrl={preview || settings.logo_url}
                  file={file}
                  onPickFile={handlePickFile}
                  inputRef={fileInputRef}
                />
              </div>

              <div className="border-t border-[var(--color-neutral-border)] pt-4">
                <LogoUploadField
                  label="Logo Sidebar"
                  hint="Berkas terpisah dari logo login — biasanya bentuk ikon/kotak. PNG, JPG, SVG, atau WEBP · maks. 2 MB"
                  previewUrl={sidebarPreview || settings.sidebar_logo_url}
                  file={sidebarFile}
                  onPickFile={handlePickSidebarFile}
                  inputRef={sidebarFileInputRef}
                />
              </div>

              <Field
                label={`Ukuran Logo di Halaman Login (${logoWidth}px)`}
                hint="Logo tampil di tengah, di atas form login. Geser untuk memperbesar/memperkecil."
              >
                <input
                  type="range"
                  min={MIN_LOGO_WIDTH}
                  max={MAX_LOGO_WIDTH}
                  step={10}
                  value={logoWidth}
                  onChange={(e) => setLogoWidth(Number(e.target.value))}
                  className="w-full accent-[var(--color-brand-primary)]"
                />
              </Field>

              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-4 py-6">
                {preview || settings.logo_url ? (
                  <img src={preview || settings.logo_url} alt="Pratinjau logo" style={{ width: logoWidth, height: 'auto', maxWidth: '100%' }} className="object-contain" />
                ) : (
                  <LogoMark size={Math.round(logoWidth / 3)} />
                )}
                <p className="mt-2 text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">Pratinjau halaman login</p>
              </div>

              {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
              {success && <div className="rounded-md border border-[var(--color-brand-success-text)]/30 bg-[var(--color-brand-success-bg)] px-3 py-2 text-[12px] text-[var(--color-brand-success-text)]">{success}</div>}

              <div className="flex justify-end">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Simpan Logo'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  )
}
