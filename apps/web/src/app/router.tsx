import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { LoginPage } from '@/pages/LoginPage.tsx'
import { RegisterPage } from '@/pages/RegisterPage.tsx'
import { ProjectsPage } from '@/pages/ProjectsPage.tsx'
import { AppShell } from '@/components/AppShell.tsx'

// The 3D editor and community feed are not needed for auth/project startup.
// Keep them out of the initial JS so the measured bundle can be split before
// any renderer/LOD optimisation is considered.
const CommunityPage = lazy(() => import('@/pages/CommunityPage.tsx').then((module) => ({ default: module.CommunityPage })))
const TemplatePreviewPage = lazy(() => import('@/pages/TemplatePreviewPage.tsx').then((module) => ({ default: module.TemplatePreviewPage })))
const EditorPage = lazy(() => import('@/pages/EditorPage.tsx').then((module) => ({ default: module.EditorPage })))
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage.tsx').then((module) => ({ default: module.AppointmentsPage })))
const AppointmentDetailPage = lazy(() => import('@/pages/AppointmentDetailPage.tsx').then((module) => ({ default: module.AppointmentDetailPage })))

function Protected({ children }: { children: React.ReactElement }) {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) return <div className="center">กำลังตรวจสอบสิทธิ์…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function GuestOnly({ children }: { children: React.ReactElement }) {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) return <div className="center">กำลังตรวจสอบสิทธิ์…</div>
  if (user) return <Navigate to="/projects" replace />
  return children
}

export function AppRouter() {
  return (
    <Suspense fallback={<div className="center">กำลังโหลดหน้า…</div>}>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route
          path="/projects"
          element={<Protected><AppShell><ProjectsPage /></AppShell></Protected>}
        />
        <Route
          path="/community"
          element={<Protected><AppShell><CommunityPage /></AppShell></Protected>}
        />
        <Route
          path="/community/templates/:templateId"
          element={<Protected><AppShell><TemplatePreviewPage /></AppShell></Protected>}
        />
        <Route
          path="/appointments"
          element={<Protected><AppShell><AppointmentsPage /></AppShell></Protected>}
        />
        <Route
          path="/appointments/:appointmentId"
          element={<Protected><AppShell><AppointmentDetailPage /></AppShell></Protected>}
        />
        <Route
          path="/editor/:projectId"
          element={<Protected><AppShell><EditorPage /></AppShell></Protected>}
        />
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<div className="center">ไม่พบหน้าที่ต้องการ</div>} />
      </Routes>
    </Suspense>
  )
}
