import { Link } from 'react-router-dom'
import type { PublicUser } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { Avatar } from '@/components/ui/Avatar.tsx'

/**
 * กล่องเริ่มโพสต์
 *
 * การแชร์ผลงานจริงเกิดที่หน้า Editor (ShareTemplateDialog) เพราะต้องเลือกเวอร์ชันของงาน
 * กล่องนี้จึงเป็นทางเข้าไปยังขั้นตอนนั้น ไม่ใช่ฟอร์มโพสต์ปลอม
 */
export function CommunityComposer({ user }: { user?: PublicUser | null | undefined }) {
  return (
    <section className="nc-card nc-composer" aria-label="แชร์ผลงานใหม่">
      <div className="nc-composer-top">
        {user ? (
          <Avatar userId={user.id} displayName={user.displayName} linkToProfile={false} />
        ) : (
          <span className="nc-avatar nc-avatar-md" aria-hidden="true">NS</span>
        )}
        <Link to="/projects" className="nc-composer-prompt">
          {user?.displayName ? `${user.displayName} มีดีไซน์ใหม่จะอวดไหม?` : 'มีดีไซน์ใหม่จะอวดไหม?'}
        </Link>
      </div>
      <div className="nc-composer-actions">
        <Link to="/projects" className="nc-composer-action">
          <Icon name="folder" size={16} /> เลือกจากผลงานของฉัน
        </Link>
        <Link to="/projects" className="nc-composer-action">
          <Icon name="palette" size={16} /> สร้างดีไซน์ใหม่
        </Link>
        <Link to="/projects" className="btn btn-primary nc-composer-cta">
          <Icon name="plus" size={15} /> แชร์ผลงาน
        </Link>
      </div>
    </section>
  )
}
