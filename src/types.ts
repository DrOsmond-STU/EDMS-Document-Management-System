// Core domain model — scoped to the modules already covered by the prototype
// per docs/01_PRD.md Section 5 and docs/04_ARCHITECTURE.md Section 4.
// Roadmap-only entities (Record/Retention, ComplianceMapping, AccessGrant,
// DistributionRecord, Comment) are intentionally NOT modeled here — see README.
//
// Risk Management, Internal Audit, External Audit, and Management Review
// entities live in this file too — see the "Risk & Audit" section below.

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

// ---------------------------------------------------------------------------
// Risk & Audit
// ---------------------------------------------------------------------------

// Risk register — mirrors ISO 31000 (context, identification, analysis,
// evaluation, treatment) and ISO 9001 clause 6.1 "risk-based thinking".
export type RiskCategory =
  | 'strategic'
  | 'operational'
  | 'compliance'
  | 'financial'
  | 'safety'
  | 'security'
  | 'environmental'
  | 'reputational'

// 1..5 scale for both likelihood and impact — standard 5×5 heat map.
export type Likelihood = 1 | 2 | 3 | 4 | 5
export type Impact = 1 | 2 | 3 | 4 | 5

// Derived from likelihood × impact but kept as a stored bucket so filtering
// and colour coding don't recompute in every render.
export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme'

export type RiskTreatment = 'avoid' | 'reduce' | 'transfer' | 'accept'

export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'monitored' | 'closed'

export interface RiskControl {
  id: string
  description: string
  owner: string
  effectiveness: 'weak' | 'moderate' | 'strong'
  lastTestedAt?: string
}

export interface RiskReviewNote {
  id: string
  date: string
  reviewer: string
  note: string
}

export interface Risk {
  id: string
  code: string // RSK-YYYY-NNN
  title: string
  description: string
  category: RiskCategory
  functionId: string
  owner: string
  standards: string[] // e.g. ['ISO9001', 'ISO31000']
  inherentLikelihood: Likelihood
  inherentImpact: Impact
  inherentLevel: RiskLevel
  treatment: RiskTreatment
  treatmentPlan: string
  controls: RiskControl[]
  residualLikelihood: Likelihood
  residualImpact: Impact
  residualLevel: RiskLevel
  status: RiskStatus
  reviewDate: string | null
  reviews: RiskReviewNote[]
  createdAt: string
  updatedAt: string
}

// Internal audit — ISO 19011 (guidelines for auditing management systems).
// A single "AuditProgram" here maps to one scheduled audit engagement, not
// a full multi-year programme; the term keeps parity with docs/01_PRD.md.
export type AuditStatus = 'planned' | 'scheduled' | 'in_progress' | 'reporting' | 'closed'

export type FindingType = 'nc_major' | 'nc_minor' | 'ofi' | 'observation' | 'strength'

export type FindingStatus =
  | 'open'
  | 'root_cause_analysis'
  | 'capa_in_progress'
  | 'verification'
  | 'closed'
  | 'rejected'

export interface CapaAction {
  id: string
  kind: 'corrective' | 'preventive'
  description: string
  owner: string
  dueDate: string
  completedAt?: string
  status: 'planned' | 'in_progress' | 'completed' | 'overdue'
}

export interface FindingVerification {
  id: string
  date: string
  verifier: string
  method: 'document_review' | 'interview' | 'observation' | 'reperformance'
  effective: boolean
  note: string
}

export interface AuditFinding {
  id: string
  code: string // FND-YYYY-NNN
  auditId: string // internal or external audit id
  auditSource: 'internal' | 'external'
  clauseReference: string // e.g. "ISO 9001 §8.5.1"
  standards: string[]
  type: FindingType
  title: string
  description: string
  evidence: string
  rootCause?: string
  functionId: string
  owner: string // person accountable for closure
  raisedBy: string
  raisedDate: string
  dueDate: string
  status: FindingStatus
  capa: CapaAction[]
  verifications: FindingVerification[]
  closedAt?: string
  closureNote?: string
}

export interface AuditChecklistItem {
  id: string
  clauseReference: string
  question: string
  result?: 'conform' | 'nc_major' | 'nc_minor' | 'ofi' | 'not_applicable'
  note?: string
}

