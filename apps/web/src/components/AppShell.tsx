import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser, useLogout } from '@/features/auth/useAuth.ts'
import { EditorProfileDropdown } from '@/features/design/EditorProfileDropdown.tsx'
import { NotificationBell } from './NotificationBell.tsx'
import { Icon } from './Icon.tsx'

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

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
  }

  return (
    <div className={`shell ${isEditor ? 'shell-editor' : ''}`}>
      {!isEditor && (
        <nav className="navbar">
          <Link to="/projects" className="brand">
            <span className="brand-mark"><Icon name="sparkle" size={16} strokeWidth={1.7} /></span>
            <span>Nail Studio <em>3D</em></span>
          </Link>
          <div className="navbar-right">
            <div className="navbar-links" aria-label="เมนูหลัก">
              <Link to="/community" className="navbar-link"><Icon name="users" size={16} />ชุมชน</Link>
              <Link to="/appointments" className="navbar-link"><Icon name="calendar" size={16} />การนัดหมาย</Link>
            </div>
            <NotificationBell />
            <EditorProfileDropdown
              user={user}
              isLoggingOut={logout.isPending}
              onLogout={handleLogout}
              onViewProfile={() => {
                if (user) navigate(`/users/${user.id}`)
              }}
            />
          </div>
        </nav>
      )}
      <main className="shell-main">{children}</main>
    </div>
  )
}
