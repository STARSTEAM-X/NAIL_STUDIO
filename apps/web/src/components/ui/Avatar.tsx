import { Link } from 'react-router-dom'
import { avatarGradient, getInitials } from '@/lib/user.ts'

interface AvatarProps {
  userId: string
  displayName: string
  size?: 'sm' | 'md' | 'lg' | undefined
  /** ห่อด้วยลิงก์ไปโปรไฟล์สาธารณะ — ปิดได้เมื่ออยู่ในลิงก์อื่นอยู่แล้ว */
  linkToProfile?: boolean | undefined
}

/** อวาตาร์ตัวอักษรย่อของทั้งแอป (ระบบยังไม่มีรูปโปรไฟล์จริง) */
export function Avatar({ userId, displayName, size = 'md', linkToProfile = true }: AvatarProps) {
  const inner = (
    <span
      className={`nc-avatar nc-avatar-${size}`}
      style={{ backgroundImage: avatarGradient(userId) }}
      aria-hidden="true"
    >
      {getInitials(displayName)}
    </span>
  )

  if (!linkToProfile) return inner
  return (
    <Link to={`/users/${userId}`} className="nc-avatar-link" aria-label={`โปรไฟล์ของ ${displayName}`}>
      {inner}
    </Link>
  )
}
