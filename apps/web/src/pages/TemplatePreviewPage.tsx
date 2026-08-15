import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { ReadOnlyDesignScene } from '@/3d/scene/ReadOnlyDesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import { useCreateTemplateComment, useTemplate, useTemplateShare } from '@/features/community/useTemplates.ts'
import { DesignStoreProvider } from '@/features/design/DesignStoreProvider.tsx'

export function TemplatePreviewPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const template = useTemplate(templateId)
  const createComment = useCreateTemplateComment()
  const shareMutation = useTemplateShare()
  const [commentText, setCommentText] = useState('')
  const [shareMessage, setShareMessage] = useState<string | null>(null)

  const shareTemplate = async (name: string) => {
    if (!templateId) return
    setShareMessage(null)
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
        { onSuccess: (result) => setShareMessage(`แชร์แล้ว · ${result.shareCount} ครั้ง`) },
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareMessage(error instanceof Error ? error.message : 'แชร์ผลงานไม่สำเร็จ')
    }
  }

  if (!templateId) return <p className="error center">ไม่พบรหัสดีไซน์</p>
  if (template.isPending) return <p className="muted center">กำลังโหลดตัวอย่าง 3D…</p>
  if (template.error) {
    return (
      <p className="error center" role="alert">
        เปิดตัวอย่างไม่สำเร็จ
        {template.error instanceof ApiRequestError ? ` — ${template.error.message}` : ''}
      </p>
    )
  }
  if (!template.data) return <p className="error center">ไม่พบดีไซน์ที่ต้องการ</p>

  const detail = template.data
  return (
    <DesignStoreProvider key={templateId} document={detail.document}>
      <section className="page template-preview-page">
        <header className="page-head template-preview-head">
          <div>
            <Link to="/community" className="back-link">← กลับไปชุมชน</Link>
            <p className="eyebrow">READ-ONLY 3D PREVIEW</p>
            <h1>{detail.name}</h1>
            <p className="muted">โดย <Link to={`/users/${detail.author.id}`}>{detail.author.displayName}</Link></p>
          </div>
          <div className="template-preview-stats" aria-label="สถิติการมีส่วนร่วม">
            <span>♥ {detail.likeCount}</span>
            <span>↗ {detail.shareCount}</span>
            <span>↻ {detail.remixCount}</span>
            <span>💬 {detail.commentCount}</span>
            <button
              type="button"
              className="template-preview-share"
              disabled={shareMutation.isPending}
              onClick={() => { void shareTemplate(detail.name) }}
            >
              {shareMutation.isPending ? 'กำลังแชร์…' : 'แชร์'}
            </button>
          </div>
        </header>

        {shareMessage && <p className="community-success" role="status">{shareMessage}</p>}

        <div className="template-preview-stage">
          <WebGlGuard>
            <NailScene fallback={null}>
              <ReadOnlyDesignScene />
            </NailScene>
          </WebGlGuard>
        </div>

        {detail.caption && <p className="template-preview-caption">{detail.caption}</p>}

        <section className="template-comments" aria-labelledby="template-comments-title">
          <div className="template-comments-head">
            <h2 id="template-comments-title">ความคิดเห็น ({detail.commentCount})</h2>
          </div>
          <form
            className="template-comment-form"
            onSubmit={(event) => {
              event.preventDefault()
              const content = commentText.trim()
              if (!content || !templateId) return
              createComment.mutate({ templateId, content }, { onSuccess: () => setCommentText('') })
            }}
          >
            <textarea
              value={commentText}
              maxLength={1000}
              placeholder="เขียนความคิดเห็น…"
              aria-label="ความคิดเห็นใหม่"
              onChange={(event) => setCommentText(event.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!commentText.trim() || createComment.isPending}>
              {createComment.isPending ? 'กำลังส่ง…' : 'ส่งความคิดเห็น'}
            </button>
          </form>
          <ul className="template-comment-list">
            {detail.comments.map((comment) => (
              <li key={comment.id}>
                <p>{comment.content}</p>
                <span className="muted">โดย {comment.author.displayName}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </DesignStoreProvider>
  )
}
