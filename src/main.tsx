import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Root from './Root.tsx'

// A page restored from the back/forward cache is a frozen snapshot — possibly
// of a workspace whose owner has since signed out. Never show it: reload, so
// the session is checked again before anything private renders.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && window.location.pathname.startsWith('/app')) window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
