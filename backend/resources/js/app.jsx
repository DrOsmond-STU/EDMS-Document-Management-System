import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { CompanyProvider } from './CompanyContext'
import App from './App'
import '../css/app.css'

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </CompanyProvider>
    </BrowserRouter>
  </StrictMode>,
)
