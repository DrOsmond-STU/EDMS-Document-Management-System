import { useState } from 'react'
import {
  Boxes,
  Cloud,
  Database,
  KeyRound,
  Link2,
  Mail,
  Plus,
  Settings,
  ShieldCheck,
  MessageSquare,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react'
import { Button, Card, PageHeader, SectionTitle } from '../components/ui'

type IntegrationStatus = 'connected' | 'available'

type IntegrationCard = {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  lastSync?: string
  icon: React.ReactNode
  color: string
}

const INTEGRATIONS: IntegrationCard[] = [
  { id: 'sap', name: 'SAP ERP', description: 'Sinkronisasi master data vendor, PO, dan invoice.', status: 'connected', lastSync: '2026-08-19 08:12', icon: <Database size={20} />, color: '#0a71ce' },
  { id: 'ad', name: 'Active Directory', description: 'SSO & sinkronisasi user, group, dan role dari AD/LDAP.', status: 'connected', lastSync: '2026-08-19 06:00', icon: <Users size={20} />, color: '#005a9e' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Notifikasi approval dan diskusi dokumen di channel Teams.', status: 'connected', lastSync: '2026-08-19 10:03', icon: <Boxes size={20} />, color: '#4b53bc' },
  { id: 'smtp', name: 'Email / SMTP', description: 'Pengiriman notifikasi, reminder retensi, dan digest audit.', status: 'connected', lastSync: '2026-08-19 09:45', icon: <Mail size={20} />, color: '#b23b3a' },
  { id: 'odoo', name: 'Odoo', description: 'Integrasi HR & finance untuk sinkronisasi karyawan dan cost center.', status: 'available', icon: <Database size={20} />, color: '#875a7b' },
  { id: 'slack', name: 'Slack', description: 'Notifikasi ke workspace Slack untuk tim engineering.', status: 'available', icon: <MessageSquare size={20} />, color: '#4a154b' },
  { id: 'docusign', name: 'DocuSign', description: 'e-Signature untuk approval dokumen legal & kontrak.', status: 'available', icon: <ShieldCheck size={20} />, color: '#ffcc22' },
  { id: 'gdrive', name: 'Google Drive', description: 'Import dokumen legacy dan backup arsip ke Drive.', status: 'available', icon: <Cloud size={20} />, color: '#0F9D58' },
]

type ApiKey = {
  id: string
  name: string
  key: string
  scope: string
  createdBy: string
  lastUsed: string
}

const API_KEYS: ApiKey[] = [
  { id: 'k1', name: 'Odoo Sync Bot', key: 'sk_live_edms_••••••••4a91', scope: 'documents:read, users:read', createdBy: 'Osmond Consulting', lastUsed: '2026-08-19 09:41' },
  { id: 'k2', name: 'Data Warehouse ETL', key: 'sk_live_edms_••••••••b2c8', scope: 'audit:read, reports:read', createdBy: 'IT Data Team', lastUsed: '2026-08-19 03:00' },
  { id: 'k3', name: 'Legacy Portal', key: 'sk_live_edms_••••••••7f14', scope: 'documents:read', createdBy: 'IT Infrastructure', lastUsed: '2026-07-22 14:23' },
]

type WebhookEntry = {
  id: string
  event: string
  endpoint: string
  status: 'active' | 'paused'
  lastTrigger: string
}

const WEBHOOKS: WebhookEntry[] = [
  { id: 'w1', event: 'document.approved', endpoint: 'https://ops.osmond.co.id/webhooks/edms/approved', status: 'active', lastTrigger: '2026-08-19 10:12' },
  { id: 'w2', event: 'audit.finding.created', endpoint: 'https://sap.internal/edms/finding-sync', status: 'active', lastTrigger: '2026-08-18 16:30' },
]

function StatusBadge({ s }: { s: IntegrationStatus }) {
  return s === 'connected' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#c4dfcf] bg-[#e3f1ea] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#1d6e48]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1d6e48]" /> Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-neutral-border)] bg-white px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-neutral-medium)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-neutral-soft)]" /> Available
    </span>
  )
}

export function IntegrationPage() {
  const [tab, setTab] = useState<'all' | 'connected' | 'available'>('all')

  const list = INTEGRATIONS.filter((i) => tab === 'all' || i.status === tab)
  const counts = {
    all: INTEGRATIONS.length,
    connected: INTEGRATIONS.filter((i) => i.status === 'connected').length,
    available: INTEGRATIONS.filter((i) => i.status === 'available').length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Extensibility"
        title="Integration & API"
        subtitle="Kelola integrasi dengan sistem eksternal, kunci API, dan webhook untuk otomatisasi lintas platform."
        actions={
          <Button variant="primary"><Plus size={14} /> Integrasi Baru</Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-neutral-border)] bg-white p-1">
        {([
          { k: 'all', label: 'Semua', count: counts.all },
          { k: 'connected', label: 'Connected', count: counts.connected },
          { k: 'available', label: 'Available', count: counts.available },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition ${
              tab === t.k ? 'bg-[var(--color-brand-primary)] text-white' : 'text-[var(--color-neutral-medium)] hover:bg-[var(--color-neutral-bg-soft)]'
            }`}
          >
            {t.label} <span className="ml-1 tabular-nums opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((i) => (
          <Card key={i.id} interactive>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: i.color }}>
                {i.icon}
              </div>
              <StatusBadge s={i.status} />
            </div>
            <h3 className="text-[14px] font-bold text-[var(--color-neutral-dark)]">{i.name}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-neutral-medium)]">{i.description}</p>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-neutral-border)] pt-2 text-[11px] text-[var(--color-neutral-medium)]">
              <span>{i.lastSync ? `Sync ${i.lastSync.slice(5, 16)}` : 'Belum terhubung'}</span>
              <Button size="sm" variant={i.status === 'connected' ? 'secondary' : 'outline'}>
                <Settings size={11} /> {i.status === 'connected' ? 'Configure' : 'Connect'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <SectionTitle
          hint="Digunakan oleh sistem eksternal untuk memanggil API EDMS"
          action={<Button size="sm" variant="primary"><Plus size={12} /> API Key Baru</Button>}
        >
          API Keys
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12.5px]">
            <thead className="text-left text-[10.5px] uppercase tracking-wide text-[var(--color-neutral-medium)]">
              <tr className="border-b border-[var(--color-neutral-border)]">
                <th className="py-2 pr-3 font-bold">Nama</th>
                <th className="py-2 pr-3 font-bold">Key</th>
                <th className="py-2 pr-3 font-bold">Scope</th>
                <th className="py-2 pr-3 font-bold">Owner</th>
                <th className="py-2 pr-3 font-bold">Last Used</th>
                <th className="py-2 pr-3 font-bold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-border)]">
              {API_KEYS.map((k) => (
                <tr key={k.id} className="align-middle hover:bg-[var(--color-neutral-bg-soft)]">
                  <td className="py-2 pr-3 font-semibold text-[var(--color-neutral-dark)]">
                    <div className="flex items-center gap-2">
                      <KeyRound size={13} className="text-[var(--color-brand-primary)]" />
                      {k.name}
                    </div>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11.5px] text-[var(--color-neutral-medium)]">{k.key}</td>
                  <td className="py-2 pr-3 text-[var(--color-neutral-medium)]">{k.scope}</td>
                  <td className="py-2 pr-3">{k.createdBy}</td>
                  <td className="py-2 pr-3 tabular-nums text-[var(--color-neutral-medium)]">{k.lastUsed}</td>
                  <td className="py-2 pr-3 text-right">
                    <Button size="sm" variant="danger">
                      <Trash2 size={11} /> Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle
          hint="Kirim event real-time ke endpoint eksternal"
          action={<Button size="sm" variant="primary"><Plus size={12} /> Webhook Baru</Button>}
        >
          Webhooks
        </SectionTitle>

        <ul className="divide-y divide-[var(--color-neutral-border)]">
          {WEBHOOKS.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-dark)]">
                  <Webhook size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="rounded border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                      {w.event}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                      w.status === 'active' ? 'border-[#c4dfcf] bg-[#e3f1ea] text-[#1d6e48]' : 'border-[var(--color-neutral-border)] bg-white text-[var(--color-neutral-medium)]'
                    }`}>
                      {w.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 truncate font-mono text-[11.5px] text-[var(--color-neutral-medium)]">
                    <Link2 size={11} /> {w.endpoint}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-[var(--color-neutral-soft)]">
                    Last trigger: {w.lastTrigger}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary"><Settings size={11} /> Configure</Button>
                <Button size="sm" variant="ghost"><Trash2 size={11} /></Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
