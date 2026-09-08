import { useEffect, useState } from 'react'
import { Cable, Mail, PlugZap, ShieldCheck, Users } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api, ApiError } from '../api'
import { useAuth } from '../AuthContext'
import { BasePill, Button, Card, Field, inputClass } from '../components/ui'

const ICONS = { smtp: Mail, ldap: Users, docusign: ShieldCheck, google_drive: Cable }

const STATUS_STYLE = {
  connected: { bg: '#E5F5EC', text: '#1E8E5A', label: 'Terhubung' },
  failed: { bg: '#FBE7E6', text: '#B23B3A', label: 'Gagal Terakhir Diuji' },
  not_tested: { bg: '#EEF2F7', text: '#475569', label: 'Belum Diuji' },
}

function formatTimestamp(iso) {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}

function IntegrationCard({ integration, currentUserEmail, onSaved }) {
  const Icon = ICONS[integration.type] ?? PlugZap
  const [config, setConfig] = useState(integration.config)
  const [secrets, setSecrets] = useState({})
  const [enabled, setEnabled] = useState(integration.enabled)
  const [recipient, setRecipient] = useState(currentUserEmail)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setConfig(integration.config)
    setEnabled(integration.enabled)
  }, [integration])

  const configFields = integration.fields.filter((f) => !f.secret)
  const secretFields = integration.fields.filter((f) => f.secret)
  const status = STATUS_STYLE[integration.status] ?? STATUS_STYLE.not_tested

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await api(`integrations/${integration.type}`, {
        method: 'PATCH',
        body: { config, secrets, enabled },
      })
      onSaved(result)
      setSecrets({})
      setSuccess('Pengaturan disimpan.')
    } catch (err) {
      setError(err instanceof ApiError ? (err.body?.message || JSON.stringify(err.body?.errors)) : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setError('')
    setSuccess('')
    try {
      const result = await api(`integrations/${integration.type}/test`, {
        method: 'POST',
        body: integration.type === 'smtp' ? { recipient } : {},
      })
      onSaved(result)
      setSuccess(result.last_test_message || 'Uji koneksi berhasil.')
    } catch (err) {
      // Hasil gagal (status + last_test_message) sudah ditampilkan di badge
      // status kartu lewat onSaved() — tidak perlu banner error terpisah
      // yang isinya cuma mengulang pesan yang sama.
      if (err instanceof ApiError && err.body?.integration) {
        onSaved(err.body.integration)
      } else if (err instanceof ApiError && err.body?.last_test_message) {
        onSaved(err.body)
      } else {
        setError(err instanceof ApiError ? err.message : 'Uji koneksi gagal.')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-chip-bg)] text-[var(--color-chip-text)]">
            <Icon size={16} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold">{integration.label}</h2>
            <p className="text-[11.5px] text-[var(--color-neutral-medium)]">{integration.description}</p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-neutral-medium)]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Aktif
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BasePill bg={status.bg} text={status.text}>{status.label}</BasePill>
        {integration.last_tested_at && (
          <span className="text-[11px] text-[var(--color-neutral-medium)]">Diuji {formatTimestamp(integration.last_tested_at)}</span>
        )}
      </div>
      {integration.last_test_message && (
        <p className="mt-1.5 text-[11.5px] text-[var(--color-neutral-medium)]">{integration.last_test_message}</p>
      )}

      <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3 border-t border-[var(--color-neutral-border)] pt-4">
        {configFields.map((f) => (
          <Field key={f.key} label={f.label}>
            {f.input === 'select' ? (
              <select
                className={inputClass}
                value={config[f.key] ?? f.default ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              >
                {f.options.map((o) => <option key={o} value={o}>{o === 'none' ? 'Tidak ada / STARTTLS otomatis' : o.toUpperCase()}</option>)}
              </select>
            ) : (
              <input
                type={f.input === 'email' ? 'email' : f.input === 'number' ? 'number' : 'text'}
                className={inputClass}
                value={config[f.key] ?? ''}
                placeholder={f.default != null ? String(f.default) : ''}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              />
            )}
          </Field>
        ))}
        {secretFields.map((f) => (
          <Field key={f.key} label={f.label} hint={integration.secrets_present[f.key] ? 'Tersimpan — isi untuk mengganti.' : undefined}>
            <input
              type="password"
              className={inputClass}
              value={secrets[f.key] ?? ''}
              placeholder={integration.secrets_present[f.key] ? '•••••••• (tersimpan)' : ''}
              onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
              autoComplete="new-password"
            />
          </Field>
        ))}

        {integration.type === 'smtp' && (
          <Field label="Kirim Email Uji Ke">
            <input type="email" className={inputClass} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </Field>
        )}

        {error && <div className="rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
        {success && <div className="rounded-md border border-[var(--color-brand-success-text)]/30 bg-[var(--color-brand-success-bg)] px-3 py-2 text-[12px] text-[var(--color-brand-success-text)]">{success}</div>}

        <div className="flex justify-end gap-2">
          {integration.test_supported ? (
            <Button type="button" variant="secondary" size="sm" disabled={testing} onClick={handleTest}>
              {testing ? 'Menguji…' : 'Uji Koneksi'}
            </Button>
          ) : (
            <span className="self-center text-[11px] italic text-[var(--color-neutral-soft)]">Uji koneksi memerlukan alur OAuth2 (belum diimplementasikan)</span>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

export default function IntegrationsPage() {
  const { user, hasPermission } = useAuth()
  const canManage = hasPermission('masterdata.manage')

  const [integrations, setIntegrations] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canManage) return
    api('integrations')
      .then((r) => setIntegrations(r.integrations))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat integrasi.'))
  }, [canManage])

  function handleSaved(updated) {
    setIntegrations((prev) => prev.map((i) => (i.type === updated.type ? updated : i)))
  }

  if (!canManage) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">
          Anda tidak berwenang mengelola integrasi. Hubungi System Administrator.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]">
          <PlugZap size={18} /> Integration &amp; API
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[var(--color-neutral-medium)]">
          Hubungkan EDMS dengan sistem eksternal. Kredensial disimpan terenkripsi dan tidak pernah ditampilkan ulang.
        </p>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}

      {!integrations ? (
        <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.type} integration={integration} currentUserEmail={user?.email ?? ''} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </Layout>
  )
}
