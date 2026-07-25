// Core domain model — scoped to the modules already covered by the prototype
// per docs/01_PRD.md Section 5 and docs/04_ARCHITECTURE.md Section 4.
// Roadmap-only entities (Record/Retention, Risk, ComplianceMapping, AccessGrant,
// DistributionRecord, Comment) are intentionally NOT modeled here — see README.

export type RoleId =
  | 'requester'
  | 'drafter'
  | 'reviewer'
  | 'approver'
  | 'controller'
  | 'ratifier'
  | 'function_head'
  | 'compliance_admin'
  | 'sysadmin'
  | 'auditor'
  | 'viewer'

export interface Role {
  id: RoleId
  label: string
  summary: string
}

export type DocumentStatus =
  | 'draft'
  | 'review'
  | 'approval'
  | 'released'
  | 'obsolete'

export type ValidityStatus = 'berlaku' | 'kadaluarsa' | 'tidak_berlaku' | 'belum_berlaku'

export type ClassificationLevel =
  | 'public'
  | 'internal'
  | 'restricted'
  | 'confidential'
  | 'secret'
  | 'top_secret'

export type DocumentType =
  | 'Kebijakan'
  | 'Manual'
  | 'SOP'
  | 'Work Instruction'
  | 'Formulir'

export interface Standard {
  code: string
  name: string
}

export interface FunctionDept {
  id: string
  name: string
}

export interface Revision {
  id: string
  documentId: string
  revisionNumber: number
  version: string
  date: string
  editor: string
  notes: string
  status: DocumentStatus
  contentSnapshot: string
}

export interface DocumentRelation {
  type: 'supersedes' | 'supersededBy' | 'references' | 'relatedTo' | 'parentDocument'
  targetDocumentId: string
}

export interface EdmsDocument {
  id: string
  code: string // JENIS-FUNGSI-NNN
  title: string
  type: DocumentType
  functionId: string
  standards: string[] // Standard codes, multi-value
  classification: ClassificationLevel
  status: DocumentStatus
  validity: ValidityStatus
  version: string
  revisionNumber: number
  effectiveDate: string | null
  reviewDate: string | null
  expiryDate: string | null
  keywords: string[]
  content: string
  owner: string
  relations: DocumentRelation[]
  createdAt: string
  updatedAt: string
  draftingProjectId?: string
}

export type DraftingStage =
  | 'permintaan'
  | 'undangan_rapat'
  | 'rapat'
  | 'bukti_notulen'
  | 'daftar_hadir'
  | 'finalisasi'
  | 'pengesahan'
  | 'register_utama'

export interface MeetingRecord {
  id: string
  sessionNumber: number
  date: string
  budget: number
  hasPhotoEvidence: boolean
  hasMinutesEvidence: boolean
  attendees: string[]
  signaturesCollected: boolean
}

export interface DraftingProject {
  id: string
  requestNumber: string // REQ-YYYY-NNN
  documentTitle: string
  documentType: DocumentType
  functionId: string
  standards: string[]
  initialClassification: ClassificationLevel
  reason: string
  requester: string
  currentStage: DraftingStage
  meetings: MeetingRecord[]
  finalizedContent?: string
  ratifiedDocumentId?: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  functionId: string
  roles: RoleId[]
  active: boolean
}

export type NotificationCategory = 'approval_pending' | 'expiring_soon' | 'shared' | 'assigned'

export interface AppNotification {
  id: string
  category: NotificationCategory
  message: string
  documentId?: string
  read: boolean
  createdAt: string
}

export type AuditAction =
  | 'login'
  | 'create'
  | 'status_change'
  | 'delete'
  | 'restore'
  | 'master_data_change'
  | 'view'
  | 'export'

export interface AuditLogEntry {
  id: string
  actor: string
  action: AuditAction
  entity: string
  entityId: string
  timestamp: string
  detail: string
}

export const DOCUMENT_STATUS_ORDER: DocumentStatus[] = [
  'draft',
  'review',
  'approval',
  'released',
  'obsolete',
]

export const DRAFTING_STAGE_ORDER: DraftingStage[] = [
  'permintaan',
  'undangan_rapat',
  'rapat',
  'bukti_notulen',
  'daftar_hadir',
  'finalisasi',
  'pengesahan',
  'register_utama',
]
