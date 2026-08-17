// Mirrors the information architecture in docs/03_DESIGN.md Section 2.
// `roadmap: true` items are not implemented in this build — they route to a
// short explainer instead of a dead link, matching the docs' own guidance to
// keep the full IA visible rather than hiding scope.

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
      { label: 'Folder Virtual & Kategori', path: '/roadmap/folders', icon: FolderTree, roadmap: true },
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
      { label: 'Records Register', path: '/roadmap/records', icon: Archive, roadmap: true },
      { label: 'Retention & Archive', path: '/roadmap/retention', icon: Timer, roadmap: true },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { label: 'Compliance Matrix', path: '/roadmap/compliance-matrix', icon: ShieldCheck, roadmap: true },
      { label: 'Legal Register', path: '/roadmap/legal-register', icon: Scale, roadmap: true },
      { label: 'Register Risiko', path: '/roadmap/risk-register', icon: AlertTriangle, roadmap: true },
    ],
  },
  {
    label: 'Search & AI',
    items: [
      { label: 'Knowledge Base & Discovery', path: '/roadmap/knowledge-discovery', icon: Search, roadmap: true },
      { label: 'Asisten AI', path: '/roadmap/ai-assistant', icon: Sparkles, roadmap: true },
    ],
  },
  {
    label: 'Collaboration',
    items: [{ label: 'Comment & Discussion', path: '/roadmap/collaboration', icon: MessagesSquare, roadmap: true }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Reporting & KPI', path: '/reporting', icon: BarChart3 },
      { label: 'Manajemen Pengguna & Hak Akses', path: '/users', icon: Users },
      { label: 'Master Data', path: '/master-data', icon: Database },
      { label: 'Integration & API', path: '/roadmap/integration', icon: Plug, roadmap: true },
      { label: 'System Administration', path: '/roadmap/sysadmin', icon: Cog, roadmap: true },
      { label: 'Audit Trail', path: '/audit-trail', icon: ClipboardList },
    ],
  },
]
