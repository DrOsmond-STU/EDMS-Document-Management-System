import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const CompanyContext = createContext(null)

// Nama & logo perusahaan. Sengaja terpisah dari AuthContext dan dimuat lewat
// endpoint publik /api/company-settings (tanpa sesi) karena harus tampil di
// halaman login SEBELUM siapa pun masuk.
export function CompanyProvider({ children }) {
  const [company, setCompany] = useState({ name: 'DoGO', logo_url: null, loading: true })

  const refresh = useCallback(async () => {
    try {
      const data = await api('company-settings')
      setCompany({ ...data, loading: false })
    } catch {
      setCompany((c) => ({ ...c, loading: false }))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return <CompanyContext.Provider value={{ ...company, refresh }}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany harus dipakai di dalam CompanyProvider')
  return ctx
}
