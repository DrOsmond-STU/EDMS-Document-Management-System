import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Layers,
  MemoryStick,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { Button, Card, PageHeader, SectionTitle } from '../components/ui'

type MetricTone = 'ok' | 'warn' | 'danger'

const TONE: Record<MetricTone, { bg: string; text: string; bar: string }> = {
  ok: { bg: '#e3f1ea', text: '#1d6e48', bar: '#1d6e48' },
  warn: { bg: '#fdf1dc', text: '#b9791c', bar: '#b9791c' },
  danger: { bg: '#fbe7e6', text: '#b23b3a', bar: '#b23b3a' },
}

function toneFor(pct: number): MetricTone {
  if (pct >= 85) return 'danger'
  if (pct >= 70) return 'warn'
  return 'ok'
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  pct,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  pct?: number
  hint?: string
}) {
  const t = TONE[pct !== undefined ? toneFor(pct) : 'ok']
  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: t.bg, color: t.text }}>
          {icon}
        </div>
        {pct !== undefined && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: t.bg, color: t.text, borderColor: t.bg }}
          >
            {pct}%
          </span>
        )}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="text-[22px] font-bold tabular-nums text-[var(--color-neutral-dark)]">{value}</span>
        {unit && <span className="text-[12px] text-[var(--color-neutral-medium)]">{unit}</span>}
      </div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-border)]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.bar }} />
        </div>
      )}
      {hint && <div className="mt-1.5 text-[11px] text-[var(--color-neutral-medium)]">{hint}</div>}
    </Card>
  )
}

function StatusRow({ label, status, value }: { label: string; status: MetricTone; value: string }) {
  const t = TONE[status]
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-neutral-border)] py-2 last:border-b-0">
      <span className="text-[12.5px] font-medium text-[var(--color-neutral-dark)]">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.bar }} />
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: t.text }}>{value}</span>
      </span>
    </div>
  )
}