export interface InternalAudit {
  id: string
  code: string // IA-YYYY-NNN
  title: string
  scope: string
  standards: string[]
  auditeeFunctionIds: string[]
  leadAuditor: string
  auditors: string[]
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  status: AuditStatus
  objectives: string
  checklist: AuditChecklistItem[]
  findingIds: string[]
  reportSummary?: string
  createdAt: string
  updatedAt: string
}

// External audit — surveillance / certification / regulator / customer.
export type ExternalAuditKind =
  | 'certification'
  | 'surveillance'
  | 'recertification'
  | 'regulator'
  | 'customer'
  | 'second_party'

export interface ExternalAudit {
  id: string
  code: string // EA-YYYY-NNN
  title: string
  kind: ExternalAuditKind
  auditingBody: string // e.g. "SGS", "Sucofindo", "Kementerian ESDM"
  standards: string[]
  scope: string
  contactPerson: string
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  reportReceivedDate?: string
  responseDueDate?: string
  status: AuditStatus
  findingIds: string[]
  certificateReference?: string
  createdAt: string
  updatedAt: string
}

// Management Review — ISO 9001 §9.3 (and the parallel clauses in ISO 14001
// §9.3, 45001 §9.3, 27001 §9.3, 22301 §9.3, etc). Inputs and outputs are
// modeled explicitly so the deck can be assembled from the register.
export type MgmtReviewInputCategory =
  | 'previous_actions'
  | 'external_internal_issues'
  | 'interested_parties'
  | 'process_performance'
  | 'nonconformities_capa'
  | 'monitoring_measurement'
  | 'audit_results'
  | 'customer_feedback'
  | 'supplier_performance'
  | 'resource_adequacy'
  | 'risk_effectiveness'
  | 'improvement_opportunities'

export interface MgmtReviewInput {
  id: string
  category: MgmtReviewInputCategory
  summary: string
  reference?: string // e.g. "IA-2026-001" or "RSK-2026-004"
}

export interface MgmtReviewDecision {
  id: string
  topic: string
  decision: string
  rationale?: string
}

export interface MgmtReviewActionItem {
  id: string
  description: string
  owner: string
  dueDate: string
  status: 'open' | 'in_progress' | 'completed' | 'overdue'
  completedAt?: string
  closureNote?: string
}

export type MgmtReviewStatus = 'planned' | 'scheduled' | 'held' | 'closed'

export interface ManagementReview {
  id: string
  code: string // MR-YYYY-NNN
  title: string
  meetingDate: string
  standards: string[]
  chairperson: string
  attendees: string[]
  status: MgmtReviewStatus
  agenda: string
  inputs: MgmtReviewInput[]
  decisions: MgmtReviewDecision[]
  actionItems: MgmtReviewActionItem[]
  minutesUrl?: string // e.g. "Notulen-MR-2026-001.pdf" placeholder
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Constants for the Risk & Audit domain — kept next to the types so the PHP
// mirror in cpanel/api/_lib/constants.php stays in sync at a glance.
// ---------------------------------------------------------------------------

export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  strategic: 'Strategis',
  operational: 'Operasional',
  compliance: 'Kepatuhan',
  financial: 'Keuangan',
  safety: 'Keselamatan (K3)',
  security: 'Keamanan Informasi',
  environmental: 'Lingkungan',
  reputational: 'Reputasi',
}

export const RISK_TREATMENT_LABEL: Record<RiskTreatment, string> = {
  avoid: 'Avoid — Hindari',
  reduce: 'Reduce — Mitigasi',
  transfer: 'Transfer — Alihkan',
  accept: 'Accept — Terima',
}

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  identified: 'Teridentifikasi',
  assessed: 'Telah Dinilai',
  treated: 'Dalam Perlakuan',
  monitored: 'Dipantau',
  closed: 'Ditutup',
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'Rendah',
  moderate: 'Sedang',
  high: 'Tinggi',
  extreme: 'Ekstrem',
}

