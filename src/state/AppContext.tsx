import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
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
  RoleId,
  Standard,
  User,
  ValidityStatus,
} from '../types'
import { DOCUMENT_STATUS_ORDER, DRAFTING_STAGE_ORDER } from '../types'
import { DOCUMENT_TYPE_CODE } from '../constants'
import { AUDIT_LOG, DOCUMENTS, DRAFTING_PROJECTS, FUNCTIONS, NOTIFICATIONS, REVISIONS, STANDARDS, USERS } from '../data/seed'

const STORAGE_KEY = 'edms.prototype.state.v1'

interface AppState {
  documents: EdmsDocument[]
  revisions: Revision[]
  draftingProjects: DraftingProject[]
  notifications: AppNotification[]
  auditLog: AuditLogEntry[]
  functions: FunctionDept[]
  standards: Standard[]
  users: User[]
  currentUserId: string
  currentRoleId: RoleId
}

function initialState(): AppState {
  return {
    documents: DOCUMENTS,
    revisions: REVISIONS,
    draftingProjects: DRAFTING_PROJECTS,
    notifications: NOTIFICATIONS,
    auditLog: AUDIT_LOG,
    functions: FUNCTIONS,
    standards: STANDARDS,
    users: USERS,
    currentUserId: 'u4',
    currentRoleId: 'controller',
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.documents || !parsed.users) return initialState()
    return parsed
  } catch {
    return initialState()
  }
}

type Action =
  | { type: 'SET_USER'; userId: string }
  | { type: 'SET_ROLE'; roleId: RoleId }
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

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUserId: action.userId }
    case 'SET_ROLE':
      return { ...state, currentRoleId: action.roleId }

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
      const doc = documents.find((d) => d.id === documentId)!
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
      const toggledUser = users.find((u) => u.id === action.userId)!
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

interface AppContextValue {
  state: AppState
  currentUser: User
  setCurrentUser: (userId: string) => void
  setCurrentRole: (roleId: RoleId) => void
  createDocument: (input: NewDocumentInput) => void
  transitionDocument: (documentId: string, toStatus: DocumentStatus, note?: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  addFunction: (dept: FunctionDept) => void
  addStandard: (standard: Standard) => void
  addUser: (user: User) => void
  toggleUserActive: (userId: string) => void
  createDraftingRequest: (input: NewDraftingRequestInput) => void
  addMeeting: (projectId: string, meeting: Omit<MeetingRecord, 'id'>) => void
  setFinalizedContent: (projectId: string, content: string) => void
  advanceStage: (projectId: string) => void
  resetDemoData: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      currentUser,
      setCurrentUser: (userId) => dispatch({ type: 'SET_USER', userId }),
      setCurrentRole: (roleId) => dispatch({ type: 'SET_ROLE', roleId }),
      createDocument: (input) => dispatch({ type: 'CREATE_DOCUMENT', input, actor: currentUser.name }),
      transitionDocument: (documentId, toStatus, note) =>
        dispatch({ type: 'TRANSITION_STATUS', documentId, toStatus, actor: currentUser.name, note }),
      markNotificationRead: (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', id }),
      markAllNotificationsRead: () => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
      addFunction: (dept) => dispatch({ type: 'ADD_FUNCTION', dept, actor: currentUser.name }),
      addStandard: (standard) => dispatch({ type: 'ADD_STANDARD', standard, actor: currentUser.name }),
      addUser: (user) => dispatch({ type: 'ADD_USER', user, actor: currentUser.name }),
      toggleUserActive: (userId) => dispatch({ type: 'TOGGLE_USER_ACTIVE', userId, actor: currentUser.name }),
      createDraftingRequest: (input) => dispatch({ type: 'CREATE_DRAFTING_REQUEST', input, actor: currentUser.name }),
      addMeeting: (projectId, meeting) => dispatch({ type: 'ADD_MEETING', projectId, meeting, actor: currentUser.name }),
      setFinalizedContent: (projectId, content) => dispatch({ type: 'SET_FINALIZED_CONTENT', projectId, content, actor: currentUser.name }),
      advanceStage: (projectId) => dispatch({ type: 'ADVANCE_STAGE', projectId, actor: currentUser.name }),
      resetDemoData: () => dispatch({ type: 'RESET_DEMO_DATA' }),
    }),
    [state, currentUser],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { DOCUMENT_STATUS_ORDER }
