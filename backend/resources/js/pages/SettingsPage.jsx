import { useEffect, useRef, useState } from 'react'
import { Building2, Upload } from 'lucide-react'
import { Layout } from '../components/Layout'
import { LogoMark } from '../components/Logo'
import { Button, Card, Field, inputClass } from '../components/ui'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { useCompany } from '../CompanyContext'

const MAX_LOGO_BYTES = 2 * 1024 * 1024

export default function SettingsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('masterdata.manage')
  const { refresh: refreshCompany } = useCompany()

  const [settings, setSettings] = useState(null)
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api('company-settings').then((s) => {
      setSettings(s)
      setName(s.name)
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('name', name)
      if (file) form.append('logo', file)
      const updated = await api('company-settings', { method: 'POST', body: form, isForm: true })
      setSettings(updated)
      setFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess('Pengaturan perusahaan disimpan.')
      // Sidebar & Logo (CompanyContext) dimuat terpisah dari halaman ini,
      // jadi perlu disegarkan agar logo/nama baru langsung terlihat tanpa reload.
      refreshCompany()
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.errors?.logo?.[0] || err.body?.errors?.name?.[0] || err.message) : 'Gagal menyimpan.')
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
            Nama dan logo di sini tampil di halaman login dan seluruh aplikasi.
          </p>
        </div>

        <Card>
          {!settings ? (
            <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)]">
                  {preview ? (
                    <img src={preview} alt="Pratinjau logo" className="h-full w-full object-contain" />
                  ) : settings.logo_url ? (
                    <img src={settings.logo_url} alt="Logo perusahaan" className="h-full w-full object-contain" />
                  ) : (
                    <LogoMark size={40} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--color-neutral-border)] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[var(--color-neutral-dark)] hover:bg-[var(--color-neutral-bg-soft)]">
                    <Upload size={13} /> Pilih Berkas Logo
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handlePickFile} className="hidden" />
                  </label>
                  <p className="mt-1.5 text-[11px] text-[var(--color-neutral-medium)]">PNG, JPG, SVG, atau WEBP · maks. 2 MB</p>
                  {file && <p className="mt-0.5 truncate text-[11px] text-[var(--color-neutral-dark)]">Dipilih: {file.name}</p>}
                </div>
              </div>

              <Field label="Nama Perusahaan">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="shrink-0 text-[var(--color-neutral-medium)]" />
                  <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
                </div>
              </Field>

              {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
              {success && <div className="rounded-md border border-[var(--color-brand-success-text)]/30 bg-[var(--color-brand-success-bg)] px-3 py-2 text-[12px] text-[var(--color-brand-success-text)]">{success}</div>}

              <div className="flex justify-end">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? 'Menyimpan…' : 'Simpan Pengaturan'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </Layout>
  )
}
