import { Routes, Route, useNavigate } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import SorryUpdating from './pages/SorryUpdating'
import LettersPage from './pages/LettersPage'
import ProtectedRoute from './components/common/ProtectedRoute'

function App() {
  const navigate = useNavigate()

  const handleUnlock = (code: string) => {
    console.log('Secret code unlocked:', code)
    navigate('/letters')
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