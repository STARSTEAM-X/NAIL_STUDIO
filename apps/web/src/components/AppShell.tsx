import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser, useLogout } from '@/features/auth/useAuth.ts'
import { NotificationBell } from './NotificationBell.tsx'

/**
 * โครงหน้าเว็บที่ใช้ร่วมกันทุกหน้าที่ล็อกอินแล้ว
 * ภาษาการออกแบบยกมาจาก CEPP-KMITL-68-NailStudio (docs/source-audit.md §2.3)
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditor = location.pathname === '/editor' || location.pathname.startsWith('/editor/')

  return (
    <div className={`shell ${isEditor ? 'shell-editor' : ''}`}>
      {!isEditor && (
        <nav className="navbar">
          <Link to="/projects" className="brand">Nail Studio <span>3D</span></Link>
          <div className="navbar-right">
            <Link to="/community" className="navbar-link">ชุมชน</Link>
            <Link to="/appointments" className="navbar-link">การนัดหมาย</Link>
            <NotificationBell />
            {user && <span className="user-name">{user.displayName}</span>}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
              }}
            >
              ออกจากระบบ
            </button>
          </div>
        </nav>
      )}
      <main className="shell-main">{children}</main>
    </div>
  )
}
