import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { ReadOnlyDesignScene } from '@/3d/scene/ReadOnlyDesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import { Icon } from '@/components/Icon.tsx'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { Avatar } from '@/components/ui/Avatar.tsx'
import { EmptyState, ErrorState } from '@/components/ui/States.tsx'
import { formatCount, formatDateTime, formatRelativeTime } from '@/lib/datetime.ts'
import { ORIGIN_LABELS, PRIMARY_COLOR_SWATCHES } from '@/features/community/format.ts'
import { useCreateTemplateComment, useTemplate } from '@/features/community/useTemplates.ts'
import { useTemplateActions } from '@/features/community/useTemplateActions.ts'
import { DesignStoreProvider } from '@/features/design/DesignStoreProvider.tsx'

const COMMENT_LIMIT = 1000

/** โครงกระดูกของหน้ารายละเอียด ให้เห็นตำแหน่งเวทีและแผงข้างก่อนข้อมูลจริงมาถึง */
function DetailSkeleton() {
  return (
    <div className="nc-detail-grid" aria-hidden="true">
      <div className="nc-detail-main">
        <span className="nc-skel nc-skel-stage" />
        <div className="nc-card nc-detail-summary">
          <span className="nc-skel nc-skel-line" style={{ width: '45%' }} />
          <span className="nc-skel nc-skel-line" style={{ width: '75%' }} />
        </div>
      </div>
      <div className="nc-detail-side">
        <div className="nc-card nc-rail-card">
          <span className="nc-skel nc-skel-line" style={{ width: '60%' }} />
          <span className="nc-skel nc-skel-line" style={{ width: '40%' }} />
          <span className="nc-skel nc-skel-pill" />
        </div>
      </div>
    </div>
  )
}

