import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { DocumentRegister } from './pages/DocumentRegister'
import { DocumentDetail } from './pages/DocumentDetail'
import { NewDocument } from './pages/NewDocument'
import { ApprovalBoard } from './pages/ApprovalBoard'
import { TrackingList } from './pages/TrackingList'
import { TrackingDetail } from './pages/TrackingDetail'
import { NewDraftingRequest } from './pages/NewDraftingRequest'
import { Reporting } from './pages/Reporting'
import { UserManagement } from './pages/UserManagement'
import { MasterData } from './pages/MasterData'
import { AuditTrail } from './pages/AuditTrail'
import { RiskRegister } from './pages/RiskRegister'
import { InternalAudit } from './pages/InternalAudit'
import { ExternalAudit } from './pages/ExternalAudit'
import { Findings } from './pages/Findings'
import { ManagementReview } from './pages/ManagementReview'
import { RoadmapPage } from './pages/RoadmapPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/documents" element={<DocumentRegister />} />
        <Route path="/documents/new" element={<NewDocument />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/approval-board" element={<ApprovalBoard />} />
        <Route path="/tracking" element={<TrackingList />} />
        <Route path="/tracking/new" element={<NewDraftingRequest />} />
        <Route path="/tracking/:id" element={<TrackingDetail />} />
        <Route path="/reporting" element={<Reporting />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/master-data" element={<MasterData />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
        <Route path="/risk-register" element={<RiskRegister />} />
        <Route path="/internal-audit" element={<InternalAudit />} />
        <Route path="/external-audit" element={<ExternalAudit />} />
        <Route path="/findings" element={<Findings />} />
        <Route path="/management-review" element={<ManagementReview />} />
        <Route path="/roadmap/*" element={<RoadmapPage />} />
      </Routes>
    </Layout>
  )
}

export default App
