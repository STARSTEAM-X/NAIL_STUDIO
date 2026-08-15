import { Navigate, Route, Routes } from 'react-router-dom'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { LoginPage } from '@/pages/LoginPage.tsx'
import { RegisterPage } from '@/pages/RegisterPage.tsx'
import { ProjectsPage } from '@/pages/ProjectsPage.tsx'
import { CommunityPage } from '@/pages/CommunityPage.tsx'
import { EditorPage } from '@/pages/EditorPage.tsx'
import { AppShell } from '@/components/AppShell.tsx'

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
        path="/editor/:projectId"
        element={<Protected><AppShell><EditorPage /></AppShell></Protected>}
      />
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<div className="center">ไม่พบหน้าที่ต้องการ</div>} />
    </Routes>
  )
}
