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
