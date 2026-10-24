import { Routes, Route } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import SorryUpdating from './pages/SorryUpdating'
import LettersPage from './pages/LettersPage'
import WritePage from './pages/WritePage'
import HomePage from './pages/HomePage'
import IntroEditPage from './pages/IntroEditPage'
import ProtectedRoute from './components/common/ProtectedRoute'
import { usePageTransition } from './components/transition/context'

function App() {
  const { go } = usePageTransition()

  return (
    <Routes>
      <Route path="/" element={<LandingPage onUnlock={() => go('/home', { label: 'Welcome', code: '00' })} />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/write/intro"
        element={
          <ProtectedRoute>
            <IntroEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/write"
        element={
          <ProtectedRoute>
            <WritePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
