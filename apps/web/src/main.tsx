import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './app/providers.tsx'
import { AppRouter } from './app/router.tsx'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('ไม่พบ #root ใน index.html')

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
)

const splash = document.getElementById('boot-splash')
if (splash) {
  const removeSplash = () => {
    if (splash.isConnected) splash.remove()
  }

  // กัน transitionend ไม่ยิงเมื่อผู้ใช้เปิด reduced-motion
  setTimeout(removeSplash, 500)
  requestAnimationFrame(() => {
    if (!splash.isConnected) return
    splash.style.opacity = '0'
    splash.addEventListener('transitionend', removeSplash, { once: true })
  })
}
