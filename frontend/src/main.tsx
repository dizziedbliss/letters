import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import PageTransitionProvider from './components/transition/PageTransition'

// A tab left open across a deploy asks for page files that no longer exist.
// Reload once to pick up the new build (the flag stops a reload loop if it's really offline).
window.addEventListener('vite:preloadError', (e) => {
  if (sessionStorage.getItem('reloaded-for-deploy')) return
  sessionStorage.setItem('reloaded-for-deploy', '1')
  e.preventDefault()
  location.reload()
})
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('reloaded-for-deploy'), 10_000))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PageTransitionProvider>
        <App />
      </PageTransitionProvider>
    </BrowserRouter>
  </StrictMode>,
)
