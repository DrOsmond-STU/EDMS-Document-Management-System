import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Cog, Database, HardDrive, RefreshCw, Server, ShieldCheck, XCircle } from 'lucide-react'
import { Layout } from '../components/Layout'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Button, Card } from '../components/ui'

const CHECK = {
  ok: { icon: CheckCircle2, color: '#1d6e48', bg: '#e3f1ea', label: 'OK' },
  warn: { icon: AlertTriangle, color: '#9a6412', bg: '#fdf1dc', label: 'Perhatian' },
  bad: { icon: XCircle, color: '#b23b3a', bg: '#fbe7e6', label: 'Kritis' },
}

function bytes(n) {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toLocaleString('id-ID', { maximumFractionDigits: 1 })} ${u[i]}`
}

function Row({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--color-neutral-border)] py-1.5 text-[12.5px] last:border-0">
      <span className="text-[var(--color-neutral-medium)]">{label}</span>
      <span className={`text-right font-semibold text-[var(--color-neutral-dark)] ${mono ? 'font-mono text-[12px]' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

export default function SystemAdminPage() {
  const { hasPermission } = useAuth()
  const canView = hasPermission('system.admin')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!canView) return
    api('system/info').then(setData).catch((err) => setError(err?.message || 'Gagal memuat info sistem.'))
  }, [canView])
  useEffect(() => { load() }, [load])

  async function clearCache() {
    setBusy(true); setMsg(''); setError('')
    try {
      await api('system/cache-clear', { method: 'POST' })
      setMsg('Cache aplikasi & view dibersihkan.')
    } catch (err) {
      setError(err?.message || 'Gagal membersihkan cache.')
    } finally {
      setBusy(false)
    }
  }

  if (!canView) return <Layout><div className="mx-auto max-w-lg text-[13px] text-[var(--color-neutral-medium)]">Hanya System Administrator yang boleh membuka panel ini.</div></Layout>

  const r = data?.runtime
  const problems = data ? data.checks.filter((c) => c.status !== 'ok').length : 0

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-brand-primary)]">Operasional</div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[var(--color-neutral-dark)]"><Cog size={18} /> System Administration</h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-[var(--color-neutral-medium)]">
            Kesehatan & konfigurasi server aplikasi. Panel ini hanya membaca konfigurasi — nilai rahasia (kunci aplikasi, password database/SMTP) tidak pernah ditampilkan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /> Muat Ulang</Button>
          <Button variant="secondary" onClick={clearCache} disabled={busy}>{busy ? 'Membersihkan…' : 'Bersihkan Cache'}</Button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-[#f3c9c8] bg-[#fbe7e6] px-3 py-2 text-[12px] text-[#7d2c2b]">{error}</div>}
      {msg && <div className="mb-4 rounded-md border border-[#bfe0cc] bg-[#e3f1ea] px-3 py-2 text-[12px] text-[#1d6e48]">{msg}</div>}

      {!data ? <p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[13.5px] font-bold"><ShieldCheck size={15} /> Pemeriksaan Keamanan & Konfigurasi</h2>
              <span className="text-[12px] font-semibold" style={{ color: problems ? '#9a6412' : '#1d6e48' }}>
                {problems ? `${problems} perlu perhatian` : 'Semua lolos'}
              </span>
            </div>
            <ul className="space-y-2">
              {data.checks.map((c) => {
                const s = CHECK[c.status] ?? CHECK.warn
                const Icon = s.icon
                return (
                  <li key={c.key} className="flex items-start gap-3 rounded-md border border-[var(--color-neutral-border)] px-3 py-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: s.bg, color: s.color }}><Icon size={14} strokeWidth={2.5} /></span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">
                        {c.label}
                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                      </div>
                      <div className="text-[11.5px] text-[var(--color-neutral-medium)]">{c.detail}</div>
                      {c.key === 'default_passwords' && c.status !== 'ok' && (
                        <Link to="/users" className="text-[11.5px] font-semibold text-[var(--color-brand-primary)] hover:underline">Buka Manajemen Pengguna</Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold"><Server size={15} /> Runtime</h2>
            <Row label="Lingkungan" value={r.environment} />
            <Row label="Versi aplikasi (commit)" value={r.commit} mono />
            <Row label="PHP" value={r.php} mono />
            <Row label="Laravel" value={r.laravel} mono />
            <Row label="Database" value={`${r.db_driver}${r.db_version ? ` ${r.db_version}` : ''}`} mono />
            <Row label="Zona waktu" value={r.timezone} />
            <Row label="Waktu server" value={r.server_time} mono />
            <Row label="Cache / Sesi / Antrean" value={`${r.cache_store} / ${r.session_driver} / ${r.queue}`} mono />
            <Row label="Pengirim email" value={r.mailer} mono />
            <Row label="Config & route di-cache" value={`${r.config_cached ? 'ya' : 'tidak'} / ${r.routes_cached ? 'ya' : 'tidak'}`} />
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold"><HardDrive size={15} /> Penyimpanan</h2>
            <Row label="Berkas di penyimpanan dokumen" value={data.storage.documents_files.toLocaleString('id-ID')} />
            <Row label="Ukuran penyimpanan dokumen" value={bytes(data.storage.documents_bytes)} />
            <Row label="Berkas dokumen terdaftar" value={data.storage.registered_files.toLocaleString('id-ID')} />
            <Row label="Ukuran log aplikasi" value={bytes(data.storage.log_bytes)} />
            <p className="mt-2 text-[11px] text-[var(--color-neutral-medium)]">Penyimpanan dokumen juga memuat lampiran proyek penyusunan (PDF final, bukti notulen, foto), jadi jumlah berkasnya bisa lebih besar dari berkas dokumen terdaftar.</p>
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold"><Database size={15} /> Volume Data</h2>
            {data.volumes.map((v) => <Row key={v.label} label={v.label} value={v.value.toLocaleString('id-ID')} />)}
          </Card>

          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[13.5px] font-bold"><AlertTriangle size={15} /> Error Server Terbaru</h2>
            {data.errors.length === 0 ? <p className="py-4 text-center text-[12.5px] text-[var(--color-neutral-medium)]">Tidak ada error tercatat.</p> : (
              <ul className="space-y-1.5">
                {data.errors.map((e, i) => (
                  <li key={i} className="rounded-md border border-[var(--color-neutral-border)] px-2.5 py-1.5">
                    <div className="flex justify-between text-[10.5px]"><span className="font-bold text-[#b23b3a]">{e.level}</span><span className="font-mono text-[var(--color-neutral-medium)]">{e.time}</span></div>
                    <div className="mt-0.5 break-words font-mono text-[11px] text-[var(--color-neutral-dark)]">{e.message}</div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-[var(--color-neutral-medium)]">Hanya judul error yang ditampilkan (tanpa jejak kode) — detail lengkap ada di log server.</p>
          </Card>
        </div>
      )}
    </Layout>
  )
}
