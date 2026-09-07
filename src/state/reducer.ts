// Pure, portable state logic shared by the browser (via AppContext) and the
// Vercel API routes under /api. No browser globals (localStorage, window) may
// be used here — this file also runs server-side under Node.

import type {
  AppNotification,
  AuditAction,
  AuditFinding,
  AuditLogEntry,
  CapaAction,
  ClassificationLevel,
  DocumentStatus,
  DocumentType,
  DraftingProject,
  DraftingStage,
  EdmsDocument,
  ExternalAudit,
  FindingStatus,
  FindingType,
  FindingVerification,
  FunctionDept,
  GapFollowUp,
  GapFollowUpStatus,
  GapFollowUpType,
  Impact,
  InternalAudit,
  Likelihood,
  ManagementReview,
  MeetingRecord,
  MgmtReviewActionItem,
  MgmtReviewDecision,
  MgmtReviewInput,
  Revision,
  Risk,
  RiskCategory,
  RiskControl,
  RiskReviewNote,
  RiskStatus,
  RiskTreatment,
  Standard,
  User,
  ValidityStatus,
} from '../types'
import { DRAFTING_STAGE_ORDER, riskLevelFor } from '../types'
import { DOCUMENT_TYPE_CODE } from '../constants'
import {
  AUDIT_LOG,
  DOCUMENTS,
  DRAFTING_PROJECTS,
  EXTERNAL_AUDITS,
  FINDINGS,
  FUNCTIONS,
  GAP_FOLLOWUPS,
  INTERNAL_AUDITS,
  MGMT_REVIEWS,
  NOTIFICATIONS,
  REVISIONS,
  RISKS,
  STANDARDS,
  USERS,
} from '../data/seed'

export interface SharedState {
  documents: EdmsDocument[]
  revisions: Revision[]
  draftingProjects: DraftingProject[]
  notifications: AppNotification[]
  auditLog: AuditLogEntry[]
  functions: FunctionDept[]
  standards: Standard[]
  users: User[]
  risks: Risk[]
  internalAudits: InternalAudit[]
  externalAudits: ExternalAudit[]
  findings: AuditFinding[]
  mgmtReviews: ManagementReview[]
  gapFollowUps: GapFollowUp[]
}

export function initialState(): SharedState {
  return {
    documents: DOCUMENTS,
    revisions: REVISIONS,
    draftingProjects: DRAFTING_PROJECTS,
    notifications: NOTIFICATIONS,
    auditLog: AUDIT_LOG,
    functions: FUNCTIONS,
    standards: STANDARDS,
    users: USERS,
    risks: RISKS,
    internalAudits: INTERNAL_AUDITS,
    externalAudits: EXTERNAL_AUDITS,
    findings: FINDINGS,
    mgmtReviews: MGMT_REVIEWS,
    gapFollowUps: GAP_FOLLOWUPS,
  }
}

export interface NewRiskInput {
  title: string
  description: string
  category: RiskCategory
  functionId: string
  owner: string
  standards: string[]
  inherentLikelihood: Likelihood
  inherentImpact: Impact
  treatment: RiskTreatment
  treatmentPlan: string
  residualLikelihood: Likelihood
  residualImpact: Impact
  reviewDate: string | null
}

export interface NewInternalAuditInput {
  title: string
  scope: string
  standards: string[]
  auditeeFunctionIds: string[]
  leadAuditor: string
  auditors: string[]
  plannedStartDate: string
  plannedEndDate: string
  objectives: string
}

export interface NewExternalAuditInput {
  title: string
  kind: ExternalAudit['kind']
  auditingBody: string
  standards: string[]
  scope: string
  contactPerson: string
  plannedStartDate: string
  plannedEndDate: string
}

export interface NewFindingInput {
  auditId: string
  auditSource: 'internal' | 'external'
  clauseReference: string
  standards: string[]
  type: FindingType
  title: string
  description: string
  evidence: string
  functionId: string
  owner: string
  raisedBy: string
  raisedDate: string
  dueDate: string
}

export interface NewCapaInput {
  findingId: string
  kind: 'corrective' | 'preventive'
  description: string
  owner: string
  dueDate: string
}

export interface NewMgmtReviewInput {
  title: string
  meetingDate: string
  standards: string[]
  chairperson: string
  attendees: string[]
  agenda: string
  inputs: Omit<MgmtReviewInput, 'id'>[]
}

export interface NewGapFollowUpInput {
  gapId: string
  type: GapFollowUpType
  pic: string
  deadline: string
  action: string
  reviewer: string
}

