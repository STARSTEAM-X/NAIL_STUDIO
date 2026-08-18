import { Link } from 'react-router-dom'
import type { TemplateCard } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatCount, formatRelativeTime, ORIGIN_SHORT_LABELS } from '../format.ts'
import type { TemplateActions } from '../useTemplateActions.ts'
import { Avatar } from './Avatar.tsx'
import { TemplateThumb } from './TemplateThumb.tsx'

interface TemplateTileProps {
  template: TemplateCard
  actions: TemplateActions
}

/**
 * การ์ดดีไซน์สำหรับโหมด "เรียกดูแบบ" (กริด)
 *
 * เน้นภาพเป็นหลักและวางปุ่มหลัก (รีมิกซ์) ให้เห็นชัดตลอด ไม่ซ่อนไว้ใน hover อย่างเดียว
 * เพราะอุปกรณ์สัมผัสไม่มี hover
 */
export function TemplateTile({ template, actions }: TemplateTileProps) {
  const detailPath = `/community/templates/${template.id}`
  const liked = template.isLiked

  return (
    <article className="nc-card nc-tile">
      <Link to={detailPath} className="nc-tile-media" aria-label={`เปิด ${template.name}`}>
        <TemplateThumb template={template} ratio="4/3" />
        <span className={`nc-badge nc-badge-${template.origin} nc-tile-badge`}>
          {ORIGIN_SHORT_LABELS[template.origin] ?? template.origin}
        </span>
        <span className="nc-tile-overlay">
          <Icon name="compass" size={14} /> ดูตัวอย่าง 3D
        </span>
      </Link>

      <div className="nc-tile-body">
        <h3 className="nc-tile-title"><Link to={detailPath}>{template.name}</Link></h3>
        <div className="nc-tile-author">
          <Avatar userId={template.author.id} displayName={template.author.displayName} size="sm" />
          <Link to={`/users/${template.author.id}`}>{template.author.displayName}</Link>
          <time dateTime={template.createdAt}>{formatRelativeTime(template.createdAt)}</time>
        </div>
        {(template.category || template.primaryColor) && (
          <p className="nc-tag-row">
            {template.category && <span className="nc-tag nc-tag-static">{template.category}</span>}
            {template.primaryColor && <span className="nc-tag nc-tag-static">{template.primaryColor}</span>}
          </p>
        )}
        <div className="nc-tile-stats">
          <button
            type="button"
            className={`nc-stat-button ${liked ? 'nc-stat-on' : ''}`}
            aria-pressed={liked}
            aria-label={liked ? `เลิกถูกใจ ${template.name}` : `ถูกใจ ${template.name}`}
            disabled={actions.isLikePending(template.id)}
            onClick={() => actions.toggleLike(template.id, liked)}
          >
            <Icon name="heart" size={14} /> {formatCount(template.likeCount)}
          </button>
          <span><Icon name="comment" size={14} /> {formatCount(template.commentCount)}</span>
          <span><Icon name="remix" size={14} /> {formatCount(template.remixCount)}</span>
          <button
            type="button"
            className="nc-tile-remix"
            disabled={actions.isRemixPending(template.id)}
            onClick={() => actions.remix(template.id)}
          >
            {actions.isRemixPending(template.id) ? 'กำลังสร้าง…' : 'รีมิกซ์'}
          </button>
        </div>
      </div>
    </article>
  )
}
