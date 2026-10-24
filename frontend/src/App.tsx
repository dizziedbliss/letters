import { Suspense, type ReactElement } from 'react'
import { Routes, Route } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import ProtectedRoute from './components/common/ProtectedRoute'
import { usePageTransition } from './components/transition/context'
import { pages } from './routes'
import { ErrorBoundary } from './components/common/ErrorBoundary'

// Same blank as ProtectedRoute's "checking" screen, so a page loading never flashes
const Blank = () => <div className="min-h-dvh bg-[#151515]" />

function App() {
  const { go } = usePageTransition()
  const guard = (el: ReactElement) => <ProtectedRoute>{el}</ProtectedRoute>

  return (
    <ErrorBoundary>
      <Suspense fallback={<Blank />}>
        <Routes>
          <Route path="/" element={<LandingPage onUnlock={() => go('/home', { label: 'Welcome', code: '00' })} />} />
          <Route path="/home" element={guard(<pages.home />)} />
          <Route path="/letters" element={guard(<pages.intro />)} />
          <Route path="/lettersPage" element={guard(<pages.letters />)} />
          <Route path="/letters/read/:id" element={guard(<pages.read />)} />
          <Route path="/write/intro" element={guard(<pages.builder />)} />
          <Route path="/write" element={guard(<pages.write />)} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
