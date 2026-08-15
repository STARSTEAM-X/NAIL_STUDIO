import { Link, useParams } from 'react-router-dom'
import type { PublicProfileTemplate, PublicUser } from '@nail-studio/contracts'
import { API_BASE, ApiRequestError } from '@/api/client.ts'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { usePublicProfile } from '@/features/users/usePublicProfile.ts'

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

const PREVIEW_CLASSES: Record<string, string> = {
  Red: 'template-preview-red',
  Pink: 'template-preview-pink',
  Nude: 'template-preview-nude',
  Black: 'template-preview-black',
  White: 'template-preview-white',
}

function getInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}

export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const profile = usePublicProfile(userId)
  const { data: currentUser } = useCurrentUser()

  if (profile.isPending) return <div className="center">กำลังโหลดโปรไฟล์…</div>
  if (profile.error) {
    const message = profile.error instanceof ApiRequestError && profile.error.status === 404
      ? 'ไม่พบโปรไฟล์ผู้ใช้นี้'
      : 'โหลดโปรไฟล์ไม่สำเร็จ'
    return <p className="error center" role="alert">{message}</p>
  }
  if (!profile.profile) return <p className="error center">ไม่พบโปรไฟล์ผู้ใช้ที่ต้องการ</p>

  const user = profile.profile
  const isOwnProfile = currentUser?.id === user.id

  return (
    <section className="page public-profile-page">
      <Link to="/community" className="profile-back-link">
        <span aria-hidden="true">←</span>
        กลับไปชุมชน
      </Link>

      <header className="public-profile-hero">
        <span className="profile-avatar profile-avatar-large" aria-hidden="true">{getInitials(user.displayName)}</span>
        <div>
          <p className="eyebrow">COMMUNITY PROFILE</p>
          <h1>{user.displayName}</h1>
          <p className="public-profile-role">{ROLE_LABELS[user.role]}</p>
          <p className="profile-hero-copy">สมาชิกตั้งแต่ {JOINED_DATE_FORMAT.format(new Date(user.createdAt))}</p>
        </div>
        {isOwnProfile && <Link to="/profile" className="btn btn-primary public-profile-edit">แก้ไขโปรไฟล์</Link>}
      </header>

      <section className="public-profile-summary" aria-label="สรุปโปรไฟล์">
        <div><strong>{user.templateCount}</strong><span>ผลงานที่เผยแพร่</span></div>
        <div><strong>{ROLE_LABELS[user.role]}</strong><span>ประเภทบัญชี</span></div>
      </section>

      <section className="public-profile-work" aria-labelledby="public-profile-work-title">
        <header className="public-profile-section-head">
          <div>
            <p className="eyebrow">PUBLIC WORK</p>
            <h2 id="public-profile-work-title">ผลงานของ {user.displayName}</h2>
          </div>
          <span className="public-profile-count">{user.templateCount} แบบ</span>
        </header>

        {profile.templates.length === 0 ? (
          <div className="public-profile-empty">
            <h3>ยังไม่มีผลงานที่เผยแพร่</h3>
            <p>เมื่อผู้ใช้นี้เผยแพร่ดีไซน์ ผลงานจะแสดงที่หน้านี้</p>
          </div>
        ) : (
          <div className="community-grid public-profile-grid">
            {profile.templates.map((template) => <PublicTemplateCard key={template.id} template={template} />)}
          </div>
        )}

        {profile.hasNextPage && (
          <button
            type="button"
            className="btn btn-ghost community-load-more"
            disabled={profile.isFetchingNextPage}
            onClick={() => void profile.fetchNextPage()}
          >
            {profile.isFetchingNextPage ? 'กำลังโหลด…' : 'โหลดเพิ่ม'}
          </button>
        )}
      </section>
    </section>
  )
}

function PublicTemplateCard({ template }: { template: PublicProfileTemplate }) {
  return (
    <article className="template-card">
      <Link to={`/community/templates/${template.id}`} className="public-profile-template-link">
        <div
          className={`template-preview ${template.hasThumbnail ? 'template-preview-image' : PREVIEW_CLASSES[template.primaryColor ?? ''] ?? 'template-preview-default'}`}
          aria-hidden={!template.hasThumbnail}
        >
          {template.hasThumbnail ? (
            <img
              src={`${API_BASE}/api/v1/templates/${template.id}/thumbnail`}
              crossOrigin="use-credentials"
              alt={`ภาพตัวอย่าง ${template.name}`}
              loading="lazy"
            />
          ) : (
            <span>{template.primaryColor ?? 'Nail art'}</span>
          )}
        </div>
        <div className="template-card-body">
          <div className="template-card-title">
            <h3>{template.name}</h3>
            <span className="template-origin">{template.origin === 'ai' ? 'AI' : template.origin === 'remix' ? 'รีมิกซ์' : 'ต้นฉบับ'}</span>
          </div>
          {template.caption && <p className="template-caption">{template.caption}</p>}
          <div className="template-stats" aria-label="สถิติการมีส่วนร่วม">
            <span>♥ {template.likeCount}</span>
            <span>↗ {template.shareCount}</span>
            <span>↻ {template.remixCount}</span>
            <span>💬 {template.commentCount}</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
