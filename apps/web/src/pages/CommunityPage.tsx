import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TEMPLATE_CATEGORIES, TEMPLATE_PRIMARY_COLORS } from '@nail-studio/contracts'
import { API_BASE, ApiRequestError } from '@/api/client.ts'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import {
  type TemplateCategory,
  type TemplatePrimaryColor,
  type TemplateSort,
  useTemplateLike,
  useTemplateRemix,
  useTemplateShare,
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

function getInitials(displayName: string | undefined) {
  const parts = displayName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length > 1) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return parts[0]?.slice(0, 2).toUpperCase() || 'NS'
}

function formatPostDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'เมื่อสักครู่นี้'
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} วันที่แล้ว`
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export function CommunityPage() {
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
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
  const shareMutation = useTemplateShare()
  const [sharedTemplateId, setSharedTemplateId] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const items = templates.data?.pages.flatMap((page) => page.data) ?? []

  const shareTemplate = async (templateId: string, name: string) => {
    setShareError(null)
    try {
      let channel: 'link' | 'copy' = 'link'
      const url = `${window.location.origin}/community/templates/${templateId}`
      if (navigator.share) {
        await navigator.share({ title: name, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        channel = 'copy'
      } else {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการแชร์ลิงก์')
      }
      shareMutation.mutate(
        { templateId, channel },
        { onSuccess: () => setSharedTemplateId(templateId) },
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareError(error instanceof Error ? error.message : 'แชร์ผลงานไม่สำเร็จ')
    }
  }

  return (
    <section className="page community-page">
      <header className="page-head community-head community-hero">
        <div className="community-hero-copy">
          <span className="community-hero-mark" aria-hidden="true">✦</span>
          <p className="eyebrow">NAIL STUDIO COMMUNITY</p>
          <h1>ไอเดียจากชุมชน</h1>
          <p className="muted">สำรวจดีไซน์ล่าสุดและแบบที่คนกำลังชื่นชอบ</p>
        </div>
        <div className="community-head-actions">
          {currentUser && <Link to={`/users/${currentUser.id}`} className="btn btn-ghost">โปรไฟล์ของฉัน</Link>}
          <Link to="/projects" className="btn btn-primary">แชร์ผลงาน</Link>
        </div>
      </header>

      <div className="community-toolbar">
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
      </div>

      <div className="community-content">
        <main className="community-feed">
          <section className="community-composer" aria-label="แชร์ผลงานใหม่">
            <div className="community-composer-head">
              <span className="community-composer-avatar" aria-hidden="true">{getInitials(currentUser?.displayName)}</span>
              <div className="community-composer-copy">
                <strong>{currentUser?.displayName ?? 'ผู้ใช้งาน'}</strong>
                <span>พร้อมแบ่งปันไอเดียใหม่กับชุมชนหรือยัง?</span>
              </div>
              <span className="community-privacy">สาธารณะ</span>
            </div>
            <div className="community-composer-actions">
              <span className="community-compose-hint">โพสต์ผลงานของคุณให้คนอื่นได้แรงบันดาลใจ</span>
              <Link to="/projects" className="btn btn-primary">สร้างและแชร์ผลงาน</Link>
            </div>
          </section>

          {shareError && <p className="error community-feedback" role="alert">{shareError}</p>}
          {sharedTemplateId && <p className="community-success" role="status">แชร์ลิงก์ผลงานแล้ว</p>}

      {templates.isPending && <p className="muted">กำลังโหลดดีไซน์จากชุมชน…</p>}
      {templates.error && (
        <p className="error" role="alert">
          โหลดฟีดไม่สำเร็จ{templates.error instanceof ApiRequestError ? ` — ${templates.error.message}` : ''}
        </p>
      )}
      {!templates.isPending && !templates.error && items.length === 0 && (
        <p className="muted">ยังไม่มีดีไซน์ที่ตรงกับตัวกรองนี้</p>
      )}

      <div className="community-grid community-feed-grid">
        {items.map((template) => (
          <article className="template-card community-post-card" key={template.id}>
            <div
              className={`template-preview ${template.hasThumbnail ? 'template-preview-image' : PREVIEW_CLASSES[template.primaryColor ?? ''] ?? 'template-preview-default'}`}
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
              <div className="community-post-overlay">
                <div className="community-post-overlay-head">
                  <h2><Link to={`/community/templates/${template.id}`}>{template.name}</Link></h2>
                  <span className="template-origin">{ORIGIN_LABELS[template.origin] ?? template.origin}</span>
                </div>
                {template.caption && <p>{template.caption}</p>}
              </div>
            </div>
            <div className="template-card-body">
              <div className="community-post-author">
                <span className="community-post-author-avatar" aria-hidden="true">{getInitials(template.author.displayName)}</span>
                <div>
                  <Link to={`/users/${template.author.id}`}>{template.author.displayName}</Link>
                  <span className="community-post-meta">
                    <time dateTime={template.createdAt}>{formatPostDate(template.createdAt)}</time> · สาธารณะ
                  </span>
                </div>
              </div>
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
                <button
                  type="button"
                  className="template-social-action"
                  disabled={shareMutation.isPending && shareMutation.variables?.templateId === template.id}
                  onClick={() => { void shareTemplate(template.id, template.name) }}
                >
                  <span aria-hidden="true">↗</span> {sharedTemplateId === template.id ? 'แชร์แล้ว' : template.shareCount}
                </button>
                <span>↻ {template.remixCount}</span>
                <Link to={`/community/templates/${template.id}`} className="template-social-action">💬 {template.commentCount}</Link>
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
        </main>

        <aside className="community-sidebar">
          <section className="community-sidebar-card">
            <p className="eyebrow">NAIL STUDIO</p>
            <h2>ชุมชนของเรา</h2>
            <p>ค้นหาแรงบันดาลใจ แชร์ผลงาน และพูดคุยกับคนที่รักการออกแบบเล็บเหมือนกัน</p>
            {currentUser && <Link to={`/users/${currentUser.id}`} className="sidebar-profile-link">ดูโปรไฟล์ของฉัน</Link>}
          </section>
          <section className="community-sidebar-card community-guidelines">
            <h2>แนวทางชุมชน</h2>
            <p>แชร์ผลงานของคุณด้วยความเคารพ และช่วยกันทำให้ Community น่าใช้งานสำหรับทุกคน</p>
          </section>
        </aside>
      </div>
    </section>
  )
}
