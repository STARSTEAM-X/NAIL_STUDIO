import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { AuthLayout, AuthPasswordField } from '@/components/AuthLayout.tsx'
import { useRegister } from '@/features/auth/useAuth.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { maskDdMmYyyyInput, parseDdMmYyyy } from '@/utils/dateFormat.ts'

const MIN_PASSWORD_LENGTH = 12

export function RegisterPage() {
  usePageTitle('สมัครสมาชิก')
  const register = useRegister()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'shop'>('user')
  const [dateOfBirthText, setDateOfBirthText] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const dateOfBirth = parseDdMmYyyy(dateOfBirthText)
  const dateOfBirthError = dateOfBirthText.length === 10 && !dateOfBirth

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (dateOfBirthError) return
    register.mutate(
      {
        email,
        password,
        displayName,
        role,
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(termsAccepted ? { termsAccepted: true as const } : {}),
      },
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
    <AuthLayout
      active="register"
      title="สร้างบัญชีใหม่"
      subtitle="เริ่มออกแบบลายเล็บ 3 มิติ และแชร์ผลงานกับชุมชน"
    >
      <form className="auth-form auth-form-register" onSubmit={handleSubmit}>
        <fieldset className="auth-role-fieldset">
          <legend>ประเภทบัญชี</legend>
          <label className="auth-radio">
            <input
              type="radio"
              name="role"
              value="user"
              checked={role === 'user'}
              onChange={() => setRole('user')}
            />
            <span>
              <strong>ลูกค้า</strong>
              <small>ออกแบบเล็บ แชร์ผลงาน และจองคิวกับร้าน</small>
            </span>
          </label>
          <label className="auth-radio">
            <input
              type="radio"
              name="role"
              value="shop"
              checked={role === 'shop'}
              onChange={() => setRole('shop')}
            />
            <span>
              <strong>ร้านทำเล็บ</strong>
              <small>ทำได้ทุกอย่างเหมือนลูกค้า บวกหน้าจัดการร้าน บริการ และรีวิว</small>
            </span>
          </label>
        </fieldset>

        <div className="auth-field">
          <label htmlFor="displayName">ชื่อที่แสดง</label>
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
          hint={`ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร แนะนำให้ใช้วลีที่จำได้แทนการผสมสัญลักษณ์`}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <div className="auth-field">
          <label htmlFor="dateOfBirth">วันเกิด</label>
          <div className="auth-date-shell">
            <input
              id="dateOfBirth"
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              maxLength={10}
              value={dateOfBirthText}
              aria-invalid={dateOfBirthError}
              onChange={(event) => setDateOfBirthText(maskDdMmYyyyInput(event.target.value))}
            />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" />
            </svg>
          </div>
          {dateOfBirthError && <p className="error auth-message" role="alert">วันที่ไม่ถูกต้อง กรุณากรอกรูปแบบ dd/mm/yyyy</p>}
        </div>

        <label className="auth-terms">
          <input
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
          />
          <span>ฉันยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว</span>
        </label>

        {message && <p className="error auth-message" role="alert">{message}</p>}

        <button type="submit" className="auth-submit" disabled={register.isPending || dateOfBirthError}>
          {register.isPending ? 'กำลังสร้างบัญชี…' : 'สร้างบัญชี'}
        </button>
      </form>
    </AuthLayout>
  )
}
