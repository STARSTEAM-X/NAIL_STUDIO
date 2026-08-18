import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { AuthLayout, AuthPasswordField } from '@/components/AuthLayout.tsx'
import { useLogin } from '@/features/auth/useAuth.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

export function LoginPage() {
  usePageTitle('เข้าสู่ระบบ')
  const login = useLogin()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        : null

  return (
    <AuthLayout
      active="login"
      title="ยินดีต้อนรับกลับมา"
      subtitle="เข้าสู่ระบบเพื่อกลับไปออกแบบเล็บของคุณต่อ"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">อีเมล</label>
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
          label="รหัสผ่าน"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {message && <p className="error auth-message" role="alert">{message}</p>}

        <button type="submit" className="auth-submit" disabled={login.isPending}>
          {login.isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </AuthLayout>
  )
}
