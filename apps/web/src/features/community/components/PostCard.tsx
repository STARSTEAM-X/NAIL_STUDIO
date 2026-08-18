import { Link } from 'react-router-dom'
import type { TemplateCard } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatCount, formatRelativeTime, ORIGIN_SHORT_LABELS } from '../format.ts'
import type { TemplateActions } from '../useTemplateActions.ts'
import { Avatar } from './Avatar.tsx'
import { TemplateThumb } from './TemplateThumb.tsx'

interface PostCardProps {
  template: TemplateCard
  actions: TemplateActions
}

/**
 * โพสต์หนึ่งชิ้นในฟีดชุมชน
 *
 * โครงเป็นแบบฟีดโซเชียล: หัวโพสต์ (คนโพสต์/เวลา) → คำบรรยาย → ภาพผลงาน → สรุปยอด → แถบปุ่ม
 * ทุกยอดที่แสดงมาจาก API จริง ไม่มีค่าจำลอง
 */
export function PostCard({ template, actions }: PostCardProps) {
  const liked = template.isLiked
  const detailPath = `/community/templates/${template.id}`
  const shared = actions.sharedId === template.id

  return (
    <article className="nc-card nc-post">
      <header className="nc-post-head">
        <Avatar userId={template.author.id} displayName={template.author.displayName} />
        <div className="nc-post-identity">
          <Link to={`/users/${template.author.id}`} className="nc-post-author">{template.author.displayName}</Link>
          <p className="nc-post-meta">
            <time dateTime={template.createdAt}>{formatRelativeTime(template.createdAt)}</time>
            <span aria-hidden="true">·</span>
            <span className="nc-post-visibility"><Icon name="users" size={12} /> สาธารณะ</span>
          </p>
        </div>
        <span className={`nc-badge nc-badge-${template.origin}`}>
          {ORIGIN_SHORT_LABELS[template.origin] ?? template.origin}
        </span>
      </header>

      <div className="nc-post-body">
        <h2 className="nc-post-title">
          <Link to={detailPath}>{template.name}</Link>
        </h2>
        {template.caption && <p className="nc-post-caption">{template.caption}</p>}
        {(template.category || template.primaryColor) && (
          <p className="nc-tag-row">
            {template.category && (
              <Link to={`/community?category=${encodeURIComponent(template.category)}`} className="nc-tag">
                #{template.category}
              </Link>
            )}
            {template.primaryColor && (
              <Link to={`/community?color=${encodeURIComponent(template.primaryColor)}`} className="nc-tag">
                #{template.primaryColor}
              </Link>
            )}
          </p>
        )}
      </div>

      <Link to={detailPath} className="nc-post-media" aria-label={`เปิดตัวอย่าง 3D ของ ${template.name}`}>
        <TemplateThumb template={template} ratio="16/10" />
        <span className="nc-post-media-cta"><Icon name="compass" size={14} /> ดูตัวอย่าง 3D</span>
      </Link>

      <div className="nc-post-summary">
        <span className="nc-post-summary-likes">
          <span className="nc-reaction" aria-hidden="true"><Icon name="heart" size={11} /></span>
          {formatCount(template.likeCount)}
        </span>
        <span className="nc-post-summary-right">
          <Link to={detailPath}>{formatCount(template.commentCount)} ความคิดเห็น</Link>
          <span>{formatCount(template.remixCount)} รีมิกซ์</span>
          <span>{formatCount(template.shareCount)} แชร์</span>
        </span>
      </div>

      <div className="nc-post-actions">
        <button
          type="button"
          className={`nc-action ${liked ? 'nc-action-on' : ''}`}
          aria-pressed={liked}
          disabled={actions.isLikePending(template.id)}
          onClick={() => actions.toggleLike(template.id, liked)}
        >
          <Icon name="heart" size={17} />
          <span>{liked ? 'ถูกใจแล้ว' : 'ถูกใจ'}</span>
        </button>
        <Link to={detailPath} className="nc-action">
          <Icon name="comment" size={17} />
          <span>ความคิดเห็น</span>
        </Link>
        <button
          type="button"
          className={`nc-action ${shared ? 'nc-action-done' : ''}`}
          disabled={actions.isSharePending(template.id)}
          onClick={() => { void actions.share(template.id, template.name) }}
        >
          <Icon name={shared ? 'check' : 'share'} size={17} />
          <span>{shared ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}</span>
        </button>
        <button
          type="button"
          className="nc-action nc-action-primary"
          disabled={actions.isRemixPending(template.id)}
          onClick={() => actions.remix(template.id)}
        >
          <Icon name="remix" size={17} />
          <span>{actions.isRemixPending(template.id) ? 'กำลังสร้าง…' : 'รีมิกซ์'}</span>
        </button>
      </div>
    </article>
  )
}
