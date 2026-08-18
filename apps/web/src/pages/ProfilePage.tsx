import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { PublicUser } from '@nail-studio/contracts'
import { ApiRequestError } from '@/api/client.ts'
import { Icon } from '@/components/Icon.tsx'
import { LoadingScreen } from '@/components/Loading.tsx'
import { useCurrentUser, useUpdateProfile } from '@/features/auth/useAuth.ts'

const ROLE_LABELS: Record<PublicUser['role'], string> = {
  user: 'ผู้ใช้งานทั่วไป',
  shop: 'ร้านทำเล็บ',
  admin: 'ผู้ดูแลระบบ',
}

const JOINED_DATE_FORMAT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function getInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}

export function ProfilePage() {
  const { data: user, isPending } = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (user) setDisplayName(user.displayName)
  }, [user])

  if (isPending) return <LoadingScreen label="กำลังโหลดโปรไฟล์…" />
  if (!user) return null

  const isDirty = displayName.trim() !== user.displayName

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = displayName.trim()
    if (!nextName || !isDirty) return
    setMessage(null)
    updateProfile.mutate(
      { displayName: nextName },
      { onSuccess: () => setMessage('บันทึกโปรไฟล์แล้ว') },
    )
  }

  return (
    <section className="page profile-page">
      <Link to="/projects" className="profile-back-link">
        <span aria-hidden="true">←</span>
        กลับไปงานออกแบบของฉัน
      </Link>

      <header className="profile-hero">
        <span className="profile-avatar profile-avatar-large" aria-hidden="true">{getInitials(user.displayName)}</span>
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>โปรไฟล์ของฉัน</h1>
          <p className="profile-hero-copy">จัดการข้อมูลบัญชีของคุณให้เป็นปัจจุบัน เพื่อให้แสดงเหมือนกันทุกหน้า</p>
        </div>
      </header>

      <div className="profile-layout">
        <form className="card profile-card" onSubmit={handleSubmit}>
          <div className="profile-card-heading">
            <div>
              <p className="eyebrow">PERSONAL DETAILS</p>
              <h2>ข้อมูลส่วนตัว</h2>
            </div>
            <Icon name="users" size={22} />
          </div>

          <label className="profile-field">
            <span>ชื่อที่แสดง</span>
            <input
              value={displayName}
              maxLength={60}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <small>ชื่อนี้จะแสดงในเมนูโปรไฟล์และงานที่คุณเผยแพร่</small>
          </label>

          <label className="profile-field">
            <span>อีเมล</span>
            <input value={user.email} readOnly aria-readonly="true" />
            <small>อีเมลใช้สำหรับเข้าสู่ระบบและยังแก้ไขจากหน้านี้ไม่ได้</small>
          </label>

          <label className="profile-field">
            <span>ประเภทบัญชี</span>
            <input value={ROLE_LABELS[user.role]} readOnly aria-readonly="true" />
          </label>

          {updateProfile.error && (
            <p className="error profile-feedback" role="alert">
              {updateProfile.error instanceof ApiRequestError ? updateProfile.error.message : 'บันทึกโปรไฟล์ไม่สำเร็จ'}
            </p>
          )}
          {message && <p className="profile-success" role="status">{message}</p>}

          <button type="submit" className="btn btn-primary profile-save-button" disabled={updateProfile.isPending || !isDirty}>
            {updateProfile.isPending ? 'กำลังบันทึก…' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </form>

        <aside className="card profile-summary-card">
          <p className="eyebrow">ACCOUNT SUMMARY</p>
          <div className="profile-summary-row">
            <span className="profile-summary-icon"><Icon name="users" size={17} /></span>
            <div><strong>{user.displayName}</strong><span>{ROLE_LABELS[user.role]}</span></div>
          </div>
          <div className="profile-summary-divider" />
          <dl className="profile-meta-list">
            <div><dt>สมัครสมาชิกเมื่อ</dt><dd>{JOINED_DATE_FORMAT.format(new Date(user.createdAt))}</dd></div>
            <div><dt>อีเมลบัญชี</dt><dd>{user.email}</dd></div>
          </dl>
          <p className="profile-summary-note">ข้อมูลโปรไฟล์นี้เป็นของบัญชีที่กำลังเข้าสู่ระบบเท่านั้น</p>
        </aside>
      </div>
    </section>
  )
}
