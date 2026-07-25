// Mirrors the information architecture in docs/03_DESIGN.md Section 2.
// `roadmap: true` items are not implemented in this build — they route to a
// short explainer instead of a dead link, matching the docs' own guidance to
// keep the full IA visible rather than hiding scope.

export interface NavItem {
  label: string
  path: string
  roadmap?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analytics',
    items: [{ label: 'Dashboard', path: '/' }],
  },
  {
    label: 'Document Repository',
    items: [
      { label: 'Register Dokumen', path: '/documents' },
      { label: 'Folder Virtual & Kategori', path: '/roadmap/folders', roadmap: true },
    ],
  },
  {
    label: 'Document Lifecycle',
    items: [
      { label: 'Papan Approval', path: '/approval-board' },
      { label: 'Tracking Penyusunan Dokumen', path: '/tracking' },
    ],
  },
  {
    label: 'Records Management',
    items: [
      { label: 'Records Register', path: '/roadmap/records', roadmap: true },
      { label: 'Retention & Archive', path: '/roadmap/retention', roadmap: true },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { label: 'Compliance Matrix', path: '/roadmap/compliance-matrix', roadmap: true },
      { label: 'Legal Register', path: '/roadmap/legal-register', roadmap: true },
      { label: 'Register Risiko', path: '/roadmap/risk-register', roadmap: true },
    ],
  },
  {
    label: 'Search & AI',
    items: [
      { label: 'Knowledge Base & Discovery', path: '/roadmap/knowledge-discovery', roadmap: true },
      { label: 'Asisten AI', path: '/roadmap/ai-assistant', roadmap: true },
    ],
  },
  {
    label: 'Collaboration',
    items: [{ label: 'Comment & Discussion', path: '/roadmap/collaboration', roadmap: true }],
  },
  {
    label: 'Operasional',
    items: [
      { label: 'Reporting & KPI', path: '/reporting' },
      { label: 'Manajemen Pengguna & Hak Akses', path: '/users' },
      { label: 'Master Data', path: '/master-data' },
      { label: 'Integration & API', path: '/roadmap/integration', roadmap: true },
      { label: 'System Administration', path: '/roadmap/sysadmin', roadmap: true },
      { label: 'Audit Trail', path: '/audit-trail' },
    ],
  },
]
