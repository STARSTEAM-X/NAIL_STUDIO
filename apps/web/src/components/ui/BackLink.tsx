import { Link } from 'react-router-dom'
import { Icon } from '../Icon.tsx'

/**
 * ลิงก์ย้อนกลับที่ใช้ร่วมกันทุกหน้า
 * เดิมมีสี่หน้าเขียนเองด้วยสามคลาสต่างกัน (.profile-back-link, .back-link, .nc-breadcrumb)
 */
export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="ui-back-link">
      <Icon name="arrow-left" size={15} />
      {children}
    </Link>
  )
}
