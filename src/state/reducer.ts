// Pure, portable state logic shared by the browser (via AppContext) and the
// Vercel API routes under /api. No browser globals (localStorage, window) may
// be used here — this file also runs server-side under Node.

import type {
  AppNotification,
  AuditAction,
  AuditLogEntry,
  ClassificationLevel,
  DocumentStatus,
  DocumentType,
  DraftingProject,
  DraftingStage,
  EdmsDocument,
  FunctionDept,
  MeetingRecord,
  Revision,
  Standard,
  User,
  ValidityStatus,
} from '../types'
import { DRAFTING_STAGE_ORDER } from '../types'
import { DOCUMENT_TYPE_CODE } from '../constants'
import { AUDIT_LOG, DOCUMENTS, DRAFTING_PROJECTS, FUNCTIONS, NOTIFICATIONS, REVISIONS, STANDARDS, USERS } from '../data/seed'

export interface SharedState {
  documents: EdmsDocument[]
  revisions: Revision[]
  draftingProjects: DraftingProject[]
  notifications: AppNotification[]
  auditLog: AuditLogEntry[]
  functions: FunctionDept[]
  standards: Standard[]
  users: User[]
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
  }
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
  | { type: 'CREATE_DRAFTING_REQUEST'; input: NewDraftingRequestInput; actor: string }
  | { type: 'ADD_MEETING'; projectId: string; meeting: Omit<MeetingRecord, 'id'>; actor: string }
  | { type: 'SET_FINALIZED_CONTENT'; projectId: string; content: string; actor: string }
  | { type: 'ADVANCE_STAGE'; projectId: string; actor: string }
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
  'CREATE_DRAFTING_REQUEST',
  'ADD_MEETING',
  'SET_FINALIZED_CONTENT',
  'ADVANCE_STAGE',
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

    case 'RESET_DEMO_DATA':
      return initialState()

    default:
      return state
  }
}
