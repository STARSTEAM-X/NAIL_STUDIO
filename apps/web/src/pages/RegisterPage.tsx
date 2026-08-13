import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { useRegister } from '@/features/auth/useAuth.ts'

const MIN_PASSWORD_LENGTH = 12

export function RegisterPage() {
  const register = useRegister()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    register.mutate(
      { email, password, displayName, role: 'user' },
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
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>สมัครสมาชิก</h1>

        <label htmlFor="displayName">ชื่อที่แสดง</label>
        <input
          id="displayName"
          required
          maxLength={60}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />

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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="hint">อย่างน้อย {MIN_PASSWORD_LENGTH} ตัวอักษร — ยาวสำคัญกว่าซับซ้อน</p>

        {message && <p className="error" role="alert">{message}</p>}

        <button type="submit" className="btn btn-primary" disabled={register.isPending}>
          {register.isPending ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>

        <p className="muted">
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </p>
      </form>
    </div>
  )
}
