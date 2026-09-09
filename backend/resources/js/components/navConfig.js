import {
  LayoutDashboard, FolderOpen, FolderTree, KanbanSquare, GitBranch, Archive, Timer,
  ShieldCheck, Scale, AlertTriangle, Search, Sparkles, MessagesSquare, BarChart3,
  Users, Database, Plug, Cog, ClipboardList, ClipboardCheck, ClipboardEdit, Building2,
  Presentation, Settings, Hash,
} from 'lucide-react'

// Peta lengkap arsitektur informasi aplikasi (lihat docs/03_DESIGN.md).
// `path: null` berarti modul belum dibangun di v2 — ditampilkan supaya
// pengguna melihat peta lengkap yang direncanakan, tapi non-aktif dengan
// label "Segera". `perm` membatasi modul yang SUDAH jadi ke peran yang
// berwenang; modul yang belum jadi tidak perlu perm (toh tidak bisa diklik).
// Dipakai bersama oleh Sidebar (navigasi) dan Topbar (breadcrumb bagian aktif).
export const NAV_GROUPS = [
  {
    label: 'Analytics',
    items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }],
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
      { label: 'Papan Approval', path: '/approval-board', icon: KanbanSquare },
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
      { label: 'Manajemen Pengguna & Hak Akses', path: '/users', icon: Users, perm: 'users.manage' },
      { label: 'Master Data', path: null, icon: Database },
      { label: 'Pengaturan Perusahaan', path: '/settings', icon: Settings, perm: 'masterdata.manage' },
      { label: 'Pengaturan Penomoran Dokumen', path: '/settings/numbering', icon: Hash, perm: 'masterdata.manage' },
      { label: 'Integration & API', path: '/integrations', icon: Plug, perm: 'masterdata.manage' },
      { label: 'System Administration', path: null, icon: Cog },
      { label: 'Audit Trail', path: '/audit-trail', icon: ClipboardList, perm: 'audit.view' },
    ],
  },
]

/**
 * Cari grup+label item aktif dari pathname saat ini, untuk breadcrumb Topbar.
 * Dicari kecocokan PALING SPESIFIK (path terpanjang), bukan yang pertama
 * ditemukan — supaya mis. "/settings/numbering" tidak salah tertangkap
 * oleh entri "/settings" hanya karena urutannya lebih dulu di navConfig.
 */
export function findCurrentSection(pathname) {
  let best = null
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (!it.path) continue
      const match = pathname === it.path || pathname.startsWith(it.path + '/')
      if (match && (!best || it.path.length > best.path.length)) {
        best = { group: g.label, label: it.label, path: it.path }
      }
    }
  }
  return best ? { group: best.group, label: best.label } : {}
}
