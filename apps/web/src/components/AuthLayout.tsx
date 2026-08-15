import { useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthMode = 'login' | 'register'

interface AuthLayoutProps {
  active: AuthMode
  children: ReactNode
}
export function AuthLayout({ active, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <header className="auth-heading">
        <h1>Welcome</h1>
        <div className="auth-heading-subtitle">
          <span aria-hidden="true" />
          <em>Nail Design</em>
          <span aria-hidden="true" />
        </div>
      </header>

      <section className="auth-card">
        <nav className="auth-switch" aria-label="Authentication">
          <Link
            to="/login"
            className={active === 'login' ? 'is-active' : undefined}
            aria-current={active === 'login' ? 'page' : undefined}
          >
            Log In
          </Link>
          <Link
            to="/register"
            className={active === 'register' ? 'is-active' : undefined}
            aria-current={active === 'register' ? 'page' : undefined}
          >
            Sign Up
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
  minLength?: number
}

export function AuthPasswordField({
  id,
  label,
  value,
  autoComplete,
  onChange,
  minLength,
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
          onChange={onChange}
        />
        <button
          type="button"
          className="auth-password-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
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
    </div>
  )
}
