import { Routes, Route } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import HomePage from './pages/HomePage'

export default function App() {
  return (
    <AuthGate>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </AuthGate>
  )
}
