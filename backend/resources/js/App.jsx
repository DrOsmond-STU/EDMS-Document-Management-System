import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Layout } from './components/Layout'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

/**
 * Halaman dimuat per rute (code-splitting) supaya pengguna tidak mengunduh
 * seluruh modul di awal. Jika berkas chunk gagal dimuat — biasanya karena
 * tab sudah terbuka sebelum deploy baru dan nama berkas lama sudah tidak
 * ada — muat ulang halaman SEKALI untuk mengambil versi terbaru.
 */
function page(loader) {
  return lazy(() => loader().then(
    (mod) => { sessionStorage.removeItem('chunk-reload'); return mod },
    (err) => {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1')
        window.location.reload()
        return new Promise(() => {})
      }
      throw err
    },
  ))
}

const DashboardPage = page(() => import('./pages/DashboardPage'))
const DocumentsPage = page(() => import('./pages/DocumentsPage'))
const DocumentDetailPage = page(() => import('./pages/DocumentDetailPage'))
const SettingsPage = page(() => import('./pages/SettingsPage'))
const NumberingSettingsPage = page(() => import('./pages/NumberingSettingsPage'))
const AuditTrailPage = page(() => import('./pages/AuditTrailPage'))
const UsersPage = page(() => import('./pages/UsersPage'))
const MasterDataPage = page(() => import('./pages/MasterDataPage'))
const ComplianceMatrixPage = page(() => import('./pages/ComplianceMatrixPage'))
const RegisterRisikoPage = page(() => import('./pages/RegisterRisikoPage'))
const RegisterTemuanCapaPage = page(() => import('./pages/RegisterTemuanCapaPage'))
const ApprovalBoardPage = page(() => import('./pages/ApprovalBoardPage'))
const IntegrationsPage = page(() => import('./pages/IntegrationsPage'))
const AuditProgramPage = page(() => import('./pages/AuditProgramPage'))
const MgmtReviewPage = page(() => import('./pages/MgmtReviewPage'))
const LegalRegisterPage = page(() => import('./pages/LegalRegisterPage'))
const RecordsRegisterPage = page(() => import('./pages/RecordsRegisterPage'))
const RetentionArchivePage = page(() => import('./pages/RetentionArchivePage'))
const FoldersPage = page(() => import('./pages/FoldersPage'))
const DraftingListPage = page(() => import('./pages/DraftingListPage'))
const DraftingDetailPage = page(() => import('./pages/DraftingDetailPage'))
const ReportingPage = page(() => import('./pages/ReportingPage'))
const DiscussionsPage = page(() => import('./pages/DiscussionsPage'))
const SystemAdminPage = page(() => import('./pages/SystemAdminPage'))
const KnowledgePage = page(() => import('./pages/KnowledgePage'))
const AiAssistantPage = page(() => import('./pages/AiAssistantPage'))

function FullScreenMessage({ text }) {
  return <div className="flex min-h-screen w-full items-center justify-center text-[13px] text-[var(--color-neutral-medium)]">{text}</div>
}

/** Fallback di DALAM Layout — sidebar & topbar tetap tampil selama chunk halaman dimuat. */
function PageLoading() {
  return <Layout><p className="text-[13px] text-[var(--color-neutral-medium)]">Memuat…</p></Layout>
}

export default function App() {
  const { status } = useAuth()

  if (status === 'loading') return <FullScreenMessage text="Memuat…" />
  if (status === 'guest') return <LoginPage />
  if (status === 'must_change_password') return <ChangePasswordPage />

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/numbering" element={<NumberingSettingsPage />} />
        <Route path="/audit-trail" element={<AuditTrailPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/master-data" element={<MasterDataPage />} />
        <Route path="/compliance-matrix" element={<ComplianceMatrixPage />} />
        <Route path="/risk-register" element={<RegisterRisikoPage />} />
        <Route path="/findings" element={<RegisterTemuanCapaPage />} />
        <Route path="/approval-board" element={<ApprovalBoardPage />} />
        <Route path="/audit-internal" element={<AuditProgramPage type="internal" />} />
        <Route path="/audit-external" element={<AuditProgramPage type="external" />} />
        <Route path="/management-review" element={<MgmtReviewPage />} />
        <Route path="/legal-register" element={<LegalRegisterPage />} />
        <Route path="/records" element={<RecordsRegisterPage />} />
        <Route path="/retention" element={<RetentionArchivePage />} />
        <Route path="/folders" element={<FoldersPage />} />
        <Route path="/drafting" element={<DraftingListPage />} />
        <Route path="/drafting/:id" element={<DraftingDetailPage />} />
        <Route path="/reporting" element={<ReportingPage />} />
        <Route path="/discussions" element={<DiscussionsPage />} />
        <Route path="/system" element={<SystemAdminPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/assistant" element={<AiAssistantPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
