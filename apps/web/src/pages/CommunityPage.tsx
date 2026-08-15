import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TEMPLATE_CATEGORIES, TEMPLATE_PRIMARY_COLORS } from '@nail-studio/contracts'
import { ApiRequestError } from '@/api/client.ts'
import {
  type TemplateCategory,
  type TemplatePrimaryColor,
  type TemplateSort,
  useTemplateLike,
  useTemplateRemix,
  useTemplates,
} from '@/features/community/useTemplates.ts'

const ORIGIN_LABELS: Record<string, string> = {
  original: 'ต้นฉบับ',
  ai: 'AI',
  remix: 'รีมิกซ์',
}

const PREVIEW_CLASSES: Record<string, string> = {
  Red: 'template-preview-red',
  Pink: 'template-preview-pink',
  Nude: 'template-preview-nude',
  Black: 'template-preview-black',
  White: 'template-preview-white',
}

export function CommunityPage() {
  const navigate = useNavigate()
  const [sort, setSort] = useState<TemplateSort>('latest')
  const [category, setCategory] = useState<TemplateCategory | ''>('')
  const [color, setColor] = useState<TemplatePrimaryColor | ''>('')
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(() => new Set())
  const filters = useMemo(
    () => ({
      sort,
      ...(category ? { category } : {}),
      ...(color ? { color } : {}),
    }),
    [category, color, sort],
  )
  const templates = useTemplates(filters)
  const likeMutation = useTemplateLike()
  const remixMutation = useTemplateRemix()
  const items = templates.data?.pages.flatMap((page) => page.data) ?? []

  return (
    <section className="page community-page">
      <header className="page-head community-head">
        <div>
          <p className="eyebrow">NAIL STUDIO COMMUNITY</p>
          <h1>ไอเดียจากชุมชน</h1>
          <p className="muted">สำรวจดีไซน์ล่าสุดและแบบที่คนกำลังชื่นชอบ</p>
        </div>
        <div className="community-sort" role="group" aria-label="เรียงลำดับฟีด">
          <button
            type="button"
            className={`chip ${sort === 'latest' ? 'chip-on' : ''}`}
            onClick={() => setSort('latest')}
          >
            ล่าสุด
          </button>
          <button
            type="button"
            className={`chip ${sort === 'popular' ? 'chip-on' : ''}`}
            onClick={() => setSort('popular')}
          >
            ยอดนิยม
          </button>
        </div>
      </header>

      <div className="community-filters" aria-label="ตัวกรองดีไซน์">
        <label className="field">
          สไตล์
          <select
            aria-label="กรองตามสไตล์"
            value={category}
            onChange={(event) => setCategory(event.target.value as TemplateCategory | '')}
          >
            <option value="">ทุกสไตล์</option>
            {TEMPLATE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="field">
          สีหลัก
          <select
            aria-label="กรองตามสีหลัก"
            value={color}
            onChange={(event) => setColor(event.target.value as TemplatePrimaryColor | '')}
          >
            <option value="">ทุกสี</option>
            {TEMPLATE_PRIMARY_COLORS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {templates.isPending && <p className="muted">กำลังโหลดดีไซน์จากชุมชน…</p>}
      {templates.error && (
        <p className="error" role="alert">
          โหลดฟีดไม่สำเร็จ{templates.error instanceof ApiRequestError ? ` — ${templates.error.message}` : ''}
        </p>
      )}
      {!templates.isPending && !templates.error && items.length === 0 && (
        <p className="muted">ยังไม่มีดีไซน์ที่ตรงกับตัวกรองนี้</p>
      )}

      <div className="community-grid">
        {items.map((template) => (
          <article className="template-card" key={template.id}>
            <div
              className={`template-preview ${PREVIEW_CLASSES[template.primaryColor ?? ''] ?? 'template-preview-default'}`}
              aria-hidden="true"
            >
              <span>{template.primaryColor ?? 'Nail art'}</span>
            </div>
            <div className="template-card-body">
              <div className="template-card-title">
                <h2><Link to={`/community/templates/${template.id}`}>{template.name}</Link></h2>
                <span className="template-origin">{ORIGIN_LABELS[template.origin] ?? template.origin}</span>
              </div>
              {template.caption && <p className="template-caption">{template.caption}</p>}
              <p className="muted template-author">โดย {template.author.displayName}</p>
              <div className="template-stats" aria-label="สถิติการมีส่วนร่วม">
                <button
                  type="button"
                  className={`template-like ${likedTemplateIds.has(template.id) ? 'template-like-on' : ''}`}
                  aria-label={likedTemplateIds.has(template.id) ? 'เลิกไลก์ดีไซน์นี้' : 'ไลก์ดีไซน์นี้'}
                  aria-pressed={likedTemplateIds.has(template.id)}
                  disabled={likeMutation.isPending && likeMutation.variables?.templateId === template.id}
                  onClick={() => {
                    const liked = likedTemplateIds.has(template.id)
                    likeMutation.mutate(
                      { templateId: template.id, liked },
                      {
                        onSuccess: (result) => {
                          setLikedTemplateIds((current) => {
                            const next = new Set(current)
                            if (result.liked) next.add(template.id)
                            else next.delete(template.id)
                            return next
                          })
                        },
                      },
                    )
                  }}
                >
                  <span aria-hidden="true">♥</span> {template.likeCount}
                </button>
                <span>↗ {template.shareCount}</span>
                <span>↻ {template.remixCount}</span>
                <span>💬 {template.commentCount}</span>
                <button
                  type="button"
                  className="template-remix"
                  disabled={remixMutation.isPending && remixMutation.variables?.templateId === template.id}
                  onClick={() => {
                    remixMutation.mutate(
                      { templateId: template.id },
                      { onSuccess: (result) => navigate(`/editor/${result.project.id}`) },
                    )
                  }}
                >
                  {remixMutation.isPending && remixMutation.variables?.templateId === template.id
                    ? 'กำลังสร้าง…'
                    : 'รีมิกซ์'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {templates.hasNextPage && (
        <button
          type="button"
          className="btn btn-ghost community-load-more"
          disabled={templates.isFetchingNextPage}
          onClick={() => void templates.fetchNextPage()}
        >
          {templates.isFetchingNextPage ? 'กำลังโหลด…' : 'โหลดเพิ่ม'}
        </button>
      )}
    </section>
  )
}
