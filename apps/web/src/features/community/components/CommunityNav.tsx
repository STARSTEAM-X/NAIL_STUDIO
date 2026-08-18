import { Link, NavLink } from 'react-router-dom'
import { TEMPLATE_CATEGORIES } from '@nail-studio/contracts'
import { Icon, type IconName } from '@/components/Icon.tsx'
import type { CommunityFeedState } from '../useCommunityFilters.ts'

const CATEGORY_ICONS: Record<string, IconName> = {
  Minimalistic: 'layers',
  Modern: 'sparkle',
  Festive: 'flame',
  Geometric: 'grid',
  Luxury: 'tag',
}

interface CommunityNavProps {
  state: CommunityFeedState
  buildHref: (patch: Partial<CommunityFeedState>) => string
  currentUserId?: string | undefined
}

/**
 * แถบนำทางซ้ายของชุมชน
 *
 * ทุกปุ่มเป็นลิงก์จริงที่เปลี่ยน query string ไม่ใช่ปุ่มที่เก็บ state ไว้ในหน่วยความจำ
 * ผู้ใช้จึงกดย้อนกลับ บุ๊กมาร์ก หรือส่งลิงก์ที่กรองไว้แล้วให้คนอื่นได้
 */
export function CommunityNav({ state, buildHref, currentUserId }: CommunityNavProps) {
  const isFeedLatest = state.view === 'feed' && state.sort === 'latest'
  const isFeedPopular = state.view === 'feed' && state.sort === 'popular'
  const isBrowse = state.view === 'grid'

  return (
    <nav className="nc-nav" aria-label="เมนูชุมชน">
      <div className="nc-nav-scroll">
        <div className="nc-nav-group">
          <p className="nc-nav-label">ชุมชน</p>
          <Link to={buildHref({ view: 'feed', sort: 'latest' })} className={`nc-nav-item ${isFeedLatest ? 'nc-nav-on' : ''}`}>
            <Icon name="rows" size={18} /><span>ฟีดล่าสุด</span>
          </Link>
          <Link to={buildHref({ view: 'feed', sort: 'popular' })} className={`nc-nav-item ${isFeedPopular ? 'nc-nav-on' : ''}`}>
            <Icon name="flame" size={18} /><span>กำลังมาแรง</span>
          </Link>
          <Link to={buildHref({ view: 'grid' })} className={`nc-nav-item ${isBrowse ? 'nc-nav-on' : ''}`}>
            <Icon name="grid" size={18} /><span>เรียกดูแบบทั้งหมด</span>
          </Link>
        </div>

        <div className="nc-nav-group">
          <p className="nc-nav-label">หมวดหมู่</p>
          <Link
            to={buildHref({ category: '' })}
            className={`nc-nav-item ${state.category === '' ? 'nc-nav-on' : ''}`}
          >
            <Icon name="compass" size={18} /><span>ทุกสไตล์</span>
          </Link>
          {TEMPLATE_CATEGORIES.map((option) => (
            <Link
              key={option}
              to={buildHref({ category: option })}
              className={`nc-nav-item ${state.category === option ? 'nc-nav-on' : ''}`}
            >
              <Icon name={CATEGORY_ICONS[option] ?? 'tag'} size={18} /><span>{option}</span>
            </Link>
          ))}
        </div>

        <div className="nc-nav-group">
          <p className="nc-nav-label">ทางลัด</p>
          <NavLink to="/projects" className="nc-nav-item">
            <Icon name="folder" size={18} /><span>ผลงานของฉัน</span>
          </NavLink>
          {currentUserId && (
            <NavLink to={`/users/${currentUserId}`} className="nc-nav-item">
              <Icon name="user" size={18} /><span>โปรไฟล์สาธารณะ</span>
            </NavLink>
          )}
          <NavLink to="/appointments" className="nc-nav-item">
            <Icon name="calendar" size={18} /><span>การนัดหมาย</span>
          </NavLink>
        </div>
      </div>

      <Link to="/projects" className="btn btn-primary nc-nav-cta">
        <Icon name="plus" size={16} /> แชร์ผลงานใหม่
      </Link>
    </nav>
  )
}
