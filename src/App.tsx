import { Routes, Route } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import HomePage from './pages/HomePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'

export default function App() {
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route
        path="/*"
        element={
          <AuthGate>
            <Routes>
              <Route path="/" element={<HomePage />} />
            </Routes>
          </AuthGate>
        }
      />
    </Routes>
  )
}