export function SysAdminPage() {
  const [maintenance, setMaintenance] = useState(false)

  return (
    <div>
      <PageHeader
        eyebrow="System Administration"
        title="System Administration"
        subtitle="Kesehatan sistem, backup, keamanan, dan konfigurasi aplikasi EDMS."
        actions={<Button variant="secondary"><RefreshCw size={14} /> Refresh</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={<Cpu size={16} />} label="CPU Load" value="42" unit="%" pct={42} hint="8 vCPU · 15m avg" />
        <MetricCard icon={<MemoryStick size={16} />} label="Memory" value="11.4" unit="/16 GB" pct={71} hint="Cache aktif 4.1 GB" />
        <MetricCard icon={<HardDrive size={16} />} label="Disk /var" value="384" unit="/500 GB" pct={76} hint="Growth 1.2 GB/hari" />
        <MetricCard icon={<Timer size={16} />} label="Uptime" value="47" unit="hari" hint="Restart terakhir: 03 Juli 2026" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle hint="MySQL 8.0 · Read replica ×2">Database</SectionTitle>
          <StatusRow label="Primary Node" status="ok" value="Healthy" />
          <StatusRow label="Replica Lag" status="ok" value="< 200 ms" />
          <StatusRow label="Query/sec (avg)" status="ok" value="2,148" />
          <StatusRow label="Slow Query (24h)" status="warn" value="14" />
          <StatusRow label="Storage" status="ok" value="118 / 300 GB" />
        </Card>
        <Card>
          <SectionTitle hint="Redis 7 · TLS enabled">Cache</SectionTitle>
          <StatusRow label="Redis Master" status="ok" value="Healthy" />
          <StatusRow label="Hit Ratio (5m)" status="ok" value="97.3%" />
          <StatusRow label="Memory Used" status="ok" value="1.4 / 4 GB" />
          <StatusRow label="Evictions (24h)" status="ok" value="0" />
          <StatusRow label="Connected Clients" status="ok" value="184" />
        </Card>
        <Card>
          <SectionTitle hint="RabbitMQ · 3 queues">Queue</SectionTitle>
          <StatusRow label="edms.notifications" status="ok" value="12 pending" />
          <StatusRow label="edms.email" status="warn" value="128 pending" />
          <StatusRow label="edms.audit-index" status="ok" value="3 pending" />
          <StatusRow label="Consumer Workers" status="ok" value="4 / 4" />
          <StatusRow label="Dead Letter Queue" status="ok" value="0" />
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            hint="Backup terjadwal harian pukul 02:00 WIB"
            action={<Button size="sm" variant="primary"><Play size={11} /> Backup Now</Button>}
          >
            Backup
          </SectionTitle>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Last Backup</div>
              <div className="mt-1 text-[15px] font-bold">2026-08-19 02:04</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Full · 42.8 GB · ✔ Success</div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Next Scheduled</div>
              <div className="mt-1 text-[15px] font-bold">2026-08-20 02:00</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Full · estimasi ~45 GB</div>
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Retention Policy</div>
            <ul className="mt-1 space-y-0.5 text-[12px]">
              <li className="flex items-center justify-between"><span>Daily</span><span className="tabular-nums text-[var(--color-neutral-medium)]">7 hari</span></li>
              <li className="flex items-center justify-between"><span>Weekly</span><span className="tabular-nums text-[var(--color-neutral-medium)]">4 minggu</span></li>
              <li className="flex items-center justify-between"><span>Monthly</span><span className="tabular-nums text-[var(--color-neutral-medium)]">12 bulan</span></li>
              <li className="flex items-center justify-between"><span>Yearly</span><span className="tabular-nums text-[var(--color-neutral-medium)]">7 tahun</span></li>
            </ul>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="Sertifikat, lisensi, dan sesi aktif">License & Security</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">SSL Certificate</span>
                <CheckCircle2 size={13} className="text-[#1d6e48]" />
              </div>
              <div className="mt-1 text-[14px] font-bold">Expires 2027-04-18</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Let's Encrypt · Auto-renew</div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">EDMS License</span>
                <AlertTriangle size={13} className="text-[#b9791c]" />
              </div>
              <div className="mt-1 text-[14px] font-bold">Expires 2026-12-31</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Enterprise · 250 users</div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">2FA Coverage</span>
                <ShieldCheck size={13} className="text-[#1d6e48]" />
              </div>
              <div className="mt-1 text-[14px] font-bold tabular-nums">92%</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-neutral-border)]">
                <div className="h-full rounded-full bg-[#1d6e48]" style={{ width: '92%' }} />
              </div>
            </div>
            <div className="rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">Active Sessions</span>
                <Activity size={13} className="text-[var(--color-brand-primary)]" />
              </div>
              <div className="mt-1 text-[14px] font-bold tabular-nums">148</div>
              <div className="text-[11px] text-[var(--color-neutral-medium)]">Rata-rata 132 / hari kerja</div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle hint="Konfigurasi environment aplikasi">System Settings</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <Server size={11} /> Environment
            </div>
            <div className="mt-1 text-[13.5px] font-bold">Production</div>
            <div className="text-[11px] text-[var(--color-neutral-medium)]">Region: ap-southeast-3 (Jakarta)</div>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <Database size={11} /> PHP / Node
            </div>
            <div className="mt-1 text-[13.5px] font-bold">PHP 8.3 · Node 22.6</div>
            <div className="text-[11px] text-[var(--color-neutral-medium)]">Laravel 11 · Vite 6</div>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <Timer size={11} /> Timezone
            </div>
            <div className="mt-1 text-[13.5px] font-bold">Asia/Jakarta (WIB)</div>
            <div className="text-[11px] text-[var(--color-neutral-medium)]">UTC+7</div>
          </div>
          <div className="rounded-md border border-[var(--color-neutral-border)] bg-white p-3">
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <Layers size={11} /> App Version
            </div>
            <div className="mt-1 text-[13.5px] font-bold">v3.4.2</div>
            <div className="text-[11px] text-[var(--color-neutral-medium)]">Build 20260812.4</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${maintenance ? 'text-[#b9791c]' : 'text-[var(--color-neutral-soft)]'}`} />
            <div>
              <div className="text-[13px] font-bold text-[var(--color-neutral-dark)]">Maintenance Mode</div>
              <p className="mt-0.5 text-[11.5px] text-[var(--color-neutral-medium)]">
                Saat aktif, sistem menampilkan halaman maintenance kepada pengguna non-admin. Gunakan saat deploy atau migrasi.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMaintenance((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
              maintenance ? 'bg-[#b9791c]' : 'bg-[var(--color-neutral-border-strong)]'
            }`}
            aria-label="Toggle maintenance mode"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${maintenance ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </Card>
    </div>
  )
}
