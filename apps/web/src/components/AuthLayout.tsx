import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthMode = 'login' | 'register'

interface AuthLayoutProps {
  active: AuthMode
  /** หัวข้อของหน้า — ต้องต่างกันระหว่างเข้าสู่ระบบกับสมัครสมาชิก ไม่ใช่ "Welcome" เหมือนกันทั้งคู่ */
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthLayout({ active, title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <header className="auth-heading">
        <h1>{title}</h1>
        <div className="auth-heading-subtitle">
          <span aria-hidden="true" />
          <em>Nail Studio 3D</em>
          <span aria-hidden="true" />
        </div>
        <p className="auth-subtitle">{subtitle}</p>
      </header>

      <section className="auth-card">
        <nav className="auth-switch" aria-label="เข้าสู่ระบบหรือสมัครสมาชิก">
          <Link
            to="/login"
            className={active === 'login' ? 'is-active' : undefined}
            aria-current={active === 'login' ? 'page' : undefined}
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            to="/register"
            className={active === 'register' ? 'is-active' : undefined}
            aria-current={active === 'register' ? 'page' : undefined}
          >
            สมัครสมาชิก
          </Link>
        </nav>
        {children}
      </section>
    </main>
  )
}

interface AuthPasswordFieldProps {
  id: string
  label: string
  value: string
  autoComplete: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  minLength?: number | undefined
  /** เกณฑ์ของรหัสผ่าน — บอกตั้งแต่แรก ไม่ใช่ให้ผู้ใช้รู้ตอนถูกปฏิเสธ */
  hint?: string | undefined
}

export function AuthPasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
  minLength,
  hint,
}: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-shell">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={onChange}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          onClick={() => setVisible((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {visible ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c5.2 0 8.5 5 8.5 5a16 16 0 0 1-3.1 3.4M6.2 6.2C3.8 7.8 2.5 10 2.5 10s3.3 5 9.5 5c.8 0 1.6-.1 2.3-.3" />
              </>
            ) : (
              <>
                <path d="M2.5 12S5.8 7 12 7s9.5 5 9.5 5-3.3 5-9.5 5-9.5-5-9.5-5Z" />
                <circle cx="12" cy="12" r="2.2" />
              </>
            )}
          </svg>
        </button>
      </div>
      {hint && <p className="auth-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  )
}