export function TemplatePreviewPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const { data: currentUser } = useCurrentUser()
  const template = useTemplate(templateId)
  const createComment = useCreateTemplateComment()
  const actions = useTemplateActions()
  const [commentText, setCommentText] = useState('')

  if (!templateId) {
    return (
      <div className="nc-page nc-detail-page">
        <ErrorState title="ไม่พบรหัสดีไซน์" error={new Error('ลิงก์ที่เปิดไม่มีรหัสของผลงาน')} />
      </div>
    )
  }

  usePageTitle(template.data?.name)

  const detail = template.data
  const liked = detail?.isLiked ?? false

  return (
    <div className="nc-page nc-detail-page">
      <nav className="nc-breadcrumb" aria-label="เส้นทางนำทาง">
        <Link to="/community"><Icon name="arrow-left" size={15} /> กลับไปชุมชน</Link>
        {detail && <span aria-hidden="true">/</span>}
        {detail && <span className="nc-breadcrumb-current">{detail.name}</span>}
      </nav>

      {template.isPending && <DetailSkeleton />}

      {template.error && (
        <ErrorState
          title="เปิดตัวอย่างไม่สำเร็จ"
          error={template.error}
          onRetry={() => void template.refetch()}
        />
      )}

      {!template.isPending && !template.error && !detail && (
        <EmptyState
          icon="search"
          title="ไม่พบดีไซน์ที่ต้องการ"
          description="ผลงานนี้อาจถูกลบหรือเปลี่ยนเป็นแบบไม่เผยแพร่แล้ว"
        >
          <Link to="/community" className="btn btn-primary">กลับไปชุมชน</Link>
        </EmptyState>
      )}

      {detail && (
        <DesignStoreProvider key={templateId} document={detail.document}>
          <div className="nc-detail-grid">
            <div className="nc-detail-main">
              <div className="nc-detail-stage">
                <span className="nc-detail-stage-badge"><Icon name="compass" size={13} /> ตัวอย่าง 3D · หมุนดูได้รอบด้าน</span>
                <WebGlGuard>
                  <NailScene fallback={null}>
                    <ReadOnlyDesignScene />
                  </NailScene>
                </WebGlGuard>
              </div>

              <section className="nc-card nc-detail-summary">
                <div className="nc-detail-title-row">
                  <h1>{detail.name}</h1>
                  <span className={`nc-badge nc-badge-${detail.origin}`}>{ORIGIN_LABELS[detail.origin] ?? detail.origin}</span>
                </div>
                <div className="nc-detail-author">
                  <Avatar userId={detail.author.id} displayName={detail.author.displayName} />
                  <span className="nc-detail-author-copy">
                    <Link to={`/users/${detail.author.id}`}>{detail.author.displayName}</Link>
                    <small>
                      เผยแพร่ <time dateTime={detail.createdAt}>{formatRelativeTime(detail.createdAt)}</time>
                      {' · '}{formatDateTime(detail.createdAt)}
                    </small>
                  </span>
                </div>
                {detail.caption && <p className="nc-detail-caption">{detail.caption}</p>}
                {(detail.category || detail.primaryColor) && (
                  <p className="nc-tag-row">
                    {detail.category && (
                      <Link to={`/community?category=${encodeURIComponent(detail.category)}`} className="nc-tag">#{detail.category}</Link>
                    )}
                    {detail.primaryColor && (
                      <Link to={`/community?color=${encodeURIComponent(detail.primaryColor)}`} className="nc-tag">#{detail.primaryColor}</Link>
                    )}
                  </p>
                )}
              </section>

              <section className="nc-card nc-comments" aria-labelledby="nc-comments-title">
                <h2 id="nc-comments-title">
                  <Icon name="comment" size={16} /> ความคิดเห็น ({formatCount(detail.commentCount)})
                </h2>

                <form
                  className="nc-comment-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const content = commentText.trim()
                    if (!content) return
                    createComment.mutate({ templateId, content }, { onSuccess: () => setCommentText('') })
                  }}
                >
                  {currentUser && (
                    <Avatar userId={currentUser.id} displayName={currentUser.displayName} linkToProfile={false} />
                  )}
                  <div className="nc-comment-field">
                    <textarea
                      value={commentText}
                      maxLength={COMMENT_LIMIT}
                      rows={2}
                      placeholder="แสดงความคิดเห็นถึงผลงานนี้…"
                      aria-label="ความคิดเห็นใหม่"
                      onChange={(event) => setCommentText(event.target.value)}
                    />
                    <div className="nc-comment-form-foot">
                      <span className={commentText.length > COMMENT_LIMIT - 50 ? 'nc-count-warn' : ''}>
                        {commentText.length}/{COMMENT_LIMIT}
                      </span>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={!commentText.trim() || createComment.isPending}
                      >
                        {createComment.isPending ? 'กำลังส่ง…' : 'ส่งความคิดเห็น'}
                      </button>
                    </div>
                    {createComment.error && (
                      <p className="nc-inline-error" role="alert">
                        <Icon name="alert" size={13} /> ส่งความคิดเห็นไม่สำเร็จ — {createComment.error instanceof Error ? createComment.error.message : 'กรุณาลองใหม่'}
                      </p>
                    )}
                  </div>
                </form>

                {detail.comments.length === 0 ? (
                  <EmptyState
                    icon="comment"
                    title="ยังไม่มีความคิดเห็น"
                    description="เป็นคนแรกที่ให้กำลังใจเจ้าของผลงานนี้"
                  />
                ) : (
                  <ul className="nc-comment-list">
                    {detail.comments.map((comment) => (
                      <li key={comment.id}>
                        <Avatar userId={comment.author.id} displayName={comment.author.displayName} size="sm" />
                        <div className="nc-comment-bubble">
                          <div className="nc-comment-head">
                            <Link to={`/users/${comment.author.id}`}>{comment.author.displayName}</Link>
                            <time dateTime={comment.createdAt}>{formatRelativeTime(comment.createdAt)}</time>
                          </div>
                          <p>{comment.content}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="nc-detail-side">
              <section className="nc-card nc-rail-card nc-detail-cta">
                <h2><Icon name="sparkle" size={15} /> ทำอะไรกับผลงานนี้ได้บ้าง</h2>
                <button
                  type="button"
                  className="btn btn-primary nc-detail-primary"
                  disabled={actions.isRemixPending(templateId)}
                  onClick={() => actions.remix(templateId)}
                >
                  <Icon name="remix" size={16} />
                  {actions.isRemixPending(templateId) ? 'กำลังสร้างงานรีมิกซ์…' : 'รีมิกซ์เป็นงานของฉัน'}
                </button>
                <p className="nc-detail-hint">ระบบจะคัดลอกดีไซน์นี้ไปเป็นโปรเจกต์ใหม่ในบัญชีของคุณ แล้วเปิดในโปรแกรมแก้ไขทันที</p>
                <div className="nc-detail-secondary">
                  <button
                    type="button"
                    className={`btn btn-ghost ${liked ? 'nc-detail-liked' : ''}`}
                    aria-pressed={liked}
                    disabled={actions.isLikePending(templateId)}
                    onClick={() => actions.toggleLike(templateId, liked)}
                  >
                    <Icon name="heart" size={16} /> {liked ? 'ถูกใจแล้ว' : 'ถูกใจ'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={actions.isSharePending(templateId)}
                    onClick={() => { void actions.share(templateId, detail.name) }}
                  >
                    <Icon name={actions.sharedId === templateId ? 'check' : 'share'} size={16} />
                    {actions.sharedId === templateId ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}
                  </button>
                </div>
                {actions.shareError && (
                  <p className="nc-inline-error" role="alert"><Icon name="alert" size={13} /> {actions.shareError}</p>
                )}
                {actions.remixError && (
                  <p className="nc-inline-error" role="alert"><Icon name="alert" size={13} /> {actions.remixError}</p>
                )}
              </section>

              <section className="nc-card nc-rail-card">
                <h2><Icon name="flame" size={15} /> การมีส่วนร่วม</h2>
                <dl className="nc-rail-stats">
                  <div><dt>ถูกใจ</dt><dd>{formatCount(detail.likeCount)}</dd></div>
                  <div><dt>ความคิดเห็น</dt><dd>{formatCount(detail.commentCount)}</dd></div>
                  <div><dt>รีมิกซ์</dt><dd>{formatCount(detail.remixCount)}</dd></div>
                  <div><dt>แชร์</dt><dd>{formatCount(detail.shareCount)}</dd></div>
                  <div><dt>เข้าชม</dt><dd>{formatCount(detail.viewCount)}</dd></div>
                </dl>
              </section>

              <section className="nc-card nc-rail-card">
                <h2><Icon name="tag" size={15} /> รายละเอียดดีไซน์</h2>
                <dl className="nc-detail-meta">
                  <div>
                    <dt>สไตล์</dt>
                    <dd>{detail.category ?? 'ไม่ระบุ'}</dd>
                  </div>
                  <div>
                    <dt>สีหลัก</dt>
                    <dd className="nc-detail-color">
                      {detail.primaryColor && (
                        <span
                          className="nc-swatch"
                          style={{ backgroundImage: PRIMARY_COLOR_SWATCHES[detail.primaryColor] }}
                          aria-hidden="true"
                        />
                      )}
                      {detail.primaryColor ?? 'ไม่ระบุ'}
                    </dd>
                  </div>
                  <div><dt>ที่มา</dt><dd>{ORIGIN_LABELS[detail.origin] ?? detail.origin}</dd></div>
                  <div><dt>เผยแพร่เมื่อ</dt><dd>{formatDateTime(detail.createdAt)}</dd></div>
                </dl>
                <Link to={`/users/${detail.author.id}`} className="nc-detail-author-link">
                  <Icon name="user" size={15} /> ดูผลงานอื่นของ {detail.author.displayName}
                </Link>
              </section>
            </aside>
          </div>
        </DesignStoreProvider>
      )}
    </div>
  )
}
