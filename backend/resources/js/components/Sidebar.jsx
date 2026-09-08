import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, FolderTree, KanbanSquare, GitBranch, Archive, Timer,
  ShieldCheck, Scale, AlertTriangle, Search, Sparkles, MessagesSquare, BarChart3,
  Users, Database, Plug, Cog, ClipboardList, ClipboardCheck, ClipboardEdit, Building2,
  Presentation, Settings, LogOut,
} from 'lucide-react'
import { useAuth } from '../AuthContext'
import { useCompany } from '../CompanyContext'
import { LogoMark } from './Logo'

// Peta lengkap arsitektur informasi aplikasi (lihat docs/03_DESIGN.md).
// `path: null` berarti modul belum dibangun di v2 — ditampilkan supaya
// pengguna melihat peta lengkap yang direncanakan, tapi non-aktif dengan
// label "Segera". `perm` membatasi modul yang SUDAH jadi ke peran yang
// berwenang; modul yang belum jadi tidak perlu perm (toh tidak bisa diklik).
const NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [{ label: 'Dashboard', path: null, icon: LayoutDashboard }],
  },
  {
    label: 'Document Repository',
    items: [
      { label: 'Register Dokumen', path: '/documents', icon: FolderOpen },
      { label: 'Folder Virtual & Kategori', path: null, icon: FolderTree },
    ],
  },
  {
    label: 'Document Lifecycle',
    items: [
      { label: 'Papan Approval', path: null, icon: KanbanSquare },
      { label: 'Tracking Penyusunan Dokumen', path: null, icon: GitBranch },
    ],
  },
  {
    label: 'Records Management',
    items: [
      { label: 'Records Register', path: null, icon: Archive },
      { label: 'Retention & Archive', path: null, icon: Timer },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { label: 'Compliance Matrix', path: null, icon: ShieldCheck },
      { label: 'Legal Register', path: null, icon: Scale },
      { label: 'Register Risiko', path: null, icon: AlertTriangle },
    ],
  },
  {
    label: 'Audit & Review',
    items: [
      { label: 'Audit Internal', path: null, icon: ClipboardCheck },
      { label: 'Audit Eksternal', path: null, icon: Building2 },
      { label: 'Register Temuan & CAPA', path: null, icon: ClipboardEdit },
      { label: 'Tinjauan Manajemen', path: null, icon: Presentation },
    ],
  },
  {
    label: 'Search & AI',
    items: [
      { label: 'Knowledge Base & Discovery', path: null, icon: Search },
      { label: 'Asisten AI', path: null, icon: Sparkles },
    ],
  },
  {
    label: 'Collaboration',
    items: [{ label: 'Comment & Discussion', path: null, icon: MessagesSquare }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Reporting & KPI', path: null, icon: BarChart3 },
      { label: 'Manajemen Pengguna & Hak Akses', path: null, icon: Users },
      { label: 'Master Data', path: null, icon: Database },
      { label: 'Pengaturan Perusahaan', path: '/settings', icon: Settings, perm: 'masterdata.manage' },
      { label: 'Integration & API', path: null, icon: Plug },
      { label: 'System Administration', path: null, icon: Cog },
      { label: 'Audit Trail', path: null, icon: ClipboardList },
    ],
  },
]

export function Sidebar() {
  const { user, hasPermission, logout } = useAuth()
  const { name, logo_url: logoUrl } = useCompany()

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[#0b1f3a] md:flex">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-8 max-w-[10.5rem] object-contain" />
        ) : (
          <>
            <LogoMark size={30} />
            <div className="min-w-0">
              <div className="text-[14px] font-bold leading-tight tracking-tight text-white">DoGO</div>
              <div className="text-[9px] font-medium uppercase tracking-[0.1em] text-white/50">Document Governance</div>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/35">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                const allowed = !item.perm || hasPermission(item.perm)
                const enabled = Boolean(item.path) && allowed

                if (!enabled) {
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 rounded-md border-l-2 border-transparent px-2.5 py-1.5 text-[13px] text-white/35"
                      title={item.path ? 'Anda tidak berwenang mengakses ini' : 'Modul ini sedang dikembangkan'}
                    >
                      <Icon size={15} strokeWidth={1.75} className="text-white/35" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.path ? null : (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">
                          Segera
                        </span>
                      )}
                    </div>
                  )
                }

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-1.5 text-[13px] transition-colors ${
                        isActive
                          ? 'border-[var(--color-brand-primary)] bg-white/10 font-semibold text-white'
                          : 'border-transparent text-white/70 hover:border-white/20 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={15} strokeWidth={isActive ? 2.25 : 1.75} className={isActive ? 'text-[var(--color-brand-primary)]' : 'text-white/70 group-hover:text-white'} />
                        <span className="flex-1 truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-1 truncate px-2 text-[12px] font-semibold text-white">{user?.name}</div>
        <div className="mb-2 truncate px-2 text-[10.5px] text-white/50">{user?.roles?.join(', ')}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Keluar
        </button>
      </div>
    </aside>
  )
}
