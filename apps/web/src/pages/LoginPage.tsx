import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { useLogin } from '@/features/auth/useAuth.ts'

export function LoginPage() {
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
        ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'
        : null

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>เข้าสู่ระบบ</h1>

        <label htmlFor="email">อีเมล</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <label htmlFor="password">รหัสผ่าน</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {message && <p className="error" role="alert">{message}</p>}

        <button type="submit" className="btn btn-primary" disabled={login.isPending}>
          {login.isPending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>

        <p className="muted">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
        </p>
      </form>
    </div>
  )
}
