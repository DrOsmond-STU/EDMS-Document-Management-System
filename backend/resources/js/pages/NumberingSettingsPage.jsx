import { useEffect, useState } from 'react'
import { Hash } from 'lucide-react'
import { Layout } from '../components/Layout'
import { Button, Card, Field, inputClass } from '../components/ui'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'

const TOKEN_HINTS = {
  '{type}': 'kode singkat jenis dokumen (mis. SOP, KBJ)',
  '{function}': 'id fungsi/departemen, huruf besar (mis. QA)',
  '{year}': 'tahun 4 digit (mis. 2026)',
  '{yy}': 'tahun 2 digit (mis. 26)',
  '{seq}': 'nomor urut — WAJIB token terakhir dalam formula',
}

export default function NumberingSettingsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('masterdata.manage')

  const [settings, setSettings] = useState(null)
  const [format, setFormat] = useState('')
  const [seqPadding, setSeqPadding] = useState(3)
  const [typeCodes, setTypeCodes] = useState({})
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!canManage) return
    api('numbering-settings').then((s) => {
      setSettings(s)
      setFormat(s.format)
      setSeqPadding(s.seq_padding)
      setTypeCodes(s.type_codes)
    }).catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat pengaturan.'))
  }, [canManage])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setSuccess('')
    setSubmitting(true)
    try {
      const updated = await api('numbering-settings', {
        method: 'POST',
        body: { format, seq_padding: Number(seqPadding), type_codes: typeCodes },
      })
      setSettings(updated)
      setFormat(updated.format)
      setSeqPadding(updated.seq_padding)
      setTypeCodes(updated.type_codes)
      setSuccess('Formula penomoran disimpan. Dokumen baru akan memakai formula ini.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(err.body?.errors || {})
        setError(err.body?.message || 'Formula tidak valid.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Gagal menyimpan pengaturan.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang mengakses Pengaturan Penomoran Dokumen. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
            <Hash size={18} /> Pengaturan Penomoran Dokumen
          </h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
            Tentukan sendiri formula nomor dokumen (mis. SOP-QA-001). Perubahan hanya berlaku untuk
            dokumen yang dibuat SETELAH disimpan — kode dokumen yang sudah ada tidak berubah.
          </p>
        </div>

        {!settings ? (
          <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Card>
              <Field label="Formula Penomoran" hint="Token yang didukung ditulis dalam kurung kurawal, mis. {type}-{function}-{seq}">
                <input
                  className={`${inputClass} font-mono`}
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  required
                />
                {fieldErrors.format && (
                  <p className="mt-1 text-[11.5px] text-[var(--color-brand-danger)]">{fieldErrors.format[0]}</p>
                )}
              </Field>

              <div className="mt-3 rounded-lg border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Token Tersedia</p>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-2">
                  {(settings.allowed_tokens || Object.keys(TOKEN_HINTS)).map((token) => (
                    <div key={token} className="flex gap-1.5">
                      <dt className="shrink-0 font-mono font-semibold text-[var(--color-neutral-dark)]">{token}</dt>
                      <dd className="text-[var(--color-neutral-medium)]">{TOKEN_HINTS[token]}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Digit Nomor Urut" hint="Mis. 3 → 001, 4 → 0001">
                  <input
                    type="number" min={1} max={8}
                    className={inputClass}
                    value={seqPadding}
                    onChange={(e) => setSeqPadding(e.target.value)}
                    required
                  />
                  {fieldErrors.seq_padding && (
                    <p className="mt-1 text-[11.5px] text-[var(--color-brand-danger)]">{fieldErrors.seq_padding[0]}</p>
                  )}
                </Field>
                <Field label="Contoh Hasil" hint="Pratinjau otomatis dari server">
                  <div className={`${inputClass} flex items-center bg-[var(--color-neutral-bg-soft)] font-mono font-semibold`}>
                    {settings.preview}
                  </div>
                </Field>
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 text-[13.5px] font-bold">Kode Jenis Dokumen ({'{type}'})</h2>
              <p className="mb-3 text-[11.5px] text-[var(--color-neutral-medium)]">
                Kode singkat untuk tiap jenis dokumen, dipakai saat token {'{type}'} muncul di formula.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(settings.known_types || []).map((type) => (
                  <Field key={type} label={type}>
                    <input
                      className={`${inputClass} font-mono uppercase`}
                      value={typeCodes[type] ?? ''}
                      onChange={(e) => setTypeCodes((prev) => ({ ...prev, [type]: e.target.value.toUpperCase() }))}
                      maxLength={10}
                      required
                    />
                  </Field>
                ))}
              </div>
              {fieldErrors['type_codes'] && (
                <p className="mt-2 text-[11.5px] text-[var(--color-brand-danger)]">{fieldErrors['type_codes'][0]}</p>
              )}
            </Card>

            {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
            {success && <div className="rounded-md border border-[var(--color-brand-success-text)]/30 bg-[var(--color-brand-success-bg)] px-3 py-2 text-[12px] text-[var(--color-brand-success-text)]">{success}</div>}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Menyimpan…' : 'Simpan Formula'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  )
}
