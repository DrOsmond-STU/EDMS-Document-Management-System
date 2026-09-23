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
// berwenang (string, atau array = cukup salah satu); modul yang belum jadi
// tidak perlu perm (toh tidak bisa diklik).
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
      { label: 'Folder Virtual & Kategori', path: '/folders', icon: FolderTree },
    ],
  },
  {
    label: 'Document Lifecycle',
    items: [
      { label: 'Papan Approval', path: '/approval-board', icon: KanbanSquare },
      { label: 'Tracking Penyusunan Dokumen', path: '/drafting', icon: GitBranch, perm: ['document.request', 'document.draft', 'document.control', 'document.ratify', 'document.review', 'document.approve', 'audit.view'] },
    ],
  },
  {
    label: 'Records Management',
    items: [
      { label: 'Records Register', path: '/records', icon: Archive, perm: 'records.view' },
      { label: 'Retention & Archive', path: '/retention', icon: Timer, perm: 'records.view' },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { label: 'Compliance Matrix', path: '/compliance-matrix', icon: ShieldCheck, perm: 'reporting.view' },
      { label: 'Legal Register', path: '/legal-register', icon: Scale, perm: 'legal.view' },
      { label: 'Register Risiko', path: '/risk-register', icon: AlertTriangle, perm: 'risk.view' },
    ],
  },
  {
    label: 'Audit & Review',
    items: [
      { label: 'Audit Internal', path: '/audit-internal', icon: ClipboardCheck, perm: 'audit_program.view' },
      { label: 'Audit Eksternal', path: '/audit-external', icon: Building2, perm: 'audit_program.view' },
      { label: 'Register Temuan & CAPA', path: '/findings', icon: ClipboardEdit, perm: 'finding.manage' },
      { label: 'Tinjauan Manajemen', path: '/management-review', icon: Presentation, perm: 'mgmt_review.view' },
    ],
  },
  {
    label: 'Search & AI',
    items: [
      { label: 'Knowledge Base & Discovery', path: '/knowledge', icon: Search },
      { label: 'Asisten AI', path: '/assistant', icon: Sparkles, perm: 'ai.use' },
    ],
  },
  {
    label: 'Collaboration',
    items: [{ label: 'Comment & Discussion', path: '/discussions', icon: MessagesSquare }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Reporting & KPI', path: '/reporting', icon: BarChart3, perm: 'reporting.view' },
      { label: 'Manajemen Pengguna & Hak Akses', path: '/users', icon: Users, perm: 'users.manage' },
      { label: 'Master Data', path: '/master-data', icon: Database, perm: 'masterdata.manage' },
      { label: 'Pengaturan Perusahaan', path: '/settings', icon: Settings, perm: 'masterdata.manage' },
      { label: 'Pengaturan Penomoran Dokumen', path: '/settings/numbering', icon: Hash, perm: 'masterdata.manage' },
      { label: 'Integration & API', path: '/integrations', icon: Plug, perm: 'masterdata.manage' },
      { label: 'System Administration', path: '/system', icon: Cog, perm: 'system.admin' },
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
