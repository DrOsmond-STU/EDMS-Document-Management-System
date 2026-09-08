import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { CompanyProvider } from './CompanyContext'
import { LicenseGate } from './components/LicenseGate'
import App from './App'
import '../css/app.css'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <BrowserRouter>
      <LicenseGate>
        <CompanyProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </CompanyProvider>
      </LicenseGate>
    </BrowserRouter>
  </StrictMode>,
)
