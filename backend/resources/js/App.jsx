import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import SettingsPage from './pages/SettingsPage'
import NumberingSettingsPage from './pages/NumberingSettingsPage'
import AuditTrailPage from './pages/AuditTrailPage'
import UsersPage from './pages/UsersPage'

function FullScreenMessage({ text }) {
  return <div className="flex min-h-screen w-full items-center justify-center text-[13px] text-[var(--color-neutral-medium)]">{text}</div>
}

export default function App() {
  const { status } = useAuth()

  if (status === 'loading') return <FullScreenMessage text="Memuat…" />
  if (status === 'guest') return <LoginPage />
  if (status === 'must_change_password') return <ChangePasswordPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/documents" replace />} />
      <Route path="/documents" element={<DocumentsPage />} />
      <Route path="/documents/:id" element={<DocumentDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/numbering" element={<NumberingSettingsPage />} />
      <Route path="/audit-trail" element={<AuditTrailPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="*" element={<Navigate to="/documents" replace />} />
    </Routes>
  )
}
