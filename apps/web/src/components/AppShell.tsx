import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser, useLogout } from '@/features/auth/useAuth.ts'
import { EditorProfileDropdown } from '@/features/design/EditorProfileDropdown.tsx'
import { isShop } from '@/lib/user.ts'
import { NotificationBell } from './NotificationBell.tsx'
import { Icon, type IconName } from './Icon.tsx'

interface NavItem {
  to: string
  label: string
  icon: IconName
}

/**
 * โครงหน้าเว็บที่ใช้ร่วมกันทุกหน้าที่ล็อกอินแล้ว
 *
 * เมนูหลักมีสี่รายการเสมอ รวมถึง "งานของฉัน" ซึ่งเดิมเข้าถึงได้ทางเดียวคือ
 * คลิกโลโก้แบรนด์ — ทางเข้าที่ผู้ใช้เดาไม่ได้ทั้งที่เป็นหน้าแรกหลังล็อกอิน
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const isEditor = location.pathname === '/editor' || location.pathname.startsWith('/editor/')

  // ปิดเมนูมือถือเมื่อเปลี่ยนหน้า ไม่งั้นมันค้างทับเนื้อหาหน้าใหม่
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const navItems: NavItem[] = [
    { to: '/projects', label: 'งานของฉัน', icon: 'folder' },
    { to: '/community', label: 'ชุมชน', icon: 'users' },
    isShop(user)
      ? { to: '/shop/manage', label: 'จัดการร้าน', icon: 'palette' }
      : { to: '/shops', label: 'ร้านทำเล็บ', icon: 'compass' },
    { to: '/appointments', label: 'การนัดหมาย', icon: 'calendar' },
  ]

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
  }

  return (
    <div className={`shell ${isEditor ? 'shell-editor' : ''}`}>
      {!isEditor && (
        <>
          <a href="#main-content" className="ui-skip-link">ข้ามไปยังเนื้อหาหลัก</a>
          <nav className="navbar">
            <Link to="/projects" className="brand">
              <span className="brand-mark"><Icon name="sparkle" size={16} strokeWidth={1.7} /></span>
              <span>Nail Studio <em>3D</em></span>
            </Link>

            <div className="navbar-links" aria-label="เมนูหลัก">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `navbar-link ${isActive ? 'navbar-link-active' : ''}`}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="navbar-right">
              <NotificationBell />
              <EditorProfileDropdown
                user={user}
                isLoggingOut={logout.isPending}
                onLogout={handleLogout}
                onViewProfile={() => {
                  if (user) navigate(`/users/${user.id}`)
                }}
              />
              <button
                type="button"
                className="navbar-menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Icon name={menuOpen ? 'x' : 'rows'} size={18} />
              </button>
            </div>
          </nav>

          {/* เมนูมือถือแสดงชื่อรายการจริง ของเดิมย่อเหลือแต่ไอคอนด้วย font-size: 0 */}
          <div id="mobile-nav" className={`navbar-mobile ${menuOpen ? 'navbar-mobile-open' : ''}`} hidden={!menuOpen}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `navbar-mobile-link ${isActive ? 'navbar-link-active' : ''}`}
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </>
      )}
      <main className="shell-main" id="main-content">{children}</main>
    </div>
  )
}
