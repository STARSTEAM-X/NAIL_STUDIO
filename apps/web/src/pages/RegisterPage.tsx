import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { AuthLayout, AuthPasswordField } from '@/components/AuthLayout.tsx'
import { useRegister } from '@/features/auth/useAuth.ts'

const MIN_PASSWORD_LENGTH = 12

export function RegisterPage() {
  const register = useRegister()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'shop'>('user')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    register.mutate(
      { email, password, displayName, role },
      { onSuccess: () => navigate('/projects', { replace: true }) },
    )
  }

  // แสดงรายละเอียดที่ server ส่งกลับมาด้วย ไม่ใช่แค่ข้อความรวม
  // ผู้ใช้จะได้รู้ว่าฟิลด์ไหนผิดโดยไม่ต้องเดา
  const detail =
    register.error instanceof ApiRequestError ? register.error.details?.[0]?.message : null
  const message =
    detail ??
    (register.error instanceof ApiRequestError
      ? register.error.message
      : register.error
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
        : null)

  return (
    <AuthLayout active="register">
      <form className="auth-form auth-form-register" onSubmit={handleSubmit}>
        <fieldset className="auth-role-fieldset">
          <legend>Role</legend>
          <label className="auth-radio">
            <input
              type="radio"
              name="role"
              value="user"
              checked={role === 'user'}
              onChange={() => setRole('user')}
            />
            <span>Customer</span>
          </label>
          <label className="auth-radio">
            <input
              type="radio"
              name="role"
              value="shop"
              checked={role === 'shop'}
              onChange={() => setRole('shop')}
            />
            <span>Shop</span>
          </label>
        </fieldset>

        <div className="auth-field">
          <label htmlFor="displayName">Username</label>
          <input
            id="displayName"
            required
            maxLength={60}
            autoComplete="username"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

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
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="auth-field">
          <label htmlFor="dateOfBirth">Date of birth</label>
          <div className="auth-date-shell">
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
            </svg>
          </div>
        </div>

        <label className="auth-terms">
          <input
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
          />
          <span>I agree to the Terms of Service and Privacy Policy</span>
        </label>

        {message && <p className="error auth-message" role="alert">{message}</p>}

        <button type="submit" className="auth-submit" disabled={register.isPending}>
          {register.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </form>
    </AuthLayout>
  )
}
