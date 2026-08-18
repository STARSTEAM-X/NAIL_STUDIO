import { useLocation } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { ButtonLink } from '@/components/ui/Button.tsx'
import { usePageTitle } from '@/lib/usePageTitle.ts'

/**
 * หน้า 404
 *
 * ของเดิมเป็น <div> บรรทัดเดียวที่อยู่นอก AppShell จึงไม่มีเมนู ไม่มีลิงก์ใดๆ
 * ผู้ใช้ที่พิมพ์ URL ผิดจึงติดอยู่ที่นั่นจนกว่าจะกด back เอง
 */
export function NotFoundPage() {
  const location = useLocation()
  usePageTitle('ไม่พบหน้าที่ต้องการ')

  return (
    <section className="page notfound-page">
      <div className="nc-state">
        <span className="nc-state-icon" aria-hidden="true"><Icon name="compass" size={22} /></span>
        <h1>ไม่พบหน้าที่ต้องการ</h1>
        <p>
          ไม่มีหน้าที่ตรงกับ <code>{location.pathname}</code> อาจเป็นเพราะลิงก์เก่า
          หรือเนื้อหาถูกย้ายไปแล้ว
        </p>
        <div className="nc-state-actions">
          <ButtonLink to="/projects" variant="primary" icon="folder">ไปที่งานของฉัน</ButtonLink>
          <ButtonLink to="/community" variant="ghost" icon="users">ดูผลงานในชุมชน</ButtonLink>
        </div>
      </div>
    </section>
  )
}
