import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { AuthLayout, AuthPasswordField } from '@/components/AuthLayout.tsx'
import { useLogin } from '@/features/auth/useAuth.ts'

export function LoginPage() {
  const login = useLogin()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    login.mutate(
      { email, password },
      { onSuccess: () => navigate('/projects', { replace: true }) },
    )
  }

  const message =
    login.error instanceof ApiRequestError
      ? login.error.message
      : login.error
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
        : null

  return (
    <AuthLayout active="login">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <AuthPasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {message && <p className="error auth-message" role="alert">{message}</p>}

        <button type="submit" className="auth-submit" disabled={login.isPending}>
          {login.isPending ? 'Submitting…' : 'Submit'}
        </button>

        <button
          type="button"
          className="auth-inline-link"
          onClick={() => setNotice('Password reset is not available yet.')}
        >
          Forgot Password?
        </button>

        <div className="auth-divider" aria-hidden="true"><span>or</span></div>

        <button
          type="button"
          className="auth-google"
          aria-label="Continue with Google"
          onClick={() => setNotice('Google sign-in is not available yet.')}
        >
          <span aria-hidden="true">G</span>
        </button>

        {notice && <p className="auth-note" role="status">{notice}</p>}
      </form>
    </AuthLayout>
  )
}
