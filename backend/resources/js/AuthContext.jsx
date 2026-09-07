import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, ApiError } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // 'loading' | 'guest' | 'must_change_password' | 'ready'
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const me = await api('auth/me')
      setUser(me)
      setStatus(me.must_change_password ? 'must_change_password' : 'ready')
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setUser(null)
        setStatus('guest')
      } else {
        throw e
      }
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (email, password) => {
    const me = await api('auth/login', { method: 'POST', body: { email, password } })
    setUser(me)
    setStatus(me.must_change_password ? 'must_change_password' : 'ready')
  }, [])

  const logout = useCallback(async () => {
    try { await api('auth/logout', { method: 'POST' }) } catch { /* tetap keluar di sisi klien */ }
    setUser(null)
    setStatus('guest')
  }, [])

  const changePassword = useCallback(async (currentPassword, password, passwordConfirmation) => {
    const me = await api('auth/change-password', {
      method: 'POST',
      body: { current_password: currentPassword, password, password_confirmation: passwordConfirmation },
    })
    setUser(me)
    setStatus('ready')
  }, [])

  const hasPermission = useCallback((perm) => user?.permissions?.includes(perm) ?? false, [user])

  return (
    <AuthContext.Provider value={{ status, user, login, logout, changePassword, hasPermission, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return ctx
}
