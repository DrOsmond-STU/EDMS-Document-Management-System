// Mirrors the information architecture in docs/03_DESIGN.md Section 2.
// All items are implemented modules. Use `roadmap: true` for placeholder items only.

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  FolderOpen,
  FolderTree,
  KanbanSquare,
  GitBranch,
  Archive,
  Timer,
  ShieldCheck,
  Scale,
  AlertTriangle,
  Search,
  Sparkles,
  MessagesSquare,
  BarChart3,
  Users,
  Database,
  Plug,
  Cog,
  ClipboardList,
  ClipboardCheck,
  ClipboardEdit,
  Building2,
  Presentation,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roadmap?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
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
      { label: 'Tracking Penyusunan Dokumen', path: '/tracking', icon: GitBranch },
    ],
  },
  {
    label: 'Records Management',
    items: [
      { label: 'Records Register', path: '/records', icon: Archive },
      { label: 'Retention & Archive', path: '/retention', icon: Timer },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { label: 'Compliance Matrix', path: '/compliance-matrix', icon: ShieldCheck },
      { label: 'Legal Register', path: '/legal-register', icon: Scale },
      { label: 'Register Risiko', path: '/risk-register', icon: AlertTriangle },
    ],
  },
  {
    label: 'Audit & Review',
    items: [
      { label: 'Audit Internal', path: '/internal-audit', icon: ClipboardCheck },
      { label: 'Audit Eksternal', path: '/external-audit', icon: Building2 },
      { label: 'Register Temuan & CAPA', path: '/findings', icon: ClipboardEdit },
      { label: 'Tinjauan Manajemen', path: '/management-review', icon: Presentation },
    ],
  },
  {
    label: 'Search & AI',
    items: [
      { label: 'Knowledge Base & Discovery', path: '/knowledge-discovery', icon: Search },
      { label: 'Asisten AI', path: '/ai-assistant', icon: Sparkles },
    ],
  },
  {
    label: 'Collaboration',
    items: [{ label: 'Comment & Discussion', path: '/collaboration', icon: MessagesSquare }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Reporting & KPI', path: '/reporting', icon: BarChart3 },
      { label: 'Manajemen Pengguna & Hak Akses', path: '/users', icon: Users },
      { label: 'Master Data', path: '/master-data', icon: Database },
      { label: 'Integration & API', path: '/integration', icon: Plug },
      { label: 'System Administration', path: '/sysadmin', icon: Cog },
      { label: 'Audit Trail', path: '/audit-trail', icon: ClipboardList },
    ],
  },
]
