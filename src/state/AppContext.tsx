import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  DocumentStatus,
  FunctionDept,
  MeetingRecord,
  RoleId,
  Standard,
  User,
} from '../types'
import { DOCUMENT_STATUS_ORDER } from '../types'
import type { Action, NewDocumentInput, NewDraftingRequestInput, SharedState } from './reducer'
import { LoginGate } from '../components/LoginGate'

const ROLE_STORAGE_KEY = 'edms.prototype.role.v1'

interface RoleSelection {
  currentUserId: string
  currentRoleId: RoleId
}

const DEFAULT_ROLE_SELECTION: RoleSelection = { currentUserId: 'u4', currentRoleId: 'controller' }

function loadRoleSelection(): RoleSelection {
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY)
    if (!raw) return DEFAULT_ROLE_SELECTION
    const parsed = JSON.parse(raw) as Partial<RoleSelection>
    if (!parsed.currentUserId || !parsed.currentRoleId) return DEFAULT_ROLE_SELECTION
    return { currentUserId: parsed.currentUserId, currentRoleId: parsed.currentRoleId }
  } catch {
    return DEFAULT_ROLE_SELECTION
  }
}

// Shape kept identical to the pre-database AppState so every existing page
// component (which reads state.currentUserId / state.currentRoleId) keeps
// working unchanged. Only documents/users/etc. are actually persisted server
// side — currentUserId/currentRoleId are a local "who am I demoing as" pick,
// merged back in below so the shape matches.
interface AppState extends SharedState {
  currentUserId: string
  currentRoleId: RoleId
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

type Status = 'loading' | 'unauth' | 'ready' | 'error'

function FullScreenMessage({ title, detail, retry }: { title: string; detail: string; retry?: () => void }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-2 bg-[#fafaf8] px-6 text-center">
      <div className="text-sm font-bold text-[var(--color-neutral-dark)]">{title}</div>
      <p className="max-w-sm text-xs text-[var(--color-neutral-medium)]">{detail}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-2 rounded-md bg-[var(--color-brand-primary)] px-3 py-1.5 text-[13px] font-semibold text-white hover:brightness-110"
        >
          Coba Lagi
        </button>
      )}
    </div>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [sharedState, setSharedState] = useState<SharedState | null>(null)
  const [role, setRole] = useState<RoleSelection>(loadRoleSelection)

  const loadState = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/state')
      if (res.status === 401) {
        setStatus('unauth')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setErrorMessage(body?.error ?? `Gagal memuat data (HTTP ${res.status}).`)
        setStatus('error')
        return
      }
      const body = (await res.json()) as { state: SharedState }
      setSharedState(body.state)
      setStatus('ready')
    } catch {
      setErrorMessage('Tidak dapat menghubungi server. Periksa koneksi Anda.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState])

  useEffect(() => {
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(role))
  }, [role])

  const dispatch = useCallback(async (action: Action) => {
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.status === 401) {
        setStatus('unauth')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        console.error('dispatch failed', body?.error)
        window.alert(body?.error ?? 'Gagal menyimpan perubahan.')
        return
      }
      const body = (await res.json()) as { state: SharedState }
      setSharedState(body.state)
    } catch {
      window.alert('Tidak dapat menghubungi server. Periksa koneksi Anda.')
    }
  }, [])

  const state = useMemo<AppState | null>(() => {
    if (!sharedState) return null
    return { ...sharedState, currentUserId: role.currentUserId, currentRoleId: role.currentRoleId }
  }, [sharedState, role])

  const currentUser = useMemo(() => {
    if (!state) return undefined
    return state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]
  }, [state])

  const value = useMemo<AppContextValue | null>(() => {
    if (!state || !currentUser) return null
    return {
      state,
      currentUser,
      setCurrentUser: (userId) => {
        const nextUser = state.users.find((u) => u.id === userId)
        setRole({ currentUserId: userId, currentRoleId: nextUser?.roles[0] ?? role.currentRoleId })
      },
      setCurrentRole: (roleId) => setRole((r) => ({ ...r, currentRoleId: roleId })),
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
      setFinalizedContent: (projectId, content) =>
        dispatch({ type: 'SET_FINALIZED_CONTENT', projectId, content, actor: currentUser.name }),
      advanceStage: (projectId) => dispatch({ type: 'ADVANCE_STAGE', projectId, actor: currentUser.name }),
      resetDemoData: () => dispatch({ type: 'RESET_DEMO_DATA' }),
    }
  }, [state, currentUser, role, dispatch])

  if (status === 'loading') {
    return <FullScreenMessage title="Memuat…" detail="Menghubungi server EDMS." />
  }
  if (status === 'unauth') {
    return <LoginGate onSuccess={loadState} />
  }
  if (status === 'error' || !value) {
    return <FullScreenMessage title="Terjadi kesalahan" detail={errorMessage} retry={loadState} />
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { DOCUMENT_STATUS_ORDER }