export type Action =
  | { type: 'CREATE_DOCUMENT'; input: NewDocumentInput; actor: string }
  | { type: 'TRANSITION_STATUS'; documentId: string; toStatus: DocumentStatus; actor: string; note?: string }
  | { type: 'MARK_NOTIFICATION_READ'; id: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'ADD_FUNCTION'; dept: FunctionDept; actor: string }
  | { type: 'ADD_STANDARD'; standard: Standard; actor: string }
  | { type: 'ADD_USER'; user: User; actor: string }
  | { type: 'TOGGLE_USER_ACTIVE'; userId: string; actor: string }
  // passwordHash is computed server-side from the plaintext newPassword the
  // client actually sends — see api/dispatch.ts / cpanel/api/dispatch.php.
  // currentPassword is required (and verified server-side) unless the caller
  // has users.manage and is resetting someone else's password.
  | { type: 'SET_USER_PASSWORD'; userId: string; passwordHash: string; actor: string }
  | { type: 'CREATE_DRAFTING_REQUEST'; input: NewDraftingRequestInput; actor: string }
  | { type: 'ADD_MEETING'; projectId: string; meeting: Omit<MeetingRecord, 'id'>; actor: string }
  | { type: 'SET_FINALIZED_CONTENT'; projectId: string; content: string; actor: string }
  | { type: 'ADVANCE_STAGE'; projectId: string; actor: string }
  // Risk management
  | { type: 'CREATE_RISK'; input: NewRiskInput; actor: string }
  | { type: 'UPDATE_RISK_STATUS'; riskId: string; status: RiskStatus; actor: string }
  | { type: 'ADD_RISK_CONTROL'; riskId: string; control: Omit<RiskControl, 'id'>; actor: string }
  | { type: 'ADD_RISK_REVIEW'; riskId: string; review: Omit<RiskReviewNote, 'id'>; actor: string }
  // Internal / external audit
  | { type: 'CREATE_INTERNAL_AUDIT'; input: NewInternalAuditInput; actor: string }
  | { type: 'UPDATE_AUDIT_STATUS'; auditId: string; auditSource: 'internal' | 'external'; status: InternalAudit['status']; actor: string }
  | { type: 'CREATE_EXTERNAL_AUDIT'; input: NewExternalAuditInput; actor: string }
  | { type: 'ADD_FINDING'; input: NewFindingInput; actor: string }
  | { type: 'ADD_CAPA'; input: NewCapaInput; actor: string }
  | { type: 'COMPLETE_CAPA'; findingId: string; capaId: string; actor: string }
  | { type: 'ADD_VERIFICATION'; findingId: string; verification: Omit<FindingVerification, 'id'>; actor: string }
  | { type: 'CLOSE_FINDING'; findingId: string; closureNote: string; actor: string }
  | { type: 'UPDATE_FINDING_STATUS'; findingId: string; status: FindingStatus; actor: string }
  | { type: 'SET_ROOT_CAUSE'; findingId: string; rootCause: string; actor: string }
  // Management review
  | { type: 'CREATE_MGMT_REVIEW'; input: NewMgmtReviewInput; actor: string }
  | { type: 'ADD_MGMT_DECISION'; reviewId: string; decision: Omit<MgmtReviewDecision, 'id'>; actor: string }
  | { type: 'ADD_MGMT_ACTION'; reviewId: string; item: Omit<MgmtReviewActionItem, 'id' | 'status'>; actor: string }
  | { type: 'CLOSE_MGMT_ACTION'; reviewId: string; itemId: string; closureNote: string; actor: string }
  | { type: 'UPDATE_MGMT_REVIEW_STATUS'; reviewId: string; status: ManagementReview['status']; actor: string }
  // Compliance matrix — tindak lanjut gap
  | { type: 'ADD_GAP_FOLLOWUP'; input: NewGapFollowUpInput; actor: string }
  | { type: 'UPDATE_GAP_FOLLOWUP_STATUS'; followUpId: string; status: GapFollowUpStatus; actor: string }
  | { type: 'RESET_DEMO_DATA' }

export const ACTION_TYPES: Action['type'][] = [
  'CREATE_DOCUMENT',
  'TRANSITION_STATUS',
  'MARK_NOTIFICATION_READ',
  'MARK_ALL_NOTIFICATIONS_READ',
  'ADD_FUNCTION',
  'ADD_STANDARD',
  'ADD_USER',
  'TOGGLE_USER_ACTIVE',
  'SET_USER_PASSWORD',
  'CREATE_DRAFTING_REQUEST',
  'ADD_MEETING',
  'SET_FINALIZED_CONTENT',
  'ADVANCE_STAGE',
  'CREATE_RISK',
  'UPDATE_RISK_STATUS',
  'ADD_RISK_CONTROL',
  'ADD_RISK_REVIEW',
  'CREATE_INTERNAL_AUDIT',
  'UPDATE_AUDIT_STATUS',
  'CREATE_EXTERNAL_AUDIT',
  'ADD_FINDING',
  'ADD_CAPA',
  'COMPLETE_CAPA',
  'ADD_VERIFICATION',
  'CLOSE_FINDING',
  'UPDATE_FINDING_STATUS',
  'SET_ROOT_CAUSE',
  'CREATE_MGMT_REVIEW',
  'ADD_MGMT_DECISION',
  'ADD_MGMT_ACTION',
  'CLOSE_MGMT_ACTION',
  'UPDATE_MGMT_REVIEW_STATUS',
  'ADD_GAP_FOLLOWUP',
  'UPDATE_GAP_FOLLOWUP_STATUS',
  'RESET_DEMO_DATA',
]

