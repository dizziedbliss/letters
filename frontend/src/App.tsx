import { Routes, Route, useNavigate } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import SorryUpdating from './pages/SorryUpdating'
import LettersPage from './pages/LettersPage'
import ProtectedRoute from './components/common/ProtectedRoute'
import AdminRoute from './components/common/AdminRoute'
import AdminPage from './pages/AdminPage'

function App() {
  const navigate = useNavigate()

  const handleUnlock = (_code: string, role: 'guest' | 'admin') => {
    navigate(role === 'admin' ? '/admin' : '/letters')
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage onUnlock={handleUnlock} />} />
      <Route
        path="/letters"
        element={
          <ProtectedRoute>
            <SorryUpdating />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/lettersPage"
        element={
          <ProtectedRoute>
            <LettersPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App