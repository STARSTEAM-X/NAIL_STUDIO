import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { LoginPage } from '@/pages/LoginPage.tsx'
import { RegisterPage } from '@/pages/RegisterPage.tsx'
import { ProjectsPage } from '@/pages/ProjectsPage.tsx'
import { PublicProfilePage } from '@/pages/PublicProfilePage.tsx'
import { NotFoundPage } from '@/pages/NotFoundPage.tsx'
import { AppShell } from '@/components/AppShell.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary.tsx'
import { ListSkeleton } from '@/components/ui/States.tsx'

// The 3D editor and community feed are not needed for auth/project startup.
// Keep them out of the initial JS so the measured bundle can be split before
// any renderer/LOD optimisation is considered.
const CommunityPage = lazy(() => import('@/pages/CommunityPage.tsx').then((module) => ({ default: module.CommunityPage })))
const TemplatePreviewPage = lazy(() => import('@/pages/TemplatePreviewPage.tsx').then((module) => ({ default: module.TemplatePreviewPage })))
const EditorPage = lazy(() => import('@/pages/EditorPage.tsx').then((module) => ({ default: module.EditorPage })))
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage.tsx').then((module) => ({ default: module.AppointmentsPage })))
const AppointmentDetailPage = lazy(() => import('@/pages/AppointmentDetailPage.tsx').then((module) => ({ default: module.AppointmentDetailPage })))
const ShopsPage = lazy(() => import('@/pages/ShopsPage.tsx').then((module) => ({ default: module.ShopsPage })))
const ShopDetailPage = lazy(() => import('@/pages/ShopDetailPage.tsx').then((module) => ({ default: module.ShopDetailPage })))
const ShopManagePage = lazy(() => import('@/pages/ShopManagePage.tsx').then((module) => ({ default: module.ShopManagePage })))
const ModerationPage = lazy(() => import('@/pages/ModerationPage.tsx').then((module) => ({ default: module.ModerationPage })))

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

/** จำกัดหน้าไว้เฉพาะบทบาทที่ backend ก็ตรวจซ้ำอีกชั้น — UI ซ่อนไว้เพื่อไม่ให้เข้าไปเจอ 403 เปล่าๆ */
function RoleOnly({ role, children }: { role: 'shop' | 'admin'; children: React.ReactElement }) {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) return <div className="center">กำลังตรวจสอบสิทธิ์…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/projects" replace />
  return children
}

/** ห่อทุกหน้าด้วย shell + error boundary ชุดเดียวกัน แทนที่จะเขียนซ้ำทุก route */
function Page({ children }: { children: React.ReactElement }) {
  return (
    <Protected>
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </Protected>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<div className="page"><ListSkeleton count={2} lines={4} /></div>}>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

        <Route path="/projects" element={<Page><ProjectsPage /></Page>} />
        <Route path="/users/:userId" element={<Page><PublicProfilePage /></Page>} />
        <Route path="/community" element={<Page><CommunityPage /></Page>} />
        <Route path="/community/templates/:templateId" element={<Page><TemplatePreviewPage /></Page>} />

        <Route path="/shops" element={<Page><ShopsPage /></Page>} />
        <Route path="/shops/:shopId" element={<Page><ShopDetailPage /></Page>} />
        <Route
          path="/shop/manage"
          element={
            <Protected>
              <AppShell>
                <ErrorBoundary>
                  <RoleOnly role="shop"><ShopManagePage /></RoleOnly>
                </ErrorBoundary>
              </AppShell>
            </Protected>
          }
        />

        <Route path="/appointments" element={<Page><AppointmentsPage /></Page>} />
        <Route path="/appointments/:appointmentId" element={<Page><AppointmentDetailPage /></Page>} />

        <Route
          path="/admin/reports"
          element={
            <Protected>
              <AppShell>
                <ErrorBoundary>
                  <RoleOnly role="admin"><ModerationPage /></RoleOnly>
                </ErrorBoundary>
              </AppShell>
            </Protected>
          }
        />

        <Route path="/editor/:projectId" element={<Page><EditorPage /></Page>} />

        {/* /profile ถูกรวมเข้ากับโปรไฟล์สาธารณะแล้ว — ลิงก์เก่ายังต้องพาไปที่ถูก */}
        <Route path="/profile" element={<Protected><ProfileRedirect /></Protected>} />

        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="*" element={<Page><NotFoundPage /></Page>} />
      </Routes>
    </Suspense>
  )
}

function ProfileRedirect() {
  const { data: user } = useCurrentUser()
  return <Navigate to={user ? `/users/${user.id}?edit=1` : '/login'} replace />
}