export interface NewDocumentInput {
  title: string
  type: DocumentType
  functionId: string
  standards: string[]
  classification: ClassificationLevel
  owner: string
  keywords: string[]
}

export interface NewDraftingRequestInput {
  documentTitle: string
  documentType: DocumentType
  functionId: string
  standards: string[]
  initialClassification: ClassificationLevel
  reason: string
  requester: string
}

function nextDocumentCode(documents: EdmsDocument[], type: DocumentType, functionId: string): string {
  const prefix = `${DOCUMENT_TYPE_CODE[type]}-${functionId.toUpperCase()}`
  const existing = documents.filter((d) => d.code.startsWith(prefix + '-'))
  const maxN = existing.reduce((max, d) => {
    const n = Number(d.code.split('-').pop())
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `${prefix}-${String(maxN + 1).padStart(3, '0')}`
}

function nextRequestNumber(projects: DraftingProject[]): string {
  const year = new Date().getFullYear()
  const prefix = `REQ-${year}-`
  const maxN = projects.reduce((max, p) => {
    if (!p.requestNumber.startsWith(prefix)) return max
    const n = Number(p.requestNumber.split('-').pop())
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `${prefix}${String(maxN + 1).padStart(3, '0')}`
}

function makeAudit(actor: string, action: AuditAction, entity: string, entityId: string, detail: string): AuditLogEntry {
  return {
    id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor,
    action,
    entity,
    entityId,
    timestamp: new Date().toISOString().slice(0, 10),
    detail,
  }
}

function nextValidityForStatus(status: DocumentStatus): ValidityStatus {
  if (status === 'released') return 'berlaku'
  if (status === 'obsolete') return 'tidak_berlaku'
  return 'belum_berlaku'
}

export function reducer(state: SharedState, action: Action): SharedState {
  switch (action.type) {
    case 'CREATE_DOCUMENT': {
      const { input, actor } = action
      const code = nextDocumentCode(state.documents, input.type, input.functionId)
      const now = new Date().toISOString().slice(0, 10)
      const doc: EdmsDocument = {
        id: `doc-${Date.now()}`,
        code,
        title: input.title,
        type: input.type,
        functionId: input.functionId,
        standards: input.standards,
        classification: input.classification,
        status: 'draft',
        validity: 'belum_berlaku',
        version: '0.1',
        revisionNumber: 0,
        effectiveDate: null,
        reviewDate: null,
        expiryDate: null,
        keywords: input.keywords,
        content: '',
        owner: input.owner,
        relations: [],
        createdAt: now,
        updatedAt: now,
      }
      const rev: Revision = {
        id: `${doc.id}-rev0`,
        documentId: doc.id,
        revisionNumber: 0,
        version: '0.1',
        date: now,
        editor: actor,
        notes: 'Draf awal disusun.',
        status: 'draft',
        contentSnapshot: `Draf awal: ${doc.title}`,
      }
      return {
        ...state,
        documents: [doc, ...state.documents],
        revisions: [rev, ...state.revisions],
        auditLog: [makeAudit(actor, 'create', 'Document', doc.id, `Membuat dokumen "${doc.title}" (${doc.code})`), ...state.auditLog],
      }
    }

    case 'TRANSITION_STATUS': {
      const { documentId, toStatus, actor, note } = action
      const now = new Date().toISOString().slice(0, 10)
      let updatedTitle = ''
      const documents = state.documents.map((doc) => {
        if (doc.id !== documentId) return doc
        updatedTitle = doc.title
        const isRelease = toStatus === 'released'
        return {
          ...doc,
          status: toStatus,
          validity: nextValidityForStatus(toStatus),
          version: isRelease ? '1.0' : doc.version,
          revisionNumber: isRelease ? doc.revisionNumber + 1 : doc.revisionNumber,
          effectiveDate: isRelease ? now : doc.effectiveDate,
          updatedAt: now,
        }
      })
      const doc = documents.find((d) => d.id === documentId)
      if (!doc) return state
      const rev: Revision = {
        id: `${documentId}-rev${doc.revisionNumber}-${Date.now()}`,
        documentId,
        revisionNumber: doc.revisionNumber,
        version: doc.version,
        date: now,
        editor: actor,
        notes: note ?? `Transisi status ke ${toStatus}.`,
        status: toStatus,
        contentSnapshot: doc.content,
      }
      return {
        ...state,
        documents,
        revisions: [rev, ...state.revisions],
        auditLog: [
          makeAudit(actor, 'status_change', 'Document', documentId, `Status "${updatedTitle}" berubah menjadi ${toStatus}`),
          ...state.auditLog,
        ],
      }
    }

    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      }

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'ADD_FUNCTION':
      return {
        ...state,
        functions: [...state.functions, action.dept],
        auditLog: [makeAudit(action.actor, 'master_data_change', 'FunctionDept', action.dept.id, `Menambahkan fungsi/departemen "${action.dept.name}"`), ...state.auditLog],
      }

    case 'ADD_STANDARD':
      return {
        ...state,
        standards: [...state.standards, action.standard],
        auditLog: [makeAudit(action.actor, 'master_data_change', 'Standard', action.standard.code, `Menambahkan standar "${action.standard.name}"`), ...state.auditLog],
      }

    case 'ADD_USER':
      return {
        ...state,
        users: [...state.users, action.user],
        auditLog: [makeAudit(action.actor, 'master_data_change', 'User', action.user.id, `Menambahkan pengguna "${action.user.name}"`), ...state.auditLog],
      }

    case 'TOGGLE_USER_ACTIVE': {
      let name = ''
      const users = state.users.map((u) => {
        if (u.id !== action.userId) return u
        name = u.name
        return { ...u, active: !u.active }
      })
      const toggledUser = users.find((u) => u.id === action.userId)
      if (!toggledUser) return state
      return {
        ...state,
        users,
        auditLog: [
          makeAudit(action.actor, 'master_data_change', 'User', action.userId, `${toggledUser.active ? 'Mengaktifkan' : 'Menonaktifkan'} pengguna "${name}"`),
          ...state.auditLog,
        ],
      }
    }

    case 'SET_USER_PASSWORD': {
      let name = ''
      const users = state.users.map((u) => {
        if (u.id !== action.userId) return u
        name = u.name
        return { ...u, passwordHash: action.passwordHash }
      })
      if (!name) return state
      return {
        ...state,
        users,
        auditLog: [
          makeAudit(action.actor, 'master_data_change', 'User', action.userId, `Mengganti password akun "${name}"`),
          ...state.auditLog,
        ],
      }
    }

    case 'CREATE_DRAFTING_REQUEST': {
      const { input, actor } = action
      const now = new Date().toISOString().slice(0, 10)
      const project: DraftingProject = {
        id: `dp-${Date.now()}`,
        requestNumber: nextRequestNumber(state.draftingProjects),
        documentTitle: input.documentTitle,
        documentType: input.documentType,
        functionId: input.functionId,
        standards: input.standards,
        initialClassification: input.initialClassification,
        reason: input.reason,
        requester: input.requester,
        currentStage: 'permintaan',
        meetings: [],
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...state,
        draftingProjects: [project, ...state.draftingProjects],
        auditLog: [makeAudit(actor, 'create', 'DraftingProject', project.id, `Mengajukan permintaan dokumen "${project.documentTitle}" (${project.requestNumber})`), ...state.auditLog],
      }
    }

    case 'ADD_MEETING': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const draftingProjects = state.draftingProjects.map((p) => {
        if (p.id !== action.projectId) return p
        title = p.documentTitle
        const meeting: MeetingRecord = { ...action.meeting, id: `m-${Date.now()}` }
        return { ...p, meetings: [...p.meetings, meeting], updatedAt: now }
      })
      return {
        ...state,
        draftingProjects,
        auditLog: [makeAudit(action.actor, 'create', 'DraftingProject', action.projectId, `Mencatat rapat pembahasan baru untuk "${title}"`), ...state.auditLog],
      }
    }

    case 'SET_FINALIZED_CONTENT': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const draftingProjects = state.draftingProjects.map((p) => {
        if (p.id !== action.projectId) return p
        title = p.documentTitle
        return { ...p, finalizedContent: action.content, updatedAt: now }
      })
      return {
        ...state,
        draftingProjects,
        auditLog: [makeAudit(action.actor, 'create', 'DraftingProject', action.projectId, `Menyimpan konten final "${title}"`), ...state.auditLog],
      }
    }

    case 'ADVANCE_STAGE': {
      const now = new Date().toISOString().slice(0, 10)
      const project = state.draftingProjects.find((p) => p.id === action.projectId)
      if (!project) return state

      const idx = DRAFTING_STAGE_ORDER.indexOf(project.currentStage)
      const nextStage: DraftingStage | undefined = DRAFTING_STAGE_ORDER[idx + 1]
      if (!nextStage) return state

      let documents = state.documents
      let revisions = state.revisions
      let extraAudit: AuditLogEntry[] = []
      let ratifiedDocumentId = project.ratifiedDocumentId

      // Reaching the final stage publishes the document into the main register as Released.
      if (nextStage === 'register_utama') {
        const code = nextDocumentCode(state.documents, project.documentType, project.functionId)
        const doc: EdmsDocument = {
          id: `doc-${Date.now()}`,
          code,
          title: project.documentTitle,
          type: project.documentType,
          functionId: project.functionId,
          standards: project.standards,
          classification: project.initialClassification,
          status: 'released',
          validity: 'berlaku',
          version: '1.0',
          revisionNumber: 1,
          effectiveDate: now,
          reviewDate: null,
          expiryDate: null,
          keywords: [],
          content: project.finalizedContent ?? `Dokumen resmi hasil pengesahan permintaan ${project.requestNumber}.`,
          owner: project.requester,
          relations: [],
          createdAt: project.createdAt,
          updatedAt: now,
          draftingProjectId: project.id,
        }
        documents = [doc, ...documents]
        revisions = [
          {
            id: `${doc.id}-rev1`,
            documentId: doc.id,
            revisionNumber: 1,
            version: '1.0',
            date: now,
            editor: project.requester,
            notes: `Diterbitkan dari proses tracking penyusunan (${project.requestNumber}).`,
            status: 'released',
            contentSnapshot: doc.content,
          },
          ...revisions,
        ]
        ratifiedDocumentId = doc.id
        extraAudit = [makeAudit(action.actor, 'status_change', 'Document', doc.id, `Dokumen "${doc.title}" masuk Register Utama (Released) dari ${project.requestNumber}`)]
      }

      const draftingProjects = state.draftingProjects.map((p) =>
        p.id === action.projectId ? { ...p, currentStage: nextStage, ratifiedDocumentId, updatedAt: now } : p,
      )

      return {
        ...state,
        draftingProjects,
        documents,
        revisions,
        auditLog: [
          makeAudit(action.actor, 'status_change', 'DraftingProject', action.projectId, `Tahap "${project.documentTitle}" maju ke ${nextStage}`),
          ...extraAudit,
          ...state.auditLog,
        ],
      }
    }

    // -------------------------------------------------------------------
    // Risk management
    // -------------------------------------------------------------------
    case 'CREATE_RISK': {
      const { input, actor } = action
      const now = new Date().toISOString().slice(0, 10)
      const risk: Risk = {
        id: `rsk-${Date.now()}`,
        code: nextRiskCode(state.risks),
        title: input.title,
        description: input.description,
        category: input.category,
        functionId: input.functionId,
        owner: input.owner,
        standards: input.standards,
        inherentLikelihood: input.inherentLikelihood,
        inherentImpact: input.inherentImpact,
        inherentLevel: riskLevelFor(input.inherentLikelihood, input.inherentImpact),
        treatment: input.treatment,
        treatmentPlan: input.treatmentPlan,
        controls: [],
        residualLikelihood: input.residualLikelihood,
        residualImpact: input.residualImpact,
        residualLevel: riskLevelFor(input.residualLikelihood, input.residualImpact),
        status: 'assessed',
        reviewDate: input.reviewDate,
        reviews: [],
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...state,
        risks: [risk, ...state.risks],
        auditLog: [makeAudit(actor, 'create', 'Risk', risk.id, `Menambahkan risiko "${risk.title}" (${risk.code})`), ...state.auditLog],
      }
    }

    case 'UPDATE_RISK_STATUS': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const risks = state.risks.map((r) => {
        if (r.id !== action.riskId) return r
        title = r.title
        return { ...r, status: action.status, updatedAt: now }
      })
      return {
        ...state,
        risks,
        auditLog: [makeAudit(action.actor, 'status_change', 'Risk', action.riskId, `Status risiko "${title}" → ${action.status}`), ...state.auditLog],
      }
    }

    case 'ADD_RISK_CONTROL': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const risks = state.risks.map((r) => {
        if (r.id !== action.riskId) return r
        title = r.title
        const control: RiskControl = { ...action.control, id: `rc-${Date.now()}` }
        return { ...r, controls: [...r.controls, control], updatedAt: now }
      })
      return {
        ...state,
        risks,
        auditLog: [makeAudit(action.actor, 'create', 'RiskControl', action.riskId, `Menambahkan kontrol untuk risiko "${title}"`), ...state.auditLog],
      }
    }

    case 'ADD_RISK_REVIEW': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const risks = state.risks.map((r) => {
        if (r.id !== action.riskId) return r
        title = r.title
        const review: RiskReviewNote = { ...action.review, id: `rr-${Date.now()}` }
        return { ...r, reviews: [review, ...r.reviews], status: 'monitored' as RiskStatus, updatedAt: now }
      })
      return {
        ...state,
        risks,
        auditLog: [makeAudit(action.actor, 'view', 'Risk', action.riskId, `Meninjau risiko "${title}"`), ...state.auditLog],
      }
    }

    // -------------------------------------------------------------------
    // Internal / external audit
    // -------------------------------------------------------------------
    case 'CREATE_INTERNAL_AUDIT': {
      const { input, actor } = action
      const now = new Date().toISOString().slice(0, 10)
      const audit: InternalAudit = {
        id: `ia-${Date.now()}`,
        code: nextInternalAuditCode(state.internalAudits),
        title: input.title,
        scope: input.scope,
        standards: input.standards,
        auditeeFunctionIds: input.auditeeFunctionIds,
        leadAuditor: input.leadAuditor,
        auditors: input.auditors,
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        status: 'scheduled',
        objectives: input.objectives,
        checklist: [],
        findingIds: [],
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...state,
        internalAudits: [audit, ...state.internalAudits],
        auditLog: [makeAudit(actor, 'create', 'InternalAudit', audit.id, `Menjadwalkan audit internal "${audit.title}" (${audit.code})`), ...state.auditLog],
      }
    }

    case 'CREATE_EXTERNAL_AUDIT': {
      const { input, actor } = action
      const now = new Date().toISOString().slice(0, 10)
      const audit: ExternalAudit = {
        id: `ea-${Date.now()}`,
        code: nextExternalAuditCode(state.externalAudits),
        title: input.title,
        kind: input.kind,
        auditingBody: input.auditingBody,
        standards: input.standards,
        scope: input.scope,
        contactPerson: input.contactPerson,
        plannedStartDate: input.plannedStartDate,
        plannedEndDate: input.plannedEndDate,
        status: 'scheduled',
        findingIds: [],
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...state,
        externalAudits: [audit, ...state.externalAudits],
        auditLog: [makeAudit(actor, 'create', 'ExternalAudit', audit.id, `Menjadwalkan audit eksternal "${audit.title}" (${audit.code})`), ...state.auditLog],
      }
    }

    case 'UPDATE_AUDIT_STATUS': {
      const now = new Date().toISOString().slice(0, 10)
      let label = ''
      if (action.auditSource === 'internal') {
        const internalAudits = state.internalAudits.map((a) => {
          if (a.id !== action.auditId) return a
          label = `IA "${a.title}"`
          return { ...a, status: action.status, updatedAt: now }
        })
        return {
          ...state,
          internalAudits,
          auditLog: [makeAudit(action.actor, 'status_change', 'InternalAudit', action.auditId, `Status ${label} → ${action.status}`), ...state.auditLog],
        }
      }
      const externalAudits = state.externalAudits.map((a) => {
        if (a.id !== action.auditId) return a
        label = `EA "${a.title}"`
        return { ...a, status: action.status, updatedAt: now }
      })
      return {
        ...state,
        externalAudits,
        auditLog: [makeAudit(action.actor, 'status_change', 'ExternalAudit', action.auditId, `Status ${label} → ${action.status}`), ...state.auditLog],
      }
    }

    case 'ADD_FINDING': {
      const { input, actor } = action
      const finding: AuditFinding = {
        id: `fnd-${Date.now()}`,
        code: nextFindingCode(state.findings),
        auditId: input.auditId,
        auditSource: input.auditSource,
        clauseReference: input.clauseReference,
        standards: input.standards,
        type: input.type,
        title: input.title,
        description: input.description,
        evidence: input.evidence,
        functionId: input.functionId,
        owner: input.owner,
        raisedBy: input.raisedBy,
        raisedDate: input.raisedDate,
        dueDate: input.dueDate,
        status: 'open',
        capa: [],
        verifications: [],
      }
      // link back into audit.findingIds
      const internalAudits = input.auditSource === 'internal'
        ? state.internalAudits.map((a) => (a.id === input.auditId ? { ...a, findingIds: [...a.findingIds, finding.id] } : a))
        : state.internalAudits
      const externalAudits = input.auditSource === 'external'
        ? state.externalAudits.map((a) => (a.id === input.auditId ? { ...a, findingIds: [...a.findingIds, finding.id] } : a))
        : state.externalAudits
      return {
        ...state,
        findings: [finding, ...state.findings],
        internalAudits,
        externalAudits,
        auditLog: [makeAudit(actor, 'create', 'Finding', finding.id, `Menambahkan temuan "${finding.title}" (${finding.code})`), ...state.auditLog],
      }
    }

    case 'ADD_CAPA': {
      const { input, actor } = action
      const findings = state.findings.map((f) => {
        if (f.id !== input.findingId) return f
        const capa: CapaAction = {
          id: `capa-${Date.now()}`,
          kind: input.kind,
          description: input.description,
          owner: input.owner,
          dueDate: input.dueDate,
          status: 'in_progress',
        }
        return {
          ...f,
          capa: [...f.capa, capa],
          status: f.status === 'open' || f.status === 'root_cause_analysis' ? ('capa_in_progress' as FindingStatus) : f.status,
        }
      })
      return {
        ...state,
        findings,
        auditLog: [makeAudit(actor, 'create', 'Capa', input.findingId, `Menambahkan tindakan ${input.kind === 'corrective' ? 'koreksi' : 'preventif'}`), ...state.auditLog],
      }
    }

    case 'COMPLETE_CAPA': {
      const now = new Date().toISOString().slice(0, 10)
      const findings = state.findings.map((f) => {
        if (f.id !== action.findingId) return f
        return {
          ...f,
          capa: f.capa.map((c) => (c.id === action.capaId ? { ...c, status: 'completed' as const, completedAt: now } : c)),
        }
      })
      return {
        ...state,
        findings,
        auditLog: [makeAudit(action.actor, 'status_change', 'Capa', action.capaId, 'Menandai CAPA selesai'), ...state.auditLog],
      }
    }

    case 'ADD_VERIFICATION': {
      const findings = state.findings.map((f) => {
        if (f.id !== action.findingId) return f
        const v: FindingVerification = { ...action.verification, id: `ver-${Date.now()}` }
        return {
          ...f,
          verifications: [v, ...f.verifications],
          status: (v.effective ? 'verification' : f.status) as FindingStatus,
        }
      })
      return {
        ...state,
        findings,
        auditLog: [makeAudit(action.actor, 'view', 'Finding', action.findingId, `Verifikasi efektivitas: ${action.verification.effective ? 'efektif' : 'belum efektif'}`), ...state.auditLog],
      }
    }

    case 'CLOSE_FINDING': {
      const now = new Date().toISOString().slice(0, 10)
      let title = ''
      const findings = state.findings.map((f) => {
        if (f.id !== action.findingId) return f
        title = f.title
        return { ...f, status: 'closed' as FindingStatus, closedAt: now, closureNote: action.closureNote }
      })
      return {
        ...state,
        findings,
        auditLog: [makeAudit(action.actor, 'status_change', 'Finding', action.findingId, `Menutup temuan "${title}"`), ...state.auditLog],
      }
    }

    case 'UPDATE_FINDING_STATUS': {
      const findings = state.findings.map((f) => (f.id === action.findingId ? { ...f, status: action.status } : f))
      return {
        ...state,
        findings,
        auditLog: [makeAudit(action.actor, 'status_change', 'Finding', action.findingId, `Status temuan → ${action.status}`), ...state.auditLog],
      }
    }

    case 'SET_ROOT_CAUSE': {
      const findings = state.findings.map((f) => {
        if (f.id !== action.findingId) return f
        const nextStatus: FindingStatus = f.status === 'open' ? 'root_cause_analysis' : f.status
        return { ...f, rootCause: action.rootCause, status: nextStatus }
      })
      return {
        ...state,
        findings,
        auditLog: [makeAudit(action.actor, 'view', 'Finding', action.findingId, 'Menambahkan akar masalah (root cause)'), ...state.auditLog],
      }
    }

    // -------------------------------------------------------------------
    // Management review
    // -------------------------------------------------------------------
    case 'CREATE_MGMT_REVIEW': {
      const { input, actor } = action
      const now = new Date().toISOString().slice(0, 10)
      const review: ManagementReview = {
        id: `mr-${Date.now()}`,
        code: nextMgmtReviewCode(state.mgmtReviews),
        title: input.title,
        meetingDate: input.meetingDate,
        standards: input.standards,
        chairperson: input.chairperson,
        attendees: input.attendees,
        status: 'scheduled',
        agenda: input.agenda,
        inputs: input.inputs.map((it, i) => ({ ...it, id: `mri-${Date.now()}-${i}` })),
        decisions: [],
        actionItems: [],
        createdAt: now,
        updatedAt: now,
      }
      return {
        ...state,
        mgmtReviews: [review, ...state.mgmtReviews],
        auditLog: [makeAudit(actor, 'create', 'ManagementReview', review.id, `Menjadwalkan tinjauan manajemen "${review.title}" (${review.code})`), ...state.auditLog],
      }
    }

    case 'ADD_MGMT_DECISION': {
      const now = new Date().toISOString().slice(0, 10)
      const mgmtReviews = state.mgmtReviews.map((r) => {
        if (r.id !== action.reviewId) return r
        const decision: MgmtReviewDecision = { ...action.decision, id: `mrd-${Date.now()}` }
        return { ...r, decisions: [...r.decisions, decision], status: 'held' as const, updatedAt: now }
      })
      return {
        ...state,
        mgmtReviews,
        auditLog: [makeAudit(action.actor, 'create', 'MgmtDecision', action.reviewId, `Mencatat keputusan tinjauan manajemen`), ...state.auditLog],
      }
    }

    case 'ADD_MGMT_ACTION': {
      const now = new Date().toISOString().slice(0, 10)
      const mgmtReviews = state.mgmtReviews.map((r) => {
        if (r.id !== action.reviewId) return r
        const item: MgmtReviewActionItem = { ...action.item, id: `mra-${Date.now()}`, status: 'open' }
        return { ...r, actionItems: [...r.actionItems, item], updatedAt: now }
      })
      return {
        ...state,
        mgmtReviews,
        auditLog: [makeAudit(action.actor, 'create', 'MgmtAction', action.reviewId, 'Menambahkan tindak lanjut tinjauan manajemen'), ...state.auditLog],
      }
    }

    case 'CLOSE_MGMT_ACTION': {
      const now = new Date().toISOString().slice(0, 10)
      const mgmtReviews = state.mgmtReviews.map((r) => {
        if (r.id !== action.reviewId) return r
        return {
          ...r,
          actionItems: r.actionItems.map((it) =>
            it.id === action.itemId
              ? { ...it, status: 'completed' as const, completedAt: now, closureNote: action.closureNote }
              : it,
          ),
          updatedAt: now,
        }
      })
      return {
        ...state,
        mgmtReviews,
        auditLog: [makeAudit(action.actor, 'status_change', 'MgmtAction', action.itemId, 'Menutup tindak lanjut tinjauan manajemen'), ...state.auditLog],
      }
    }

    case 'UPDATE_MGMT_REVIEW_STATUS': {
      const now = new Date().toISOString().slice(0, 10)
      const mgmtReviews = state.mgmtReviews.map((r) => (r.id === action.reviewId ? { ...r, status: action.status, updatedAt: now } : r))
      return {
        ...state,
        mgmtReviews,
        auditLog: [makeAudit(action.actor, 'status_change', 'ManagementReview', action.reviewId, `Status tinjauan manajemen → ${action.status}`), ...state.auditLog],
      }
    }

    case 'ADD_GAP_FOLLOWUP': {
      const { input, actor } = action
      const followUp: GapFollowUp = {
        id: `gf-${Date.now()}`,
        gapId: input.gapId,
        type: input.type,
        pic: input.pic,
        deadline: input.deadline,
        action: input.action,
        reviewer: input.reviewer,
        status: 'open',
        createdAt: new Date().toISOString().slice(0, 10),
        createdBy: actor,
      }
      return {
        ...state,
        gapFollowUps: [followUp, ...state.gapFollowUps],
        auditLog: [
          makeAudit(actor, 'create', 'GapFollowUp', followUp.id, `Menambahkan tindak lanjut gap (PIC: ${followUp.pic})`),
          ...state.auditLog,
        ],
      }
    }

    case 'UPDATE_GAP_FOLLOWUP_STATUS': {
      let found: GapFollowUp | null = null
      const gapFollowUps = state.gapFollowUps.map((gf) => {
        if (gf.id !== action.followUpId) return gf
        found = gf
        return {
          ...gf,
          status: action.status,
          closedAt: action.status === 'closed' ? new Date().toISOString().slice(0, 10) : undefined,
        }
      })
      if (!found) return state
      return {
        ...state,
        gapFollowUps,
        auditLog: [
          makeAudit(action.actor, 'status_change', 'GapFollowUp', action.followUpId, `Status tindak lanjut gap → ${action.status}`),
          ...state.auditLog,
        ],
      }
    }

    case 'RESET_DEMO_DATA':
      return initialState()

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Code-generation helpers for the new modules — same YY-NNN convention as
// the document/request codes above.
// ---------------------------------------------------------------------------

function nextCodeFor<T extends { code: string }>(items: T[], prefix: string): string {
  const year = new Date().getFullYear()
  const fullPrefix = `${prefix}-${year}-`
  const maxN = items.reduce((max, it) => {
    if (!it.code.startsWith(fullPrefix)) return max
    const n = Number(it.code.split('-').pop())
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
  return `${fullPrefix}${String(maxN + 1).padStart(3, '0')}`
}

function nextRiskCode(risks: Risk[]): string {
  return nextCodeFor(risks, 'RSK')
}

function nextInternalAuditCode(audits: InternalAudit[]): string {
  return nextCodeFor(audits, 'IA')
}

function nextExternalAuditCode(audits: ExternalAudit[]): string {
  return nextCodeFor(audits, 'EA')
}

function nextFindingCode(findings: AuditFinding[]): string {
  return nextCodeFor(findings, 'FND')
}

function nextMgmtReviewCode(reviews: ManagementReview[]): string {
  return nextCodeFor(reviews, 'MR')
}