export const RISK_LEVEL_COLOR: Record<RiskLevel, { bg: string; text: string }> = {
  low:      { bg: '#dcefe1', text: '#1f6a45' },
  moderate: { bg: '#fef1cf', text: '#8a5a10' },
  high:     { bg: '#fbd8c3', text: '#a3480d' },
  extreme:  { bg: '#f3c2c1', text: '#7d2726' },
}

// 5×5 heat map — level bucket per (likelihood, impact).
export function riskLevelFor(l: Likelihood, i: Impact): RiskLevel {
  const score = l * i
  if (score >= 20) return 'extreme'
  if (score >= 12) return 'high'
  if (score >= 6) return 'moderate'
  return 'low'
}

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  planned: 'Direncanakan',
  scheduled: 'Terjadwal',
  in_progress: 'Berlangsung',
  reporting: 'Pelaporan',
  closed: 'Selesai',
}

export const AUDIT_STATUS_COLOR: Record<AuditStatus, { bg: string; text: string }> = {
  planned:     { bg: '#e9eae4', text: '#4a4f45' },
  scheduled:   { bg: '#dbe8f4', text: '#2a6fb3' },
  in_progress: { bg: '#fdf1dc', text: '#b9791c' },
  reporting:   { bg: '#e6dff7', text: '#4b3f9c' },
  closed:      { bg: '#e3f1ea', text: '#1d6e48' },
}

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  nc_major: 'NC Major',
  nc_minor: 'NC Minor',
  ofi: 'OFI',
  observation: 'Observasi',
  strength: 'Strength',
}

export const FINDING_TYPE_COLOR: Record<FindingType, { bg: string; text: string }> = {
  nc_major:    { bg: '#fbe7e6', text: '#a53c3b' },
  nc_minor:    { bg: '#fdf1dc', text: '#a3691a' },
  ofi:         { bg: '#e6f1fb', text: '#265f92' },
  observation: { bg: '#eef0ea', text: '#5b6055' },
  strength:    { bg: '#dcefe1', text: '#1f6a45' },
}

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: 'Terbuka',
  root_cause_analysis: 'Analisis Akar Masalah',
  capa_in_progress: 'CAPA Berjalan',
  verification: 'Verifikasi',
  closed: 'Ditutup',
  rejected: 'Ditolak',
}

export const FINDING_STATUS_COLOR: Record<FindingStatus, { bg: string; text: string }> = {
  open:                { bg: '#fbe7e6', text: '#a53c3b' },
  root_cause_analysis: { bg: '#fdf1dc', text: '#b9791c' },
  capa_in_progress:    { bg: '#fcecd6', text: '#a3691a' },
  verification:        { bg: '#e6dff7', text: '#4b3f9c' },
  closed:              { bg: '#e3f1ea', text: '#1d6e48' },
  rejected:            { bg: '#e9eae4', text: '#4a4f45' },
}

export const EXTERNAL_AUDIT_KIND_LABEL: Record<ExternalAuditKind, string> = {
  certification: 'Sertifikasi Awal',
  surveillance: 'Surveillance',
  recertification: 'Resertifikasi',
  regulator: 'Regulator',
  customer: 'Customer / Pelanggan',
  second_party: 'Second Party',
}

export const MGMT_REVIEW_STATUS_LABEL: Record<MgmtReviewStatus, string> = {
  planned: 'Direncanakan',
  scheduled: 'Terjadwal',
  held: 'Dilaksanakan',
  closed: 'Selesai',
}

export const MGMT_REVIEW_INPUT_LABEL: Record<MgmtReviewInputCategory, string> = {
  previous_actions: 'Status tindak lanjut sebelumnya',
  external_internal_issues: 'Isu internal & eksternal',
  interested_parties: 'Kebutuhan pihak berkepentingan',
  process_performance: 'Kinerja proses & mutu produk',
  nonconformities_capa: 'Ketidaksesuaian & tindakan koreksi (CAPA)',
  monitoring_measurement: 'Hasil pemantauan & pengukuran',
  audit_results: 'Hasil audit',
  customer_feedback: 'Umpan balik pelanggan',
  supplier_performance: 'Kinerja pemasok / mitra eksternal',
  resource_adequacy: 'Kecukupan sumber daya',
  risk_effectiveness: 'Efektivitas tindakan risiko & peluang',
  improvement_opportunities: 'Peluang peningkatan',
}
